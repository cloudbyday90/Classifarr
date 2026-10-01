/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function compatibleMaintenanceEnvironment() {
  return { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: '/tmp', LANG: 'C.UTF-8', TZ: 'UTC',
    NODE_ENV: 'production', NODE_OPTIONS: '--max-old-space-size=512',
    LOG_LEVEL: 'silent', FILE_LOGGING_ENABLED: 'false', CLASSIFARR_RUNTIME_MODE: 'normal',
    CLASSIFARR_SCHEMA_MAINTENANCE: 'startup', POSTGRES_HOST: 'localhost', POSTGRES_PORT: '5432',
    POSTGRES_DB: 'classifarr', POSTGRES_USER: 'classifarr', POSTGRES_POOL_MAX: '2' };
}
