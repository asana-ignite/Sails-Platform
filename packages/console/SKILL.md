# SAILS Console — Implementation Skill Guide

This document outlines the architectural patterns, design standards, and implementation roadmap for building the **SAILS Console**. This guide serves as the long-term source of truth for AI agents working on this codebase.

## 1. Core Principles
- **Headless First**: The Console is a thin, premium UI layer. Logic for data structures and validation lives in **SAILS Core** (Backend).
- **Premium Aesthetics**: Replicate the **Aquiry** template’s "rich" feel. Use deep shadows, subtle gradients, and smooth transitions.
- **Offline Ready**: Every architectural decision must support the future migration to a PWA (IndexedDB caching, Client-side IDs).

## 2. Technical Stack
- **Framework**: React 18+ (Vite)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Pure Vanilla CSS (BEM Methodology)
- **Icons**: `lucide-react` (Matches Aquiry style, no icon fonts)
- **State Management**: React Context or Zustand

## 3. Design System (Aquiry-Inspired)
While we use **Aquiry** as a visual reference, the implementation is custom.
- **BEM Prefix**: `sails-` (e.g., `.sails-card`, `.sails-card__header`, `.sails-btn--primary`).
- **Interactivity**: Native React state only. NO jQuery, MetisMenu, or SimpleBar.
- **Assets**: Copy only necessary images/vectors from `_assets_references` into the project.

### Layout Structure (BEM)
```jsx
<div className="sails-layout">
  <Topbar className="sails-layout__topbar" />
  <Sidebar className="sails-layout__sidebar" />
  <main className="sails-layout__main">
    <div className="sails-page">
      <div className="sails-container">
        {/* Dynamic Components */}
      </div>
    </div>
  </main>
  <Footer className="sails-layout__footer" />
</div>
```

## 4. Implementation Roadmap

### Phase 1: Foundation (Setup)
- [ ] Initialize Vite project with TypeScript.
- [ ] Setup BEM-based CSS architecture (`src/styles/main.css`).
- [ ] Create layout components with native React state toggles.

### Phase 2: API & Schema Layer
- [ ] Setup `src/api/client.ts` with base Fetch configuration.
- [ ] Implement Client-Side ID generation (`crypto.randomUUID()`).
- [ ] Build the **Translator Service** for dynamic form generation.

### Phase 3: Core UI Features
- [ ] Build Schema Builder & Dynamic Data Explorer using BEM components.

### Phase 4: Offline-First (Roadmap)
- [ ] Integrate **Dexie.js** and `SyncQueue`.

## 5. Development Constraints
- **IDs**: Never use auto-incrementing integers. Always UUIDv4.
- **NO Frameworks**: DO NOT use Tailwind, Bootstrap, or any CSS utility framework.
- **Pure CSS**: All styling must be written in Vanilla CSS using BEM methodology.
- **Components**: Components must be "Metadata Aware"—they should render based on backend field types.

---

# Skill: Frontend Design System (Aquiry-Inspired)
> **Load when:** Creating UI components, defining layouts, or writing CSS for the `sails-console` project.

## Structural Conventions
- **Interactivity:** DO NOT use jQuery, MetisMenu, or SimpleBar. All interactivity (dropdowns, sidebar toggling) MUST be managed natively using React `useState`.

## Styling Rules (Non-Negotiable)
- **NO Frameworks:** DO NOT use Tailwind CSS or Bootstrap utility classes (e.g., `container-fluid`, `col-12`, `shadow-sm`).
- **BEM Methodology:** You MUST write Vanilla CSS using BEM prefixed with `sails-` (e.g., `.sails-card`, `.sails-card__header`, `.sails-btn--primary`).
- **Icons:** Use `lucide-react` (which matches the clean look of Eva Icons) or inline SVGs. Do not load external icon fonts.

Refer all asset from `_assets_references` but copy asset needed to project folders.

## After Develop, conduct a test in Docker name it `sails-template` and share the test URL
