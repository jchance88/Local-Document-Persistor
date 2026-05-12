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

function normalizeMedium(medium = 'markdown') {
  const normalized = medium.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return mediumProfiles[normalized] ? normalized : 'markdown';
}

function buildCodexInstructions({ requestedText, medium, documents }) {
  const profile = mediumProfiles[medium];
  const sourceList = documents
    .map((document, index) => `${index + 1}. ${document.fileName} (${document.title})`)
    .join('\n');

  return [
    'Use the returned OpenSearch documents as retrieval context for a RAG-style answer.',
    `Requested output medium: ${profile.label}.`,
    `User request: ${requestedText || 'Generate the requested legal reference text from the retrieved material.'}`,
    profile.guidance,
    'Do not invent facts not supported by the returned documents.',
    'When a source materially supports a statement, identify the supporting file name.',
    'If the returned documents are insufficient, say what is missing instead of filling the gap.',
    '',
    'Retrieved sources:',
    sourceList || 'No documents returned.'
  ].join('\n');
}

export async function getRagReferenceBundle({ query, requestedText, medium, limit = 10 }) {
  const normalizedMedium = normalizeMedium(medium);
  const documents = await searchLegalDocuments({ query, limit, includeHighlights: false });

  return {
    query: query || '',
    requestedText: requestedText || '',
    medium: normalizedMedium,
    codexInstructions: buildCodexInstructions({
      requestedText,
      medium: normalizedMedium,
      documents
    }),
    documents
  };
}
