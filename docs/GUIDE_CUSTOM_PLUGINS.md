# Custom Modules (Plugins) Guide

This guide covers **single Console UI plugins** (custom pages, admin panels). For **Workflow Event plugins** (executors that run in the engine), see `docs/PLUGIN_SYSTEM.md`. For **package-scoped admin menus** (multi-page packages with capabilities and runtime activation), see `docs/PACKAGE_ADMIN_MENUS.md`.

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

## 4. Localization (Optional)
When creating a menu item for your plugin, you can supply a `translationKey` to
support future multi-language display. The `label` field remains as the fallback
text in English.

**API example:**
```http
POST /api/console/menus
{
  "appId": "UUID",
  "label": "My Tool",
  "translationKey": "plugin.my_tool.title",
  "icon": "Wrench",
  "path": "/admin/my-tool",
  "actionType": "plugin",
  "componentKey": "MySecretTool",
  "order": 0
}
```

`translationKey` is optional — leave it empty for customer-created menus where
the admin has already typed the correct label in their language.
