export const typeDefs = `#graphql
  enum IngestionStatus {
    INGESTED
    SKIPPED
  }

  type LegalDocument {
    id: ID!
    score: Float
    recordType: String
    documentId: String
    chunkId: String
    chunkIndex: Int
    chunkCount: Int
    fileName: String!
    filePath: String!
    title: String!
    heading: String
    keywords: [String!]
    content: String!
    contentType: String!
    textLength: Int
    sizeBytes: Int!
    ingestedAt: String!
    highlights: [String!]!
  }

  type IngestionResult {
    fileName: String!
    filePath: String!
    status: IngestionStatus!
    reason: String!
  }

  type Health {
    ok: Boolean!
    service: String!
  }

  type RagReferenceBundle {
    query: String!
    requestedText: String!
    medium: String!
    exportFormat: String
    supportedExportFormats: [String!]!
    codexInstructions: String!
    documents: [LegalDocument!]!
  }

  type IndexedDocumentSummary {
    id: ID!
    score: Float
    fileName: String!
    title: String!
    contentType: String!
    sizeBytes: Int!
    ingestedAt: String!
    preview: String!
  }

  type SemanticQueryPlanBundle {
    semanticRequest: String!
    requestedText: String!
    medium: String!
    exportFormat: String
    supportedExportFormats: [String!]!
    opensearchQueryTemplate: String!
    codexInstructions: String!
    documents: [IndexedDocumentSummary!]!
  }

  type ExportResult {
    format: String!
    fileName: String!
    filePath: String!
    contentType: String!
    sizeBytes: Int!
  }

  type Query {
    health: Health!
    legalDocuments(query: String, queries: [String!], fileName: String, limit: Int = 10): [LegalDocument!]!
    ragReferenceBundle(
      query: String
      queries: [String!]
      requestedText: String
      medium: String = "markdown"
      exportFormat: String
      limit: Int = 10
    ): RagReferenceBundle!
    semanticQueryPlanBundle(
      semanticRequest: String!
      requestedText: String
      medium: String = "markdown"
      exportFormat: String
      limit: Int = 25
    ): SemanticQueryPlanBundle!
  }

  type Mutation {
    ingestDocuments(fileLocation: String!, force: Boolean = false): IngestionResult!
    exportGeneratedDocument(
      title: String
      text: String!
      format: String!
      fileName: String
    ): ExportResult!
  }
`;
