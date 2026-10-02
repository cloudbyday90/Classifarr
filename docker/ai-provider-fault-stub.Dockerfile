# Isolated test fixture only. This image contains no application source,
# credentials, media-server integrations, or writable application state.
FROM node:24.21.0-alpine3.24@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1

WORKDIR /app
COPY --chown=node:node scripts/docker/ollama-fault-provider-stub.mjs ./ollama-fault-provider-stub.mjs

USER node
EXPOSE 11434

CMD ["node", "./ollama-fault-provider-stub.mjs"]
