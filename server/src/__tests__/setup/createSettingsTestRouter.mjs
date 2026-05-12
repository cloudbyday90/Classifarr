import { createSettingsRouterWithDefaults } from '../../routes/settings.mjs';
function createSettingsTestRouter(express, dependencyOverrides = {}) {
  return createSettingsRouterWithDefaults({
    express,
    ...dependencyOverrides,
  });
}

export {
  createSettingsTestRouter,
};
