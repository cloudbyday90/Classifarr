# Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
# Test-only compiler stage. Nothing here is installed into the candidate.
ARG BASE_IMAGE=node:24.22.3-alpine3.24@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5
FROM ${BASE_IMAGE} AS compiler
RUN apk add --no-cache gcc musl-dev zlib-dev=1.4-r0
COPY scripts/fixtures/systemZlib/probe.c /probe.c
RUN cc -std=c11 -D_GNU_SOURCE -Wall -Wextra -Werror -O2 /probe.c -lz -ldl -o /zlib-probe
FROM scratch AS artifact
COPY --from=compiler /zlib-probe /zlib-probe
