# Local-Document-Persistor

Node.js GraphQL service backed by OpenSearch for local document retrieval and ingestion.

## Architecture

- Codex or another client calls the GraphQL endpoint.
- `legalDocuments` queries OpenSearch and returns matching indexed documents as reference material.
- `ingestDocuments` accepts a file location under `DOCUMENT_ROOT`.
- The ingestion service checks OpenSearch for an existing `fileName`.
- If the file name exists, ingestion is skipped.
- If the file name does not exist, the file is read and indexed.

## One-Shot Local Deployment

```bash
./scripts/deploy.sh
```

This starts OpenSearch first, waits for it to report healthy, then starts the GraphQL API.

GraphQL runs at `http://localhost:4000/graphql`.

You need a Docker-compatible runtime for the one-shot deployment. On macOS, Docker Desktop is the simplest option, but Colima, Rancher Desktop, or another runtime is fine as long as `docker compose` works.

## Deploy Via Coding Agent

Ask the coding agent to deploy the app from the repository root:

```text
Deploy this Local-Document-Persistor app. Use AGENTS.md, start Docker/OpenSearch, run the deployment script, verify GraphQL health, then ask me whether I want to ingest a file or create a document from indexed material.
```

The coding agent should run:

```bash
./scripts/deploy.sh
```

Then it should verify:

```bash
curl -s http://localhost:4000/graphql \
  -H 'content-type: application/json' \
  --data '{"query":"query { health { ok service } }"}'
```

After verification, the agent should ask for one of these:

- A file address/path under `DOCUMENT_ROOT` to ingest with `ingestDocuments`.
- A document type or output medium to create from indexed material, such as `plain_text`, `markdown`, `pdf`, `docx`, `email`, `memo`, `brief`, or `motion`.
- A final export format for saved files: PDF or Word (`.docx`).

If you provide both, the agent should ingest the file first, then call `ragReferenceBundle` and use the returned OpenSearch data as RAG context for the requested output.
Before writing a final file, the agent should ask whether you want the response exported as PDF or Word unless you already specified the format.

## Local Development

```bash
npm run dev
```

This starts the Docker OpenSearch service only, waits for it to become healthy, then runs the Node.js GraphQL API on your host in watch mode. Local dev uses `http://localhost:9200` for OpenSearch and `./sample-documents` for ingestion files.

## Shutdown

Stop the API and OpenSearch containers:

```bash
npm run shutdown
```

or:

```bash
./scripts/shutdown.sh
```

This preserves the OpenSearch Docker volume, so indexed documents remain available next time you deploy. To stop everything and delete indexed data, run:

```bash
docker compose down -v
```

## Ingest A Document

The default Docker Compose file mounts `./sample-documents` to `/documents`.

```graphql
mutation {
  ingestDocuments(fileLocation: "sample-motion.txt", force: false) {
    fileName
    status
    reason
  }
}
```

Set `force: true` to delete existing indexed records with the same `fileName` and reindex the file, which is useful after parser or chunking changes.

## Query Reference Documents

```graphql
query {
  legalDocuments(
    queries: [
      "prisoner civil rights conditions confinement"
      "42 U.S.C. 1983 state actors administrative remedies"
      "grievance exhaustion constitutional violation"
    ]
    limit: 5
  ) {
    fileName
    title
    heading
    keywords
    chunkIndex
    chunkCount
    highlights
    content
  }
}
```

Documents are chunked during ingestion. Search results are ranked chunks with document metadata, headings, extracted keywords, highlights, and chunk positions.

## Retrieve RAG Context For Codex

Use `ragReferenceBundle` when you want the server to return OpenSearch index data and instructions that Codex can use to generate the requested text. The server does not call an LLM; it retrieves references and formats the RAG handoff.

