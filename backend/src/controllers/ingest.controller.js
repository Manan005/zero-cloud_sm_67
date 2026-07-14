import fs from 'fs'; // trigger reload
import path from 'path';
import { crawlDirectory } from '../services/crawler.service.js';
import { chunkFile } from '../services/chunker.service.js';
import supermemoryClient from '../services/memory.service.js';

// Helper to delay execution between batches
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to sanitize container tags (must contain only alphanumeric, hyphens, underscores, and colons)
function sanitizeContainerTag(tag) {
  if (typeof tag !== 'string') return 'default_repo';
  // Replace spaces and special characters with underscores
  const sanitized = tag.trim().replace(/[^a-zA-Z0-9\-_:]/g, '_');
  return sanitized || 'default_repo';
}

/**
 * Endpoint to crawl, chunk, and index a codebase.
 * POST /api/index-repo
 * Body: { repoPath: string, containerTag?: string }
 */
export async function indexRepository(req, res) {
  const { repoPath } = req.body;
  const rawTag = req.body.containerTag || 'default_repo';
  const containerTag = sanitizeContainerTag(rawTag);

  if (!repoPath) {
    return res.status(400).json({ error: 'repoPath is required' });
  }

  const absolutePath = path.resolve(repoPath);

  if (!fs.existsSync(absolutePath)) {
    return res.status(400).json({ error: `Directory does not exist: ${absolutePath}` });
  }

  try {
    // Clear existing index for this container tag to prevent pollution from previous paths
    console.log(`Clearing existing index for container tag: ${containerTag}`);
    try {
      if (supermemoryClient.documents && typeof supermemoryClient.documents.deleteBulk === 'function') {
        await supermemoryClient.documents.deleteBulk({
          containerTags: [containerTag]
        });
      } else {
        await fetch(`${process.env.SUPERMEMORY_BASE_URL || 'http://localhost:8000'}/v3/documents/bulk`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${process.env.SUPERMEMORY_API_KEY || 'local_development_key'}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            containerTags: [containerTag]
          })
        });
      }
      console.log(`Successfully cleared index for container tag: ${containerTag}`);
    } catch (clearErr) {
      console.warn(`Non-blocking warning: failed to clear index for tag ${containerTag}:`, clearErr.message);
    }

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
    const batchSize = 5;
    const delayBetweenBatchesMs = 250;
    let successfullyIndexed = 0;

    // We stream updates to the console or can track progress
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);
      
      const uploadPromises = batch.map(async (chunk) => {
        try {
          const payload = {
            content: `### File: ${chunk.metadata.filePath}\nLines: ${chunk.metadata.lineStart}-${chunk.metadata.lineEnd}\n\n${chunk.content}`,
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
  const { query } = req.body;
  const rawTag = req.body.containerTag || 'default_repo';
  const containerTag = sanitizeContainerTag(rawTag);

  if (!query) {
    return res.status(400).json({ error: 'query string is required' });
  }

  try {
    const baseUrl = process.env.SUPERMEMORY_BASE_URL || 'http://localhost:8000';
    const apiKey = process.env.SUPERMEMORY_API_KEY || 'local_development_key';

    // 1. Try v4/search (semantic memory search) first, which is the working endpoint for local/self-hosted
    let response = await fetch(`${baseUrl}/v4/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        containerTag
      })
    });

    let json = await response.json();
    let results = json?.results || [];
    let sourceUsed = 'v4';

    // 2. Fall back to v3/search if v4 returns no results or failed
    if (!response.ok || results.length === 0) {
      console.log(`v4/search returned 0 results or failed with status ${response.status}. Falling back to v3/search...`);
      const v3Response = await fetch(`${baseUrl}/v3/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: query,
          containerTag
        })
      });
      if (v3Response.ok) {
        const v3Json = await v3Response.json();
        results = v3Json?.results || [];
        sourceUsed = 'v3';
      }
    }

    console.log(`Semantic search for query "${query}" retrieved ${results.length} results from ${sourceUsed}`);

    // Standardize search return object for the React frontend
    const formattedResults = results.map(item => {
      // Extract content from v4 (memory/chunk) or v3 (chunks array)
      let content = '';
      if (item.memory) {
        content = item.memory;
      } else if (item.content) {
        content = item.content;
      } else if (item.chunks && item.chunks.length > 0) {
        content = item.chunks[0].content;
      } else if (item.document?.content) {
        content = item.document.content;
      }

      const metadata = item.metadata || item.document?.metadata || {};
      const score = item.similarity || item.score || item.relevance || 0;

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
