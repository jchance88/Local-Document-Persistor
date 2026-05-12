import { searchLegalDocuments } from '../services/documentSearchService.js';
import { ingestDocuments } from '../services/documentIngestionService.js';
import { getRagReferenceBundle } from '../services/ragReferenceService.js';
import { exportGeneratedDocument } from '../services/documentExportService.js';
import { getSemanticQueryPlanBundle } from '../services/semanticQueryPlanService.js';

export const resolvers = {
  Query: {
    health: () => ({
      ok: true,
      service: 'Local-Document-Persistor'
    }),
    legalDocuments: (_parent, args) => searchLegalDocuments(args),
    ragReferenceBundle: (_parent, args) => getRagReferenceBundle(args),
    semanticQueryPlanBundle: (_parent, args) => getSemanticQueryPlanBundle(args)
  },
  Mutation: {
    ingestDocuments: (_parent, args) => ingestDocuments(args),
    exportGeneratedDocument: (_parent, args) => exportGeneratedDocument(args)
  }
};
