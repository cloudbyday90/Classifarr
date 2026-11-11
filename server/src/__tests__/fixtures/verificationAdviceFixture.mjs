/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { policyRecoveryReferenceFixture } from './policyRecoveryReferenceFixture.mjs';
import { holdPolicyVerificationAdvice, createPolicyVerificationAdviceSession } from '../../services/policyVerificationAdvice.mjs';

export function verificationProfile() {
  return { totalItems: 10,
    observation: { version: 'library.profile_observation.v1', population: 'inventory_rows', itemCount: 10,
      traits: Object.fromEntries(['rating', 'genres', 'studio', 'keywords', 'language'].map(key => [key, { observedCount: 7, unknownCount: 3 }])) },
    certificationDistribution: [{ certification: 'PG', percentage: 70 }],
    genreDistribution: [{ genre: 'Owned profile observation', percentage: 70 }],
    studioDistribution: [{ studio: 'Owned studio', percentage: 50 }],
  };
}

export async function verificationAdviceFixture(options) {
  const fixture = await policyRecoveryReferenceFixture(options);
  const token = holdPolicyVerificationAdvice(fixture.args);
  return { ...fixture, adviceToken: token, session: createPolicyVerificationAdviceSession(token, fixture.args) };
}
