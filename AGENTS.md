# AGENTS.md

## Purpose

This repository is a Node.js server application for local document retrieval and ingestion. Codex agents must preserve the accepted stack and architecture unless the user explicitly approves a change.

## Accepted Stack

- Runtime: Node.js 20+
- API boundary: GraphQL via Apollo Server
- Search and document store: OpenSearch
- Packaging and deployment: Docker and Docker Compose
- Language: JavaScript ES modules

## Accepted Libraries

- `@apollo/server`: GraphQL API server.
- `@opensearch-project/opensearch`: OpenSearch client.
- `dotenv`: Environment loading.
- `docx`: Word document export for model-generated text.
- `graphql`: GraphQL runtime.
- `pdf-parse`: PDF text extraction for ingestion and document-processing workflows.
- `pdfkit`: PDF export for model-generated text.

## Local Machine Requirements

- Docker Desktop must be installed on macOS development machines unless the user explicitly approves another Docker-compatible runtime.
- Before running `npm run dev` or `./scripts/deploy.sh`, verify Docker Desktop is running with `docker info`.
- If Docker Desktop is missing and Homebrew is available, install it with `brew install --cask docker`, then open Docker Desktop once so the daemon starts.

Do not add REST endpoints, databases, queues, ORMs, alternate search engines, or framework replacements without explicit user approval.

## Architecture Rules

- GraphQL schema changes belong in `src/graphql/schema.js`.
- GraphQL resolver wiring belongs in `src/graphql/resolvers.js`.
- Resolver functions must stay thin and delegate business logic to services under `src/services`.
- OpenSearch connection and index lifecycle code belongs under `src/opensearch`.
- File path validation belongs in `src/utils/fileSafety.js` or a closely related utility.
- New endpoints must be GraphQL queries or mutations.
- Any new ingestion path must check for an existing `fileName` in OpenSearch before indexing.
- File ingestion must stay constrained to `DOCUMENT_ROOT`.
- Search behavior must go through OpenSearch; do not scan local files to answer retrieval queries.
- RAG-style generation support must return OpenSearch-sourced context and Codex instructions; do not add an LLM provider unless the user explicitly approves expanding the stack.
- Do not create standalone generator scripts or new one-off files to generate requested prose.
- Treat the selected Codex model as the lightweight RAG generation resource: retrieve context through the server, let Codex draft the requested text from that context, and keep server logic focused on parsing, validating, and formatting that model-generated text into the requested medium.
- If a requested output needs a format such as PDF or Word, the app must use reusable server formatting/parsing logic rather than file-specific generation scripts.
- Before creating a final exported file, Codex must ask the user which export format they want unless the user already specified one. Supported final export formats are PDF and Word (`.docx`).

## Existing Flows

1. Retrieval flow: Codex calls GraphQL `legalDocuments`; the resolver delegates to the search service; OpenSearch returns matching documents for local document use.
2. Ingestion flow: Codex calls GraphQL `ingestDocuments`; the service resolves the file under `DOCUMENT_ROOT`; OpenSearch is checked for the file name; existing files are skipped and new files are indexed.
3. RAG reference flow: Codex calls GraphQL `ragReferenceBundle` with a search query, requested text, output medium, and optional export format; the server returns index data plus Codex-ready instructions, Codex generates the substantive text from the returned references, and server logic parses/formats the generated text into PDF or Word when requested.
4. Export flow: Codex calls GraphQL `exportGeneratedDocument` after generating text and confirming the user's desired final format. The export service writes the formatted file under `EXPORT_OUTPUT_ROOT` or `./generated`.

## One-Shot Deployment For Codex

From the repository root:

```bash
./scripts/deploy.sh
```

The script must start OpenSearch first, wait for it to become healthy, and then start the GraphQL API.

After deployment is healthy, Codex must prompt the user for the next workflow before taking further action:

1. Ask whether the user wants to ingest source material or create a document from indexed material.
2. If the user wants ingestion, ask for a file address/path under `DOCUMENT_ROOT`, then call the `ingestDocuments` mutation.
3. If the user wants document creation, ask what type of document or medium they want, such as `plain_text`, `markdown`, `pdf`, `docx`, `email`, `memo`, `brief`, or `motion`; then ask what final export format they want, PDF or Word, unless they already specified it.
4. If the user gives both a file path and a document type up front, ingest first, then retrieve RAG context and generate the requested output.
5. If the user wants a saved final file, call `exportGeneratedDocument` with the generated text and confirmed format.

Do not assume the user's next step after deployment. Always gather either a file address/path or the requested document type/medium, and ask for the export format before writing a final file.

For local development, use:

```bash
npm run dev
```

The dev script starts only the Docker OpenSearch service, waits for health, and then runs Node.js on the host with `OPENSEARCH_NODE=http://localhost:9200`.

Then verify:

```bash
curl -s http://localhost:4000/graphql \
  -H 'content-type: application/json' \
  --data '{"query":"query { health { ok service } }"}'
```

To ingest the included sample document:

```bash
curl -s http://localhost:4000/graphql \
  -H 'content-type: application/json' \
  --data '{"query":"mutation { ingestDocuments(fileLocation: \"sample-motion.txt\") { fileName status reason } }"}'
```

To query references:

```bash
curl -s http://localhost:4000/graphql \
  -H 'content-type: application/json' \
  --data '{"query":"query { legalDocuments(query: \"motion\", limit: 5) { fileName title highlights } }"}'
```

To retrieve RAG context for Codex:

```bash
curl -s http://localhost:4000/graphql \
  -H 'content-type: application/json' \
  --data '{"query":"query { ragReferenceBundle(query: \"complaint\", requestedText: \"Draft a short filing summary\", medium: \"memo\", limit: 3) { medium codexInstructions documents { fileName title highlights } } }"}'
```

## Change Discipline

- Keep changes scoped to the requested behavior.
- Update this file when architecture or deployment rules change.
- Update `README.md` when commands, environment variables, or GraphQL operations change.
- Do not commit secrets or real legal documents.
