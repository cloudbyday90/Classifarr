/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {
  findDeliveryTermMatches,
} from '../../../../scripts/lib/policyDeliveryTermMatcher.mjs';

describe('policyDeliveryTermMatcher', () => {
  test('finds phase labels, codes, and roadmap-shaped identifiers without duplicate overlap', () => {
    expect(findDeliveryTermMatches([
      'const phaseLabel = "Phase 9R";',
      'const code = "R6";',
      'const contract = POLICY_PHASE9R_CONTRACT;',
    ].join('\n'))).toEqual([
      expect.objectContaining({
        matcherId: 'phase_label',
        token: 'Phase 9R',
        lineNumber: 1,
      }),
      expect.objectContaining({
        matcherId: 'phase_code',
        token: 'R6',
        lineNumber: 2,
      }),
      expect.objectContaining({
        matcherId: 'roadmap_identifier',
        token: 'POLICY_PHASE9R_CONTRACT',
        lineNumber: 3,
      }),
    ]);
  });

  test('does not treat durable stage terminology or ordinary versions as delivery terms', () => {
    expect(findDeliveryTermMatches([
      'const currentStage = "routing";',
      'const contractVersion = "v1";',
      'const source = "policy intent";',
    ].join('\n'))).toEqual([]);
  });
});
