FROM node:20-alpine AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:20-alpine AS backend-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --only=production

FROM node:20-alpine
WORKDIR /app
COPY --from=backend-builder /app/server/node_modules ./node_modules
COPY server/ ./
COPY --from=frontend-builder /app/client/dist ./public
ENV NODE_ENV=production
EXPOSE 21324
CMD ["node", "src/index.js"]
