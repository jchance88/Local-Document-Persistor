import { Client } from '@opensearch-project/opensearch';
import { env } from '../config/env.js';

const auth = env.openSearch.username
  ? {
      username: env.openSearch.username,
      password: env.openSearch.password
    }
  : undefined;

export const openSearchClient = new Client({
  node: env.openSearch.node,
  auth,
  ssl: {
    rejectUnauthorized: env.openSearch.rejectUnauthorized
  }
});
