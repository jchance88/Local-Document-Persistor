export const typeDefs = `#graphql
  enum IngestionStatus {
    INGESTED
    SKIPPED
  }

  type LegalDocument {
    id: ID!
    score: Float
    fileName: String!
    filePath: String!
    title: String!
    content: String!
    contentType: String!
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
    codexInstructions: String!
    documents: [LegalDocument!]!
  }

  type Query {
    health: Health!
    legalDocuments(query: String, fileName: String, limit: Int = 10): [LegalDocument!]!
    ragReferenceBundle(
      query: String
      requestedText: String
      medium: String = "markdown"
      limit: Int = 10
    ): RagReferenceBundle!
  }

  type Mutation {
    ingestDocuments(fileLocation: String!): IngestionResult!
  }
`;
