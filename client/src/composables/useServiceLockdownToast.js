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

import { useRouter } from 'vue-router'
import { SERVICE_SETTINGS_MAP, SERVICE_NAMES } from '@/constants/serviceConfig'

/**
 * Composable for showing service lockdown dialogs
 * Shows a browser confirm dialog with option to navigate to settings
 */
export function useServiceLockdownDialog() {
  const router = useRouter()

  /**
    * Show lockdown dialog for a service
   * @param {string} serviceKey - The service key (e.g., 'aiProvider', 'mediaServer')
   * @returns {boolean} - True if user confirmed to go to settings
   */
  const showLockdownNotification = (serviceKey) => {
    const serviceName = SERVICE_NAMES[serviceKey] || serviceKey
    const settingsUrl = SERVICE_SETTINGS_MAP[serviceKey]
    
    const message = `${serviceName} is required to use this feature.\n\nWould you like to configure it now?`
    
    const confirmed = window.confirm(message)
    
    if (confirmed && settingsUrl) {
      router.push(settingsUrl)
      return true
    }
    
    return false
  }

  return {
    showLockdownNotification
  }
}
