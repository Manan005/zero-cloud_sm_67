/**
 * Splits file content into overlapping chunks of lines.
 * This is optimized for code repositories to preserve context (e.g. imports, function signatures).
 * 
 * @param {string} content The raw text content of the file
 * @param {string} relativePath File path relative to project root
 * @param {object} options Chunking configuration options
 * @returns {Array<{content: string, metadata: object}>} Array of chunks with metadata
 */
export function chunkFile(content, relativePath, options = {}) {
  const { chunkSize = 150, overlap = 20 } = options;
  const lines = content.split(/\r?\n/);
  const totalLines = lines.length;
  const chunks = [];

  // Determine file language based on file extension
  const extension = relativePath.split('.').pop() || '';
  const languageMap = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    cs: 'csharp',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown',
    sh: 'bash',
    yml: 'yaml',
    yaml: 'yaml'
  };
  const language = languageMap[extension.toLowerCase()] || 'text';

  if (totalLines <= chunkSize) {
    // If the file fits in one chunk, return it without chunking
    chunks.push({
      content: content,
      metadata: {
        filePath: relativePath,
        language,
        lineStart: 1,
        lineEnd: totalLines,
      }
    });
    return chunks;
  }

  let start = 0;
  while (start < totalLines) {
    const end = Math.min(start + chunkSize, totalLines);
    const chunkLines = lines.slice(start, end);
    const chunkContent = chunkLines.join('\n');

    chunks.push({
      content: chunkContent,
      metadata: {
        filePath: relativePath,
        language,
        lineStart: start + 1,
        lineEnd: end,
      }
    });

    // Advance start point by chunkSize - overlap
    start += (chunkSize - overlap);

    // Guard to prevent infinite loop or empty final chunks
    if (start >= totalLines || (end === totalLines)) {
      break;
    }
  }

  return chunks;
}
