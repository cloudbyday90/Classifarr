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
  loadPublishedDigestConsumerSmokeCompose,
  validatePublishedDigestConsumerSmokeCompose,
} from '../../scripts/checkPublishedDigestConsumerSmokeCompose.mjs';

describe('checkPublishedDigestConsumerSmokeCompose', () => {
  test('accepts the checked-in isolated consumer smoke Compose contract', () => {
    expect(
      validatePublishedDigestConsumerSmokeCompose(loadPublishedDigestConsumerSmokeCompose())
    ).toEqual({
      imageInput: '${CLASSIFARR_RELEASE_SMOKE_IMAGE:?A published image digest is required.}',
      serviceName: 'classifarr',
      volumeName: 'classifarr_release_smoke_data',
    });
  });

  test('rejects a host port that could expose or collide with an installation', () => {
    const compose = structuredClone(loadPublishedDigestConsumerSmokeCompose());
    compose.services.classifarr.ports = ['21324:21324'];

    expect(() => validatePublishedDigestConsumerSmokeCompose(compose))
      .toThrow('compose.services.classifarr.ports must be absent');
  });

  test('rejects a build fallback that could substitute unverified local source', () => {
    const compose = structuredClone(loadPublishedDigestConsumerSmokeCompose());
    compose.services.classifarr.build = '.';

    expect(() => validatePublishedDigestConsumerSmokeCompose(compose))
      .toThrow('compose.services.classifarr.build must be absent');
  });
});
