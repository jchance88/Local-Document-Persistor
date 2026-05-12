# Legal Reference Server

Node.js GraphQL service backed by OpenSearch for legal reference document retrieval and ingestion.

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
Deploy this legal-reference-server app. Use AGENTS.md, start Docker/OpenSearch, run the deployment script, verify GraphQL health, then ask me whether I want to ingest a file or create a document from indexed material.
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
- A document type or output medium to create from indexed material, such as `plain_text`, `markdown`, `pdf`, `email`, `memo`, `brief`, or `motion`.

If you provide both, the agent should ingest the file first, then call `ragReferenceBundle` and use the returned OpenSearch data as RAG context for the requested output.

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
  ingestDocuments(fileLocation: "sample-motion.txt") {
    fileName
    status
    reason
  }
}
```

## Query Reference Documents

```graphql
query {
  legalDocuments(query: "motion", limit: 5) {
    fileName
    title
    highlights
    content
  }
}
```

## Retrieve RAG Context For Codex

Use `ragReferenceBundle` when you want the server to return OpenSearch index data and instructions that Codex can use to generate the requested text. The server does not call an LLM; it retrieves references and formats the RAG handoff.

```graphql
query {
  ragReferenceBundle(
    query: "complaint"
    requestedText: "Draft a short filing summary"
    medium: "memo"
    limit: 3
  ) {
    medium
    codexInstructions
    documents {
      fileName
      title
      content
      highlights
    }
  }
}
```

Supported medium values include `plain_text`, `markdown`, `pdf`, `email`, `memo`, `brief`, and `motion`. Unknown values fall back to `markdown`.

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
