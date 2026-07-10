import fs from 'fs';
import path from 'path';
import { crawlDirectory } from '../services/crawler.service.js';
import { chunkFile } from '../services/chunker.service.js';
import supermemoryClient from '../services/memory.service.js';

// Helper to delay execution between batches
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Endpoint to crawl, chunk, and index a codebase.
 * POST /api/index-repo
 * Body: { repoPath: string, containerTag?: string }
 */
export async function indexRepository(req, res) {
  const { repoPath, containerTag = 'default_repo' } = req.body;

  if (!repoPath) {
    return res.status(400).json({ error: 'repoPath is required' });
  }

  const absolutePath = path.resolve(repoPath);

  if (!fs.existsSync(absolutePath)) {
    return res.status(400).json({ error: `Directory does not exist: ${absolutePath}` });
  }

  try {
    // 1. Crawl filesystem
    console.log(`Starting crawl for directory: ${absolutePath}`);
    const files = await crawlDirectory(absolutePath);
    console.log(`Found ${files.length} indexable files`);

    // 2. Chunker loop
    let allChunks = [];
    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file.absolutePath, 'utf8');
        const fileChunks = chunkFile(content, file.relativePath, { chunkSize: 150, overlap: 20 });
        allChunks.push(...fileChunks);
      } catch (err) {
        console.warn(`Failed to read file ${file.absolutePath}:`, err.message);
      }
    }

    console.log(`Generated ${allChunks.length} chunks from ${files.length} files`);

    // 3. Batch upload with rate limiting to avoid choking local memory binary
    const batchSize = 15;
    const delayBetweenBatchesMs = 100;
    let successfullyIndexed = 0;

    // We stream updates to the console or can track progress
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);
      
      const uploadPromises = batch.map(async (chunk) => {
        try {
          const payload = {
            content: `File: ${chunk.metadata.filePath}\nLines: ${chunk.metadata.lineStart}-${chunk.metadata.lineEnd}\n\n${chunk.content}`,
            metadata: {
              filePath: chunk.metadata.filePath,
              language: chunk.metadata.language,
              lineStart: String(chunk.metadata.lineStart),
              lineEnd: String(chunk.metadata.lineEnd),
            }
          };

          // Defensive SDK usage supporting multiple versions of supermemory JS SDK
          if (typeof supermemoryClient.add === 'function') {
            await supermemoryClient.add({
              ...payload,
              containerTags: [containerTag]
            });
          } else if (supermemoryClient.memories && typeof supermemoryClient.memories.add === 'function') {
            await supermemoryClient.memories.add({
              content: payload.content,
              containerTag,
              metadata: payload.metadata
            });
          } else {
            // Raw HTTP fallback if SDK shape is unexpected
            const response = await fetch(`${process.env.SUPERMEMORY_BASE_URL || 'http://localhost:8000'}/v3/documents`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.SUPERMEMORY_API_KEY || 'local_development_key'}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                content: payload.content,
                containerTag,
                metadata: payload.metadata
              })
            });
            if (!response.ok) {
              throw new Error(`Fallback HTTP returned status ${response.status}`);
            }
          }
          successfullyIndexed++;
        } catch (error) {
          console.error(`Failed to index chunk for file ${chunk.metadata.filePath}:`, error.message);
        }
      });

      await Promise.all(uploadPromises);
      
      // Pause between batches to release CPU/database locks
      if (i + batchSize < allChunks.length) {
        await delay(delayBetweenBatchesMs);
      }
    }

    return res.status(200).json({
      message: 'Indexing completed successfully',
      statistics: {
        filesScanned: files.length,
        chunksGenerated: allChunks.length,
        chunksIndexed: successfullyIndexed,
      }
    });

  } catch (error) {
    console.error('Error during repository indexing:', error);
    return res.status(500).json({ error: 'Failed to index repository', details: error.message });
  }
}

/**
 * Endpoint to execute semantic search over indexed memories.
 * POST /api/search
 * Body: { query: string, containerTag?: string }
 */
export async function searchCodebase(req, res) {
  const { query, containerTag = 'default_repo' } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'query string is required' });
  }

  try {
    let results = [];

    // Defensive SDK search execution
    if (supermemoryClient.search && typeof supermemoryClient.search.documents === 'function') {
      const response = await supermemoryClient.search.documents({
        q: query,
        containerTags: [containerTag],
      });
      results = response?.results || [];
    } else if (supermemoryClient.search && typeof supermemoryClient.search.memories === 'function') {
      const response = await supermemoryClient.search.memories({
        q: query,
        containerTag,
      });
      results = response?.results || [];
    } else if (supermemoryClient.memories && typeof supermemoryClient.memories.search === 'function') {
      const response = await supermemoryClient.memories.search({
        q: query,
        containerTag,
      });
      results = response?.results || [];
    } else {
      // Raw HTTP fallback if SDK shape is unexpected
      const response = await fetch(`${process.env.SUPERMEMORY_BASE_URL || 'http://localhost:8000'}/v3/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPERMEMORY_API_KEY || 'local_development_key'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: query,
          containerTag
        })
      });
      
      if (!response.ok) {
        throw new Error(`Fallback HTTP returned status ${response.status}`);
      }
      
      const json = await response.json();
      results = json?.results || [];
    }

    // Standardize search return object for the React frontend
    const formattedResults = results.map(item => {
      // Depending on the version, content could be nested under document or directly as memory
      const content = item.content || item.document?.content || '';
      const metadata = item.metadata || item.document?.metadata || {};
      const score = item.score || item.relevance || 0;

      return {
        content,
        filePath: metadata.filePath || 'Unknown File',
        language: metadata.language || 'text',
        lineStart: parseInt(metadata.lineStart, 10) || 1,
        lineEnd: parseInt(metadata.lineEnd, 10) || 1,
        score
      };
    });

    return res.status(200).json({ results: formattedResults });

  } catch (error) {
    console.error('Error executing semantic search:', error);
    return res.status(500).json({ error: 'Search execution failed', details: error.message });
  }
}
