# Best Practices Research Log: ES Modules, Modular Services, and Vue 3 Composables

This document details the design recommendations, pros and cons, final architecture stack, and security decisions for Classifarr's settings management system, aligned with best practices as of May 2026.

---

## 1. Vue 3 Composable Design Patterns (May 2026)

### Recommendations
*   **Explicit Data Flow**: Inputs to the composable must be explicitly passed as parameters; outputs must be returned as reactive variables or functions.
*   **Options Objects for Parameters**: If a composable requires more than 2-3 arguments, pass a single options configuration object.
*   **Encapsulate Side Effects**: Do not execute external side effects on imports. Clean up lifecycle hooks (`onUnmounted`) for event handlers or timers inside the composables.
*   **Thin Views**: Keep component views (`.vue` templates) clean, delegating all form logic, API operations, and toast messaging to the composable service layer.

### Pros vs. Cons
*   **Pros**:
    *   **Maximized Reusability**: Merges duplicate Radarr/Sonarr view scripts into one maintainable module.
    *   **Unit Testability**: Business logic can be tested in isolation without mounting the DOM tree.
    *   **Clean Markup**: Vue files are reduced to template layout and unique static arrays.
*   **Cons**:
    *   **Indirection**: Developers must look in `src/composables` to find the implementation of event handlers.
    *   **Destructuring Reactivity Risk**: Care must be taken not to destructure primitives without `ref`/`toRefs`.

---

## 2. ES Module Service Architecture vs. Singleton Classes

### Recommendations
*   **Native Module Caching**: Avoid classical class-based Singleton boilerplate (`class Singleton { static getInstance() }`). ESM naturally evaluates modules once; exporting a constant instance, factory function, or module-level variables provides native singleton behavior.
*   **Factory-Based Dependency Injection**: Use factory functions (e.g., `createArrConfigService({ db, table })`) rather than importing global singletons. This makes mocking the database or service layers trivial in tests.
*   **Immutability**: Freeze exported objects (`Object.freeze`) if they represent static settings or configuration shapes to prevent runtime pollution.

### Pros vs. Cons
*   **Pros**:
    *   **Native ESM Performance**: Exploits Node.js static evaluation and fast imports.
    *   **Zero Boilerplate**: Simpler syntax and lower cognitive overhead compared to class containers.
    *   **Explicit Dependency Injections**: Eases unit and integration testing.
*   **Cons**:
    *   **State Leakage risk**: Module-level state variables are shared globally across the module scope. Care must be taken to prevent cross-request leakage.

---

## 3. Security Architecture (Credential Masking and Client-Server Transmission)

### Recommendations
1. **API Key Token Masking**: Keep the full credentials in the secure database. The client only receives the masked value (`******`).
2. **Safe Update Resolvers**: The backend must intercept incoming updates. If the submitted key matches the masked value, the database must not overwrite the existing record. Instead, it must keep the stored credentials.
3. **Targeted Backend Resolvers**: The `testConfig` connection verification resolver must accept the masked key, match it using the database record ID, load the decrypted original key, and perform the live connection test safely.
4. **Transport Layer Alerts**: Provide feedback/validation when users configure links using insecure protocols (HTTP) over non-loopback remote addresses.

### Pros vs. Cons
*   **Pros**:
    *   **Prevent Secret Exposure**: Keys are never visible in frontend inspect panels, DOM nodes, or local storage.
    *   **Seamless Editing**: Users can edit mappings and settings without re-typing credentials.
*   **Cons**:
    *   **API Complexity**: Requires the backend to check if tokens are masked and query storage for the real credentials.

---

## 4. Final Recommendation Stack

Aligned with the findings, we choose the following architecture stack:

| Component Layer | Technology / Pattern | Rationale |
| :--- | :--- | :--- |
| **Logic Layer (Frontend)** | Vue 3 Composition Composable (`useArrConfig.js`) | Eliminates ~400 lines of duplicate script logic between Radarr and Sonarr views. |
| **Transport Format** | Pure ES Modules (`import`/`export`) | Native to modern Node.js and Vite build configurations. No CommonJS overrides. |
| **Dynamic Routing** | ESM Static Registry Mapper | Maps client operations dynamically to Radarr/Sonarr REST handlers. |
| **Lifecycle Cleanup** | Vue `nextTick` + smooth scroll query | Coordinates layout adjustments after state transitions safely. |
| **Security Layer** | Token Interception + Server Masking | Ensures frontend credentials remain masked without disrupting update/test actions. |

---

## 5. Composable Design Outcome: `useArrConfig`

The composable `useArrConfig(type)` exports:
- `configs`: Array of configurations.
- `mediaServers`: Linked media servers.
- UI flags: `loading`, `saving`, `isEditing`, `isAddingNew`, `editingId`, `loadingProfiles`.
- Form data: `editForm` (bound to unique inputs).
- Action handlers: `testConnection()`, `testConnectionFor()`, `saveConfig()`, `saveNewConfig()`, `deleteConfig()`.
