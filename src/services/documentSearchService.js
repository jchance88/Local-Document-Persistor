import { env } from '../config/env.js';
import { openSearchClient } from '../opensearch/client.js';

export async function searchLegalDocuments({ query, fileName, limit = 10, includeHighlights = true }) {
  const size = Math.min(Math.max(limit, 1), 50);
  const must = [];

  if (query) {
    must.push({
      multi_match: {
        query,
        fields: ['title^3', 'content']
      }
    });
  }

  if (fileName) {
    must.push({ term: { fileName } });
  }

  const body = {
    size,
    query: must.length ? { bool: { must } } : { match_all: {} }
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
