import fs from 'fs';
import path from 'path';
import ignore from 'ignore';

const DEFAULT_IGNORE_LIST = [
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  'dist',
  'build',
  'out',
  'target',
  '.cache',
  '.idea',
  '.vscode',
  '.DS_Store',
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.ico',
  '*.svg',
  '*.woff',
  '*.woff2',
  '*.eot',
  '*.ttf',
  '*.pdf',
  '*.zip',
  '*.tar.gz',
  '*.tgz',
  '*.exe',
  '*.bin',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'cargo.lock'
];

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

/**
 * Checks if a file contains binary content by sniffing the first 512 bytes for null chars.
 * 
 * @param {string} filePath Absolute path to the file
 * @returns {boolean} True if binary, false if text
 */
function isBinaryFile(filePath) {
  try {
    const buffer = Buffer.alloc(512);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
    fs.closeSync(fd);

    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) {
        return true;
      }
    }
    return false;
  } catch (error) {
    // If we can't open/read the file properly, treat it as binary/skip to be safe
    return true;
  }
}

/**
 * Recursively scans a directory for indexable files.
 * Respects .gitignore and applies a global noise filter.
 * 
 * @param {string} targetDir Absolute directory path to crawl
 * @returns {Promise<Array<{absolutePath: string, relativePath: string}>>} List of file metadata
 */
export async function crawlDirectory(targetDir) {
  const ig = ignore().add(DEFAULT_IGNORE_LIST);

  // Check if .gitignore exists in project root and add to ignored list
  const gitignorePath = path.join(targetDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    try {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      ig.add(gitignoreContent);
    } catch (err) {
      console.warn(`Failed to read gitignore at ${gitignorePath}:`, err.message);
    }
  }

  const results = [];

  async function walk(currentDir) {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(targetDir, fullPath);

      // Check if ignore rules match this relative path
      // Ignore package requires directories to end with a slash for directory matching
      const checkPath = entry.isDirectory() ? `${relativePath}/` : relativePath;
      if (ig.ignores(checkPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        try {
          const stats = await fs.promises.stat(fullPath);

          // Check file size limits
          if (stats.size > MAX_FILE_SIZE_BYTES) {
            continue;
          }

          // Check if file is binary (e.g. images, compiled binaries)
          if (isBinaryFile(fullPath)) {
            continue;
          }

          results.push({
            absolutePath: fullPath,
            relativePath: relativePath.replace(/\\/g, '/') // Normalizes to forward slashes
          });
        } catch (err) {
          console.warn(`Skipping file due to stats read failure: ${fullPath}`, err.message);
        }
      }
    }
  }

  await walk(targetDir);
  return results;
}
