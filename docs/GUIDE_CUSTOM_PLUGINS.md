# 🎨 Human Guide: Building Your Own Custom Plugins

Welcome! This guide is designed for anyone who wants to add a new "Special Feature" or "Custom Page" to the KLAO Console. You don't need to be a senior engineer to do this—just follow these three simple steps.

---

## 🏗️ What is a "Plugin"?
Think of KLAO like a smartphone. 
- **Standard Pages (Tables)** are like your "Contacts" app—they look the same for everyone.
- **Plugins** are like "Custom Apps" you build yourself. They can have unique buttons, charts, or forms that do exactly what your business needs.

---

## 🪜 The 3 Steps to Success

### Step 1: Design Your Page (The "Look")
First, a developer creates a simple React file. This is just the "inside" of your page. You don't need to worry about the Sidebar or the Topbar—KLAO handles those for you automatically!

*   **File location**: `src/pages/custom/MyNewTool.tsx`
*   **What goes inside**: Your custom forms, maps, or data views.

### Step 2: Register the Page (The "Bridge")
Now, we need to tell the KLAO system that this new page exists. We do this in a file called the **Registry**.

1. Open `src/features/admin/registry.tsx`.
2. Add one line to the list with a "Nick Name" (Key) for your tool.
   *Example: `MySecretTool: lazy(() => import('../../pages/custom/MyNewTool'))`*

### Step 3: Add to Navigation (The "Link")
This is the easiest part! You can now do this directly inside the **KLAO Console UI**:

1. Go to **Settings & Admin** > **Navigation Menus**.
2. Click **"Add New"** in the app where you want the link (e.g., CRM).
3. Fill in the details:
    - **Label**: What the button should say (e.g., "Secret Analytics").
    - **Action Type**: Choose **"Custom Plugin"**.
    - **Component Key**: Use the "Nick Name" you created in Step 2 (`MySecretTool`).
    - **Path**: The URL you want (e.g., `/crm/secret-analytics`).

---

## ✅ Why This is Great
- **No Coding for Menus**: You never have to touch code to change your sidebar. Just use the UI!
*   **Professional Look**: Every plugin automatically gets the premium "KLAO Header" with your chosen icon and title.
*   **Safety**: You can restrict who sees your plugin using the "Required Capability" box in the Menu Manager.

**Happy Building!** If you have questions, just ask your friendly AI assistant.
