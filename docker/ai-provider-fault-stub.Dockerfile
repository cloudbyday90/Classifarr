# Isolated test fixture only. This image contains no application source,
# credentials, media-server integrations, or writable application state.
FROM node:24.22.3-alpine3.24@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5
RUN apk add --no-cache zlib=1.4-r0 \
    && apk info --exists zlib=1.4-r0

WORKDIR /app
COPY --chown=node:node scripts/docker/ollama-fault-provider-stub.mjs ./ollama-fault-provider-stub.mjs

USER node
EXPOSE 11434

CMD ["node", "./ollama-fault-provider-stub.mjs"]
