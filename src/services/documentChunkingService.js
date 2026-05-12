const stopWords = new Set([
  'about',
  'after',
  'also',
  'and',
  'any',
  'are',
  'because',
  'been',
  'before',
  'being',
  'between',
  'both',
  'but',
  'can',
  'court',
  'document',
  'did',
  'each',
  'for',
  'from',
  'have',
  'into',
  'may',
  'more',
  'must',
  'not',
  'only',
  'other',
  'page',
  'shall',
  'should',
  'such',
  'that',
  'the',
  'their',
  'then',
  'there',
  'this',
  'through',
  'under',
  'was',
  'were',
  'when',
  'where',
  'which',
  'while',
  'with',
  'would',
  'will',
  'yes',
  'you',
  'your'
]);

function normalizeText(text) {
  return text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isLikelyHeading(line) {
  const cleaned = line.trim().replace(/^#+\s*/, '');

  if (!cleaned || cleaned.length > 120 || /[.!?]$/.test(cleaned)) {
    return false;
  }

  if (/^(section|article|chapter|part|rule|claim|count|issue|argument)\b/i.test(cleaned)) {
    return true;
  }

  const letters = cleaned.replace(/[^a-z]/gi, '');
  if (letters.length < 4) {
    return false;
  }

  const uppercaseLetters = letters.replace(/[^A-Z]/g, '').length;
  return uppercaseLetters / letters.length > 0.65;
}

function nearestHeading(text) {
  const heading = text
    .split('\n')
    .map((line) => line.trim())
    .find(isLikelyHeading);

  return heading || '';
}

function keywordCandidates(text, limit = 18) {
  const counts = new Map();
  const phrases = text
    .toLowerCase()
    .match(/[a-z][a-z0-9'.-]{2,}/g) || [];

  for (const rawToken of phrases) {
    const token = rawToken.replace(/^'+|'+$/g, '');
    if (token.length < 3 || stopWords.has(token) || /^\d+$/.test(token)) {
      continue;
    }

    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([keyword]) => keyword);
}

function splitLongParagraph(paragraph, maxLength) {
  const sentences = paragraph.match(/[^.!?]+[.!?]+|\S.+$/g) || [paragraph];
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence.trim()}` : sentence.trim();
    if (next.length <= maxLength) {
      current = next;
    } else {
      if (current) {
        chunks.push(current);
      }
      current = sentence.trim();
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function splitIntoChunks(text, { maxLength, overlap }) {
  const normalized = normalizeText(text);
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap((paragraph) => paragraph.length > maxLength
      ? splitLongParagraph(paragraph, maxLength)
      : [paragraph]);
  const chunks = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;

    if (next.length <= maxLength) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    const previousTail = overlap > 0 && current.length > overlap
      ? wordBoundaryTail(current, overlap)
      : '';
    current = previousTail ? `${previousTail}\n\n${paragraph}` : paragraph;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.length ? chunks : [normalized];
}

function wordBoundaryTail(text, overlap) {
  const tail = text.slice(-overlap);
  const firstWhitespace = tail.search(/\s/);

  if (firstWhitespace <= 0 || firstWhitespace >= tail.length - 1) {
    return tail.trim();
  }

  return tail.slice(firstWhitespace + 1).trim();
}

export function buildDocumentChunks(text, { chunkSize, chunkOverlap }) {
  const chunks = splitIntoChunks(text, {
    maxLength: Math.max(chunkSize, 500),
    overlap: Math.max(Math.min(chunkOverlap, chunkSize - 1), 0)
  });

  return chunks.map((content, index) => ({
    chunkIndex: index,
    chunkCount: chunks.length,
    content,
    heading: nearestHeading(content),
    keywords: keywordCandidates(content),
    textLength: content.length
  }));
}
