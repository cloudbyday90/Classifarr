# Embedding response budgets design

Date: 2026-09-07. Follow-up to the
[buffered cancellation outcome](buffered-http-cancellation-outcome.md).

## Existing contracts

Classifarr asks for one text or image embedding per HTTP request. Backfill and
image concurrency settings schedule separate requests; they do not create provider
HTTP batches. The dedicated cloud helper covers OpenAI, Gemini, Voyage, OpenRouter
and Cohere. Same-provider mode uses cloudLLMEmbeddings for OpenAI-compatible
providers (including LiteLLM/custom) and Gemini. Ollama has direct-host and shared
service paths plus an embedding warmup request. Image providers cover a local
sidecar, Vertex, Voyage and Cohere. All currently buffer embedding responses
without a byte budget, even though the shared HTTP client already supports one.

## Decision and sizing

Add a small ESM embedding HTTP service that applies a fixed **4 MiB decoded-body
budget** to every embedding POST above. Its budget cannot be overridden through
caller options. Reuse the shared HTTP client's streaming byte enforcement,
cancellation, deadlines and transport cleanup. Preserve request payloads and
response parsers; this change neither migrates models nor truncates vectors.

The budget is an application safety boundary, not a provider quota or a maximum
dimension claim. Registered text models currently reach 3,072 dimensions; the
reviewed current hosted models below also fit well within the boundary. Test
provider-shaped finite vectors at those dimensions and a deliberately larger
16,384-dimension compatibility fixture, with long numeric representations, pretty
JSON, multibyte text and a 1 MiB echoed text field. The latter leaves substantial
headroom within 4 MiB for response metadata and formatting. Measure actual encoded
fixture bytes rather than assuming four bytes per JSON number.

No finite cap preserves arbitrary custom-provider payloads: unusually verbose or
larger-than-budget responses now fail explicitly. The compatibility fixture is
not a claim that every possible numeric spelling, whitespace layout or provider
extension fits. Larger legitimate contracts require a deliberate budget review.
Do not derive the cap from upstream Content-Length, returned dimensions, input
text length or untrusted response metadata. A provider's advertised batch maximum
does not justify buffering unused vectors in a single-item caller.

## Official research

Sources were discovered and read with web tools on September 7, 2026. Living
documentation may change; no later-September state is claimed.

| Source | Relevant contract and application |
| --- | --- |
| [OpenAI vector embeddings](https://developers.openai.com/api/docs/guides/embeddings) | Float-array examples; default dimensions of 1,536 and 3,072 for the registered embedding-3 models. Keep numeric response shapes. |
| [Google Gemini embeddings](https://ai.google.dev/gemini-api/docs/embeddings?authuser=2&hl=en) | Current embeddings support up to 3,072 dimensions. This sizing review does not change Classifarr's configured/default model. |
| [Voyage text embeddings](https://docs.voyageai.com/reference/embeddings-api-1) | String or list inputs and numeric output; reviewed newer models allow up to 2,048 dimensions. Classifarr uses single inputs. |
| [Voyage multimodal embeddings](https://docs.voyageai.com/docs/multimodal-embeddings) | Reviewed multimodal-3.5 dimensions reach 2,048. Endpoint/payload migration is separate from response sizing. |
| [Cohere embeddings](https://docs.cohere.com/docs/embeddings) | Float and other representations exist; current v4 dimensions reach 1,536. Preserve the current v1 float-array parser and allow response overhead. |
| [OpenRouter embedding API](https://openrouter.ai/docs/api/api-reference/embeddings/submit-an-embedding-request) | Model-dependent dimensions and float/base64 response encodings. No universal custom-model maximum is assumed. |
| [Ollama embed API](https://docs.ollama.com/api/embed) | String or array inputs and an embeddings array; length depends on model. Existing single-item and warmup calls share the boundary. |
| [Vertex multimodal model](https://docs.cloud.google.com/python/docs/reference/vertexai/latest/vertexai.vision_models.MultiModalEmbeddingModel) | Image/text dimensions include 128, 256, 512 and 1,408. The current image caller sends one instance. |
| [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) | Document API behavior and compatible evolution. Keep public endpoints and valid response envelopes stable; document the new failure boundary. |
| [OWASP API4 resource consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/) | Bound resource use and third-party interaction costs. Our application of this guidance is to enforce decoded bytes before full allocation/parsing and avoid immediate retries for size failures. |

The Cohere v1 reference exceeded the web tool's page-size limit; the smaller
official guide was read instead. Provider dimensions establish sizing context,
not live validation of every provider endpoint or configured account.

## Failure behavior and boundaries

Oversized success/error/compressed bodies throw the existing
HTTP_RESPONSE_TOO_LARGE error with a fixed message and numeric budget only. Keep
that error intact through embedding wrappers. No response parsing, cost-success
recording or vector return occurs after this failure. The existing retry utility
does not classify the error as transient. Existing higher-level background retry,
fallback and circuit policies remain in effect; fallback requests receive the
same byte protection. Warmup reports its existing failure envelope with the code.

The cap counts decoded bytes, regardless of Content-Length or compression ratio.
It bounds retained response bytes and parser input, not total process memory,
concurrent allocations, request uploads or decompression CPU. Image downloads
retain their separate 10 MiB input limit. Model lists, inventory pages, generated
content and caller-owned streaming responses are separate contracts. No new
configuration, database migration, public API or operator action is introduced.

## Alternatives and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Shared embedding POST with 4 MiB budget | Uniform coverage, ample single-vector margin, no operator input | Custom responses above the boundary fail | Implement |
| Small per-model exact caps | Tighter memory bound | Model catalog drift and variable numeric/metadata size cause false failures | Defer until justified by measurements |
| Universal HTTP cap | Broad coverage | Can break inventory and generation contracts | Reject for this change |
| Post-buffer size check | Easy to add | Allocation already occurred | Reject |
| Operator-configured limits | Accommodates unusual providers | More operational burden and easy loss of protection | Unnecessary for supported shapes |

Recommended stack: existing TLS and caller cancellation/deadlines; shared embedding
POST budget; bounded decoded-byte reader; preserved size errors; existing retry
and provider policies. Follow with semantic vector validation before metrics or
storage. Byte limits alone cannot establish vector shape, finite values, dimension
agreement or model-space compatibility. Inventory observations and independent
study readiness remain authoritative; no classification routing changes follow
from this transport work.

## Validation plan

Measure supported and expanded provider-shaped fixtures; run exact-boundary,
over-budget, compressed/error-body, interrupted-read and cancellation cases.
Exercise every embedding path and confirm that generation/model-list calls retain
their existing contract. Verify that failed transfers produce no success cost
record and no immediate retry. Run backend checks, rebuild Compose without cache,
and use local fixtures plus authenticated read-only smoke checks without paid
provider calls. Record results separately in the outcome document.
