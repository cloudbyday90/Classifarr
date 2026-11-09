# Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
# Test-only compiler stage. Nothing here is installed into the candidate.
ARG BASE_IMAGE=node:24.22.1-alpine3.24@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53
FROM ${BASE_IMAGE} AS compiler
RUN apk add --no-cache gcc musl-dev zlib-dev=1.4-r0
COPY scripts/fixtures/systemZlib/probe.c /probe.c
RUN cc -std=c11 -D_GNU_SOURCE -Wall -Wextra -Werror -O2 /probe.c -lz -ldl -o /zlib-probe
FROM scratch AS artifact
COPY --from=compiler /zlib-probe /zlib-probe
