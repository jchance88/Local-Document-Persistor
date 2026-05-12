import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { env } from './config/env.js';
import { typeDefs } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers.js';
import { ensureDocumentIndex } from './opensearch/index.js';

async function main() {
  await ensureDocumentIndex();

  const server = new ApolloServer({
    typeDefs,
    resolvers
  });

  const { url } = await startStandaloneServer(server, {
    listen: {
      port: env.port
    }
  });

  console.log(`Legal reference GraphQL service ready at ${url}`);
}

main().catch((error) => {
  console.error('Failed to start legal reference service.');
  console.error(error);
  process.exit(1);
});
