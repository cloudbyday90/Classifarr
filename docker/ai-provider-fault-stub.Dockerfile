# Isolated test fixture only. This image contains no application source,
# credentials, media-server integrations, or writable application state.
FROM node:24.18.1-alpine3.24

WORKDIR /app
COPY --chown=node:node scripts/docker/ollama-fault-provider-stub.mjs ./ollama-fault-provider-stub.mjs

USER node
EXPOSE 11434

CMD ["node", "./ollama-fault-provider-stub.mjs"]
