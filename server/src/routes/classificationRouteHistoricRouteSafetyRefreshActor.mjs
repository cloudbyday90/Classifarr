/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ForbiddenError } from '../utils/appError.mjs';
import {
  getHistoricRouteSafetyRefreshActorId,
} from '../services/policyRuntimeHistoricRouteSafetyRefreshActorIdentity.mjs';

/**
 * Historic maintenance receipts are relationship-bound objects. An admin role
 * grants access to the maintenance feature, while this server-derived actor
 * reference grants access to that actor's receipt only.
 */
export function requireHistoricRouteSafetyRefreshActorId(user) {
  const actorId = getHistoricRouteSafetyRefreshActorId(user);
  if (!actorId) {
    throw new ForbiddenError('A stable authenticated administrator identity is required.', {
      code: 'historic_route_safety_refresh_actor_identity_required',
    });
  }

  return actorId;
}
