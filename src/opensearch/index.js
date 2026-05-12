import { env } from '../config/env.js';
import { openSearchClient } from './client.js';

const mappings = {
  properties: {
    fileName: { type: 'keyword' },
    filePath: { type: 'keyword' },
    title: { type: 'text', fields: { keyword: { type: 'keyword' } } },
    content: { type: 'text' },
    contentType: { type: 'keyword' },
    sizeBytes: { type: 'long' },
    ingestedAt: { type: 'date' }
  }
};

export async function ensureDocumentIndex() {
  const index = env.openSearch.index;
  const exists = await openSearchClient.indices.exists({ index });

  if (exists.body) {
    return;
  }

  await openSearchClient.indices.create({
    index,
    body: {
      settings: {
        index: {
          number_of_shards: 1,
          number_of_replicas: 0
        }
      },
      mappings
    }
  });
}
