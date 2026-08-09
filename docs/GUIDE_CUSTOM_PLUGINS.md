# Custom Modules (Plugins) Guide

This guide covers **Console UI plugins** (custom pages, admin panels). For **Workflow Event plugins** (executors that run in the engine), see `docs/PLUGIN_SYSTEM.md`.

## 1. Design the UI
- **Location:** `packages/console/src/pages/custom/[PluginName].tsx`
- **Rule:** Focus only on the component internals. The system automatically handles Topbar, Sidebar, and Page Container.

## 2. Register the Plugin
- **Location:** `packages/console/src/features/admin/registry.tsx`
- **Rule:** Add a key-value mapping for dynamic import.
- **Example:** `MySecretTool: lazy(() => import('../../pages/custom/MyNewTool'))`

## 3. Link via Navigation Menu
- **Action:** Configure through SAILS Console UI (`/admin/settings`).
- **Rule:** Select Action Type **"Custom Plugin"** and use the Component Key defined in the Registry.
- **Security Warning:** Restrict plugin visibility using the "Required Capability" setting.
