# Isolated test fixture only. This image contains no application source,
# credentials, media-server integrations, or writable application state.
FROM node:24.22.1-alpine3.24@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53

WORKDIR /app
COPY --chown=node:node scripts/docker/ollama-fault-provider-stub.mjs ./ollama-fault-provider-stub.mjs

USER node
EXPOSE 11434

CMD ["node", "./ollama-fault-provider-stub.mjs"]