```graphql
query {
  ragReferenceBundle(
    queries: [
      "complaint federal court jurisdiction relief"
      "short plain statement claim defendant harm"
      "civil lawsuit pro se filing facts"
    ]
    requestedText: "Draft a short filing summary"
    medium: "memo"
    exportFormat: "pdf"
    limit: 3
  ) {
    medium
    exportFormat
    supportedExportFormats
    codexInstructions
    documents {
      fileName
      title
      heading
      keywords
      chunkIndex
      chunkCount
      content
      highlights
    }
  }
}
```

Supported medium values include `plain_text`, `markdown`, `pdf`, `docx`, `word`, `email`, `memo`, `brief`, and `motion`. Unknown values fall back to `markdown`.

## Plan A Semantic Retrieval Query

Use `semanticQueryPlanBundle` when the user describes the kind of context they want, but does not know the best search terms. The server returns indexed document summaries and an OpenSearch query template. Codex uses that inventory to generate 3-5 lexical retrieval queries, then calls `ragReferenceBundle(queries: [...])` and uses that response for the final result.

```graphql
query {
  semanticQueryPlanBundle(
    semanticRequest: "Find documents about prisoner access to civil rights claims and court accountability"
    requestedText: "Write a two-page thesis"
    medium: "pdf"
    exportFormat: "pdf"
    limit: 10
  ) {
    semanticRequest
    opensearchQueryTemplate
    codexInstructions
    documents {
      fileName
      title
      preview
    }
  }
}
```

Recommended Codex flow:

1. Call `semanticQueryPlanBundle` with the user's natural-language context request.
2. Generate several OpenSearch/BM25 retrieval queries from the returned document inventory.
3. Call `ragReferenceBundle` with those generated queries.
4. Rerank the returned chunks for direct relevance.
5. Generate the final answer from the documents returned by `ragReferenceBundle`.
6. Ask for PDF or Word if the user has not specified a final export format, then call `exportGeneratedDocument`.

## Phase 1 Semantic Matching Without Embeddings

Local-Document-Persistor does not require an embedding API key. Phase 1 semantic matching uses:

- Chunked indexing during ingestion.
- Searchable headings and extracted keywords per chunk.
- BM25 keyword search in OpenSearch.
- Boosted fields: title, file name, heading, keywords, and chunk content.
- Multi-query retrieval generated by Codex from the user's semantic request.
- Codex reranking over the returned chunks before final drafting.

## Export Generated Text

Use `exportGeneratedDocument` after Codex has generated the text and the user has confirmed a final export format. The server parses simple generated text into headings, paragraphs, and bullets, then writes PDF or Word output under `EXPORT_OUTPUT_ROOT` or `./generated`.

```graphql
mutation {
  exportGeneratedDocument(
    title: "Civil Rights Thesis"
    format: "docx"
    fileName: "civil-rights-thesis"
    text: "Civil Rights Thesis\n\nThis is the generated response text."
  ) {
    format
    fileName
    filePath
    contentType
    sizeBytes
  }
}
```

Supported export formats are `pdf`, `docx`, and `word` as an alias for `docx`.

## Deploy In Another Environment

1. Copy this repository to the target environment.
2. Create an `.env` from `.env.example`.
3. Set `OPENSEARCH_NODE` to the target OpenSearch endpoint.
4. Set `OPENSEARCH_USERNAME` and `OPENSEARCH_PASSWORD` when OpenSearch security is enabled.
5. Set `OPENSEARCH_INDEX` if you do not want the default `legal_documents`.
6. Set `DOCUMENT_ROOT` to the directory mounted into the container that contains ingestible files.
7. Run `./scripts/deploy.sh`.

For managed OpenSearch, remove the `opensearch` service from `docker-compose.yml` or override it with an environment-specific compose file, then point `OPENSEARCH_NODE` at the managed cluster.

## Important Notes

- Ingestion intentionally uses `fileName` as the duplicate check because that is the requested contract.
- File locations are resolved inside `DOCUMENT_ROOT`; paths outside that root are rejected.
- This starter reads text-like files as UTF-8. Add a parser service before ingestion if PDF, DOCX, OCR, or metadata extraction is needed.
