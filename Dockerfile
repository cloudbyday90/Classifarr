FROM node:20-alpine AS builder

WORKDIR /app

# Build backend
COPY server/package*.json ./server/
RUN cd server && npm ci

# Build frontend
COPY client/package*.json ./client/
RUN cd client && npm ci

COPY server ./server
COPY client ./client

RUN cd client && npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./server/public

WORKDIR /app/server

ENV NODE_ENV=production

EXPOSE 21324

CMD ["node", "src/index.js"]
