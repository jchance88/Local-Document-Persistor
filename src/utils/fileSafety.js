import path from 'node:path';
import { env } from '../config/env.js';

export function resolveAllowedDocumentPath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error('A fileLocation string is required.');
  }

  const root = path.resolve(env.documents.root);
  const resolved = path.resolve(root, inputPath);

  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('File location must stay inside DOCUMENT_ROOT.');
  }

  return resolved;
}

export function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.md') return 'text/markdown';
  if (extension === '.json') return 'application/json';
  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.txt') return 'text/plain';

  return 'application/octet-stream';
}
