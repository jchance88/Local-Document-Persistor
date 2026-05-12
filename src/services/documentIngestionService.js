import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { PDFParse } from 'pdf-parse';
import { env } from '../config/env.js';
import { openSearchClient } from '../opensearch/client.js';
import { getContentType, resolveAllowedDocumentPath } from '../utils/fileSafety.js';

async function documentExists(fileName) {
  const response = await openSearchClient.count({
    index: env.openSearch.index,
    body: {
      query: {
        term: { fileName }
      }
    }
  });

  return response.body.count > 0;
}

async function extractDocumentContent(resolvedPath, contentBuffer) {
  if (path.extname(resolvedPath).toLowerCase() !== '.pdf') {
    return contentBuffer.toString('utf8');
  }

  const parser = new PDFParse({ data: contentBuffer });

  try {
    const result = await parser.getText();
    return (result.text || '').trim();
  } finally {
    await parser.destroy();
  }
}

export async function ingestDocuments({ fileLocation }) {
  const resolvedPath = resolveAllowedDocumentPath(fileLocation);
  const stats = await fs.stat(resolvedPath);

  if (!stats.isFile()) {
    throw new Error('File location must point to a file.');
  }

  if (stats.size > env.documents.maxIngestBytes) {
    throw new Error(`File exceeds MAX_INGEST_BYTES (${env.documents.maxIngestBytes}).`);
  }

  const fileName = path.basename(resolvedPath);
  const exists = await documentExists(fileName);

  if (exists) {
    return {
      fileName,
      filePath: resolvedPath,
      status: 'SKIPPED',
      reason: 'A document with this fileName already exists in OpenSearch.'
    };
  }

  const contentBuffer = await fs.readFile(resolvedPath);
  const content = await extractDocumentContent(resolvedPath, contentBuffer);
  const id = crypto.createHash('sha256').update(fileName).digest('hex');
  const now = new Date().toISOString();

  await openSearchClient.index({
    index: env.openSearch.index,
    id,
    refresh: true,
    body: {
      fileName,
      filePath: resolvedPath,
      title: path.parse(fileName).name,
      content,
      contentType: getContentType(resolvedPath),
      sizeBytes: stats.size,
      ingestedAt: now
    }
  });

  return {
    fileName,
    filePath: resolvedPath,
    status: 'INGESTED',
    reason: 'Document indexed successfully.'
  };
}
