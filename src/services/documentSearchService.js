import { env } from '../config/env.js';
import { openSearchClient } from '../opensearch/client.js';

function normalizeQueries({ query, queries }) {
  return [
    ...(Array.isArray(queries) ? queries : []),
    query
  ]
    .map((value) => (value || '').trim())
    .filter(Boolean);
}

export async function searchLegalDocuments({ query, queries, fileName, limit = 10, includeHighlights = true }) {
  const size = Math.min(Math.max(limit, 1), 50);
  const must = [];
  const filter = [];
  const should = [];
  const normalizedQueries = normalizeQueries({ query, queries });

  for (const value of normalizedQueries) {
    should.push({
      multi_match: {
        query: value,
        fields: [
          'title^4',
          'fileName^3',
          'heading^3',
          'keywords^2',
          'content'
        ],
        type: 'best_fields',
        operator: 'or'
      }
    });
  }

  if (fileName) {
    filter.push({ term: { fileName } });
  }

  if (should.length) {
    must.push({
      bool: {
        should,
        minimum_should_match: 1
      }
    });
  }

  const body = {
    size,
    query: must.length || filter.length
      ? { bool: { must, filter } }
      : { match_all: {} }
  };

  if (includeHighlights) {
    body.highlight = {
      fields: {
        content: {
          fragment_size: 240,
          number_of_fragments: 3
        }
      }
    };
  }

  const response = await openSearchClient.search({
    index: env.openSearch.index,
    body
  });

  return response.body.hits.hits.map((hit) => ({
    id: hit._id,
    score: hit._score,
    ...hit._source,
    highlights: hit.highlight?.content || []
  }));
}
