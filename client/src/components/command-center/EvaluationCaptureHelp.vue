<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <details class="capture-help">
    <summary>How to check AI-response capture</summary>
    <p>
      Policy replay can run without AI calls. Supported AI comparisons need cached responses;
      creating them requires an administrator to opt in with daily limits.
    </p>
    <p>
      Open the Classifarr container console (Unraid: Docker → Classifarr → Console), then run
      this read-only status command:
    </p>
    <pre><code>node /app/src/scripts/runOperatorCorrectionPolicyEvaluation.mjs --source-pair-ai-budget-status</code></pre>
    <p>
      Opening this help or running the status command does not enable capture.
      Read the <a
        href="https://github.com/cloudbyday90/Classifarr/blob/main/docs/operations/evaluation-ai-capture.md"
        target="_blank"
        rel="noopener noreferrer"
      >AI-response capture guide (opens in a new tab)</a>
      before changing limits. It covers prerequisites, disabling capture and checking results.
      Do not reset imports or turn off memory safeguards to fill response-cache gaps.
    </p>
  </details>
</template>

<script setup>
defineOptions({ name: 'EvaluationCaptureHelp' })
</script>

<style scoped>
.capture-help { margin-top: .75rem; font-size: .875rem; line-height: 1.5; }
summary { cursor: pointer; }
summary:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
p, pre { margin-top: .5rem; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; }
a { text-decoration: underline; }
</style>
