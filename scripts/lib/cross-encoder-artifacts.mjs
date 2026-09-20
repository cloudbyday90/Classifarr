/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { CROSS_ENCODER_REVISION } from '../../server/src/services/localCrossEncoderConfig.mjs';
export const CROSS_ENCODER_ARTIFACTS = Object.freeze([
  { name: 'config.json', maxBytes: 4096, sha256: '289adf7ada1eb6b4afa7589a48a032d45a076cf2e46dcdb3b4cabc33be14f708' },
  { name: 'tokenizer.json', maxBytes: 20_000_000, sha256: '9eb652ac4e40cc093272bbbe0f55d521cf67570060227109b5cdc20945a4489e' },
  { name: 'model.safetensors', maxBytes: 1_200_000_000, sha256: 'ced967c45fd1902eb92716c9ceeca7c95a936770ea9db611f5a841b926e33fbd' },
].map(row => Object.freeze({ ...row, url: `https://huggingface.co/BAAI/bge-reranker-base/resolve/${CROSS_ENCODER_REVISION}/${row.name}` })));
