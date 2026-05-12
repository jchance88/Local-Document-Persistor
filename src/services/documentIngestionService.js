import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { PDFParse } from 'pdf-parse';
import { env } from '../config/env.js';
import { openSearchClient } from '../opensearch/client.js';
import { buildDocumentChunks } from './documentChunkingService.js';
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

async function deleteExistingDocumentChunks(fileName) {
  await openSearchClient.deleteByQuery({
    index: env.openSearch.index,
    refresh: true,
    body: {
      query: {
        term: { fileName }
      }
    }
  });
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

export async function ingestDocuments({ fileLocation, force = false }) {
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

  if (exists && !force) {
    return {
      fileName,
      filePath: resolvedPath,
      status: 'SKIPPED',
      reason: 'A document with this fileName already exists in OpenSearch.'
    };
  }

  if (exists && force) {
    await deleteExistingDocumentChunks(fileName);
  }

  const contentBuffer = await fs.readFile(resolvedPath);
  const content = await extractDocumentContent(resolvedPath, contentBuffer);
  const documentId = crypto.createHash('sha256').update(fileName).digest('hex');
  const now = new Date().toISOString();
  const title = path.parse(fileName).name;
  const contentType = getContentType(resolvedPath);
  const chunks = buildDocumentChunks(content, {
    chunkSize: env.documents.chunkSize,
    chunkOverlap: env.documents.chunkOverlap
  });

  const body = chunks.flatMap((chunk) => [
    {
      index: {
        _index: env.openSearch.index,
        _id: `${documentId}:${chunk.chunkIndex}`
      }
    },
    {
      recordType: 'chunk',
      documentId,
      chunkId: `${documentId}:${chunk.chunkIndex}`,
      chunkIndex: chunk.chunkIndex,
      chunkCount: chunk.chunkCount,
      fileName,
      filePath: resolvedPath,
      title,
      heading: chunk.heading,
      keywords: chunk.keywords,
      content: chunk.content,
      contentType,
      textLength: chunk.textLength,
      sizeBytes: stats.size,
      ingestedAt: now
    }
  ]);

  const response = await openSearchClient.bulk({
    refresh: true,
    body
  });

  if (response.body.errors) {
    throw new Error('OpenSearch bulk indexing failed for one or more document chunks.');
  }

  return {
    fileName,
    filePath: resolvedPath,
    status: 'INGESTED',
    reason: `Document indexed successfully into ${chunks.length} chunk(s).`
  };
}
