import dotenv from 'dotenv';

dotenv.config();

const toBoolean = (value, defaultValue) => {
  if (value === undefined || value === '') return defaultValue;
  return ['1', 'true', 'yes'].includes(String(value).toLowerCase());
};

const toInteger = (value, defaultValue) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

export const env = {
  port: toInteger(process.env.PORT, 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  openSearch: {
    node: process.env.OPENSEARCH_NODE || 'http://localhost:9200',
    username: process.env.OPENSEARCH_USERNAME || '',
    password: process.env.OPENSEARCH_PASSWORD || '',
    index: process.env.OPENSEARCH_INDEX || 'legal_documents',
    rejectUnauthorized: toBoolean(process.env.OPENSEARCH_TLS_REJECT_UNAUTHORIZED, true)
  },
  documents: {
    root: process.env.DOCUMENT_ROOT || '/documents',
    maxIngestBytes: toInteger(process.env.MAX_INGEST_BYTES, 10 * 1024 * 1024)
  }
};
