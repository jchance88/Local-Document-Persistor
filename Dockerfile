FROM node:20-bookworm-slim AS base

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

EXPOSE 4000
CMD ["node", "src/index.js"]
