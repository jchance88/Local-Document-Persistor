import { env } from '../config/env.js';
import { openSearchClient } from '../opensearch/client.js';

const supportedExportFormats = ['pdf', 'docx'];

function normalizeMedium(medium = 'markdown') {
  return medium.trim().toLowerCase().replace(/[\s-]+/g, '_') || 'markdown';
}

function normalizeExportFormat(exportFormat) {
  if (!exportFormat) {
    return null;
  }

  const normalized = exportFormat.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'word') {
    return 'docx';
  }

  return supportedExportFormats.includes(normalized) ? normalized : null;
}

function contentPreview(content = '', maxLength = 650) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trim()}...`;
}

async function listIndexedDocumentSummaries(limit = 25) {
  const size = Math.min(Math.max(limit, 1), 50);
  const response = await openSearchClient.search({
    index: env.openSearch.index,
    body: {
      size,
      sort: [{ ingestedAt: { order: 'desc' } }],
      query: { match_all: {} },
      _source: [
        'fileName',
        'title',
        'content',
        'contentType',
        'sizeBytes',
        'ingestedAt'
      ]
    }
  });

  return response.body.hits.hits.map((hit) => ({
    id: hit._id,
    score: hit._score,
    fileName: hit._source.fileName,
    title: hit._source.title,
    contentType: hit._source.contentType,
    sizeBytes: hit._source.sizeBytes,
    ingestedAt: hit._source.ingestedAt,
    preview: contentPreview(hit._source.content)
  }));
}

function buildOpenSearchTemplate({ semanticRequest }) {
  return JSON.stringify({
    size: 10,
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query: '<codex-generated retrieval query>',
              fields: ['title^3', 'content']
            }
          }
        ]
      }
    },
    highlight: {
      fields: {
        content: {
          fragment_size: 240,
          number_of_fragments: 3
        }
      }
    },
    _comment: `Base this query on the semantic request: ${semanticRequest || '<user semantic request>'}`
  }, null, 2);
}

function buildCodexInstructions({
  semanticRequest,
  requestedText,
  medium,
  exportFormat,
  documents
}) {
  const documentList = documents
    .map((document, index) => [
      `${index + 1}. ${document.fileName} (${document.title})`,
      `   Type: ${document.contentType}; bytes: ${document.sizeBytes}; ingested: ${document.ingestedAt}`,
      `   Preview: ${document.preview || 'No preview available.'}`
    ].join('\n'))
    .join('\n');
  const exportGuidance = exportFormat
    ? `The user requested final export format "${exportFormat}". After generating the final text, call exportGeneratedDocument with that format if they want a saved file.`
    : 'Before writing a final export file, ask the user which format they want: PDF or Word (.docx).';

  return [
    'You are planning retrieval for Local-Document-Persistor.',
    'Use the indexed document inventory below to translate the user semantic request into the best retrieval query for OpenSearch.',
    '',
    `Semantic context request: ${semanticRequest || 'No semantic request provided.'}`,
    `Requested final result: ${requestedText || 'Generate the requested result from retrieved context.'}`,
    `Requested output medium: ${medium}.`,
    `Supported export formats: ${supportedExportFormats.join(', ')}.`,
    exportGuidance,
    '',
    'Steps:',
    '1. Inspect the available document filenames, titles, and previews.',
    '2. Generate a concise retrieval query using the vocabulary most likely to appear in the indexed documents.',
    '3. Prefer a plain query string that can be passed to ragReferenceBundle(query: ...).',
    '4. If a specific file is clearly the best source, include that fileName when calling ragReferenceBundle.',
    '5. Call ragReferenceBundle with the generated query, the requested final result, the desired medium, and exportFormat if known.',
    '6. Use the documents returned by ragReferenceBundle as the authoritative context for the final answer.',
    '7. Do not invent facts not supported by the retrieved documents; state limitations when the documents do not directly address the user request.',
    '',
    'OpenSearch query shape used by this app:',
    buildOpenSearchTemplate({ semanticRequest }),
    '',
    'Available indexed documents:',
    documentList || 'No indexed documents were returned. Ask the user to ingest documents before generating a final result.'
  ].join('\n');
}

export async function getSemanticQueryPlanBundle({
  semanticRequest,
  requestedText,
  medium = 'markdown',
  exportFormat,
  limit = 25
}) {
  const normalizedMedium = normalizeMedium(medium);
  const normalizedExportFormat = normalizeExportFormat(exportFormat);
  const documents = await listIndexedDocumentSummaries(limit);

  return {
    semanticRequest: semanticRequest || '',
    requestedText: requestedText || '',
    medium: normalizedMedium,
    exportFormat: normalizedExportFormat,
    supportedExportFormats,
    opensearchQueryTemplate: buildOpenSearchTemplate({ semanticRequest }),
    codexInstructions: buildCodexInstructions({
      semanticRequest,
      requestedText,
      medium: normalizedMedium,
      exportFormat: normalizedExportFormat,
      documents
    }),
    documents
  };
}
