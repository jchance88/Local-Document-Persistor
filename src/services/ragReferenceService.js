import { searchLegalDocuments } from './documentSearchService.js';

const mediumProfiles = {
  plain_text: {
    label: 'plain text',
    guidance: 'Return clear plain text with short headings and no Markdown-specific formatting.'
  },
  markdown: {
    label: 'Markdown',
    guidance: 'Return valid Markdown with concise headings, bullets where useful, and source notes.'
  },
  pdf: {
    label: 'PDF-ready prose',
    guidance: 'Return polished prose suitable for rendering into a PDF, with a title, sections, and citation notes.'
  },
  docx: {
    label: 'Word-ready prose',
    guidance: 'Return polished prose suitable for rendering into a Word document, with a title, sections, and citation notes.'
  },
  word: {
    label: 'Word-ready prose',
    guidance: 'Return polished prose suitable for rendering into a Word document, with a title, sections, and citation notes.'
  },
  email: {
    label: 'email',
    guidance: 'Return an email-ready response with a subject line, greeting, body, and closing.'
  },
  memo: {
    label: 'legal memo',
    guidance: 'Return a legal memo with issue, brief answer, facts relied on, analysis, and conclusion.'
  },
  brief: {
    label: 'legal brief',
    guidance: 'Return a brief-style draft with introduction, argument sections, and source references.'
  },
  motion: {
    label: 'motion',
    guidance: 'Return a motion-style draft with caption placeholder, requested relief, argument, and conclusion.'
  }
};

const supportedExportFormats = ['pdf', 'docx'];

function normalizeMedium(medium = 'markdown') {
  const normalized = medium.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return mediumProfiles[normalized] ? normalized : 'markdown';
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

function buildCodexInstructions({ requestedText, medium, exportFormat, documents }) {
  const profile = mediumProfiles[medium];
  const sourceList = documents
    .map((document, index) => `${index + 1}. ${document.fileName} (${document.title})`)
    .join('\n');
  const exportGuidance = exportFormat
    ? `After drafting, call exportGeneratedDocument with format "${exportFormat}" if the user wants a saved file.`
    : 'Before creating a final export file, ask the user which format they want: PDF or Word (.docx).';

  return [
    'Use the returned OpenSearch documents as retrieval context for a RAG-style answer.',
    `Requested output medium: ${profile.label}.`,
    `Supported export formats: ${supportedExportFormats.join(', ')}.`,
    `User request: ${requestedText || 'Generate the requested local document text from the retrieved material.'}`,
    profile.guidance,
    exportGuidance,
    'Do not invent facts not supported by the returned documents.',
    'When a source materially supports a statement, identify the supporting file name.',
    'If the returned documents are insufficient, say what is missing instead of filling the gap.',
    '',
    'Retrieved sources:',
    sourceList || 'No documents returned.'
  ].join('\n');
}

export async function getRagReferenceBundle({ query, requestedText, medium, exportFormat, limit = 10 }) {
  const normalizedMedium = normalizeMedium(medium);
  const normalizedExportFormat = normalizeExportFormat(exportFormat);
  const documents = await searchLegalDocuments({ query, limit, includeHighlights: false });

  return {
    query: query || '',
    requestedText: requestedText || '',
    medium: normalizedMedium,
    exportFormat: normalizedExportFormat,
    supportedExportFormats,
    codexInstructions: buildCodexInstructions({
      requestedText,
      medium: normalizedMedium,
      exportFormat: normalizedExportFormat,
      documents
    }),
    documents
  };
}
