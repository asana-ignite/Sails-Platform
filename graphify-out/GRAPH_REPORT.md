# Graph Report - .  (2026-08-01)

## Corpus Check
- 219 files · ~165,219 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1172 nodes · 1949 edges · 117 communities (89 shown, 28 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 103 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Brand Assets and Theme
- Layout Builder Mockups
- Agent Rules and Skills
- Console Dependencies
- Layout Studio Builder
- Field Type Registry
- Object Permissions API
- Agent Docs and Context Map
- Shared Types Index
- Console Apps API
- Dynamic Table API
- Core tsconfig
- Console AI Docs
- Console App Shell
- Alchemacore Engine
- Console tsconfig
- Console App tsconfig
- Common UI Components
- Tenant Provisioning
- App Layout Components
- Core Auth Dependencies
- Core Dev Dependencies
- DB Reset Scripts
- Dynamic Icon Picker
- Field Sequence API
- Core Engine SQL
- Custom Select and SSO Config
- Team Manager Admin
- Route Builder Mockups
- Zoning and Global Roadmap
- Backlog Docs
- Console Config Context
- Console Config API
- Sails CLI
- Connection Manager
- Dynamic Pages
- Widget Bar Registry
- Position Manager
- User Details Modal
- Shared tsconfig
- Object Manager Custom
- Tenant Connection Manager
- Alchemacore Docs
- Query and Transaction Docs
- Company Profile Admin
- Console Node tsconfig
- Core Package Scripts
- Social Icon Sprites
- Company Profile API
- Zone Health API
- Zoning Architecture Agents
- Root Package Config
- Favicon Brand SVG
- Plugin Scaffold Script
- Shared Package Config
- Sails Logo Nodes
- Navigation Constants
- User Manager Admin
- Core Package Config
- NextAuth Setup
- Audit Logs API
- Zod Generator
- Field Registry Docs
- is_system Metadata Rule
- Schema Segregation
- Monorepo Shared Kernel
- Design Tokens Theming
- Logo and Theme Provider
- Plugin Scaffold TS
- Draggable Panel
- UI Button
- Agent Chat Windows
- Admin Permissions
- DB Drift Golden Rules
- Connection Manager Docs
- User Team Roadmap
- Auth and Session Docs
- Ghost Glass Design
- Tenant Connection Manager Docs
- JIT Provisioning Roadmap
- Zoning Tenant Relocation
- Next.js Dependency
- Auth Background Asset
- API Client
- Plugin Registry
- Next Env Types
- pg Dependency
- Backup DB Script
- ApexCharts Blueprint
- MetisMenu Blueprint
- Light Logo Node

## God Nodes (most connected - your core abstractions)
1. `getAppSession()` - 102 edges
2. `useConsole()` - 31 edges
3. `AlchemaCore` - 24 edges
4. `FieldTypePlugin` - 21 edges
5. `SchemaLogger` - 20 edges
6. `TenantProvisioner` - 20 edges
7. `ConnectionManager` - 18 edges
8. `compilerOptions` - 18 edges
9. `LayoutStudio()` - 17 edges
10. `compilerOptions` - 17 edges

## Surprising Connections (you probably didn't know these)
- `SAILS Platform (Multi-tenant, schema-per-tenant monorepo)` --semantically_similar_to--> `SAILS (Ignite Idea Operating System)`  [INFERRED] [semantically similar]
  AGENTS.md → README.md
- `db Service (PostgreSQL 16, sails-db)` --semantically_similar_to--> `db Service (standalone core compose)`  [INFERRED] [semantically similar]
  docker-compose.yml → packages/core/docker-compose.yml
- `core Service (sails-core, Next.js API)` --semantically_similar_to--> `app Service (sails-core standalone)`  [INFERRED] [semantically similar]
  docker-compose.yml → packages/core/docker-compose.yml
- `console Service (sails-console, Vite)` --semantically_similar_to--> `Standalone Console Docker Compose`  [INFERRED] [semantically similar]
  docker-compose.yml → packages/console/docker-compose.yml
- `Code Reviewer Subagent` --conceptually_related_to--> `SAILS Platform (Multi-tenant, schema-per-tenant monorepo)`  [INFERRED]
  .opencode/agents/code-reviewer.md → AGENTS.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Mandatory Security Pipeline Flow** — _agents_skills_backend_developer_skill_security_pipeline, _agents_skills_backend_developer_skill_getappsession, _agents_skills_backend_developer_skill_accessguard, _agents_skills_backend_developer_skill_transactioncontext, _agents_skills_backend_developer_skill_querylayer [EXTRACTED 1.00]
- **Shared Contracts Monorepo Rule** — _agents_skills_platform_architect_skill_sails_shared, _agents_skills_platform_architect_skill_single_source_of_truth, _agents_skills_backend_developer_skill, _agents_skills_frontend_developer_skill, _agents_skills_platform_architect_skill, _agents_skills_qa_tester_skill [INFERRED 0.85]
- **Layout Engine & Dynamic Table Chain** — _agents_rules_sails_platform_rules_layout_engine, _agents_agents_dynamictablepage, _agents_agents_layout_studio, _agents_agents_list_view_layouts [INFERRED 0.85]
- **SAILS Full-Stack Deployment Stack (db, core, console)** — docker_compose_dbservice, docker_compose_coreservice, docker_compose_consoleservice, docker_compose_pgdatavolume [EXTRACTED 1.00]
- **SAILS Console Design System (Aquiry + Ghost Glass + BEM)** — packages_console_skill_aquirydesignsystem, packages_console_readme_aquirydesignsystem, packages_console_readme_ghostglass, packages_console_skill_bemmethodology [INFERRED 0.85]
- **SAILS Multi-Tenancy Model (schema-per-tenant + zoning + RLS)** — agents_schemapertenant, agents_tenantdataisolation, agents_zoningarchitecture, agents_cellbasedzoning [INFERRED 0.85]
- **Mandatory Security Pipeline (Auth -> RBAC -> RLS -> DML -> Verify)** — docs_development_standards_security_pipeline, docs_core_ai_session, docs_core_ai_accessguard, docs_core_ai_transactioncontext, docs_core_ai_querylayer [EXTRACTED 1.00]
- **Cell-Based Zoning Topology** — docs_zoning_architecture_cell_based_zoning, docs_zoning_architecture_global_control_plane, docs_zoning_architecture_sails_global_master, docs_zoning_architecture_super_admin_war_room, docs_zoning_architecture_zone_health_api, docs_development_standards_tenantconnectionmanager [EXTRACTED 1.00]
- **DB-Driven Navigation Flow** — docs_core_ai_consoleapp, docs_core_ai_consolemenu, docs_core_ai_config_api, docs_console_ai_consolecontext, docs_guide_custom_plugins_registry_tsx, docs_site_structure_apppluginshell, docs_site_structure_dynamictablepage [INFERRED 0.85]
- **Console Branding Logo Assets (dark/light/standard variants)** — packages_console_public_assets_logo_dark_logo, packages_console_public_assets_logo_light_logo, packages_console_public_assets_logo_standard_logo [INFERRED 0.75]
- **SAILS Logo Theme Variant Set** — packages_console_public_assets_logo_light_sails_logo, packages_console_public_assets_logo_standard_sails_logo, packages_console_public_assets_logo_dark_sails_logo [INFERRED 0.95]
- **Sails Auth Hero Side Visual** — packages_console_public_auth_bg, packages_console_src_pages_login_css [EXTRACTED 1.00]
- **Console Brand Mark** — packages_console_public_favicon_svg_asset, packages_console_public_favicon_svg_primary_path, packages_console_public_favicon_svg_brand_palette, packages_console_public_favicon_svg_glow_effect [EXTRACTED 0.95]
- **Console Brand and Social Icon Set** — packages_console_public_icons_bluesky_icon, packages_console_public_icons_discord_icon, packages_console_public_icons_documentation_icon, packages_console_public_icons_github_icon, packages_console_public_icons_social_icon, packages_console_public_icons_x_icon [EXTRACTED 1.00]
- **SAILS Console Logo Asset Family** — packages_console_src_assets_logo_png, packages_console_public_assets_logo_standard_jpg, packages_console_public_assets_logo_light_jpg, packages_console_public_assets_logo_dark_jpg [INFERRED 0.85]

## Communities (117 total, 28 thin omitted)

### Community 0 - "Brand Assets and Theme"
Cohesion: 0.06
Nodes (55): Dark Variant Logo (logo-dark.jpg), Light Variant Logo (logo-light.jpg), Standard Platform Sailboat Logo (logo-standard.jpg), SAILS Console Standard Logo Asset, SAILS Console Logo (logo.png), applyPaletteToDOM(), DEFAULT_THEME, generatePalette() (+47 more)

### Community 1 - "Layout Builder Mockups"
Cohesion: 0.05
Nodes (51): TableMeta, BlockCondition, blockId(), BlockType, BuilderSection, buildPalette(), ConditionOp, defaultPropsForBlock() (+43 more)

### Community 2 - "Agent Rules and Skills"
Cohesion: 0.08
Nodes (44): SAILS Workspace Agent Guidelines, AccessGuard.checkPermission, DynamicTablePage, Layout Studio, List View Layouts, Sails Platform Rules, CUID Primary Keys Rule, generateTimeOrderedId() (+36 more)

### Community 3 - "Console Dependencies"
Cohesion: 0.05
Nodes (39): dexie, dexie-react-hooks, lucide-react, dependencies, dexie, dexie-react-hooks, lucide-react, react (+31 more)

### Community 4 - "Layout Studio Builder"
Cohesion: 0.08
Nodes (36): BlockCondition, blockId(), BlockType, buildDefaultListColumns(), BuilderSection, buildMockRecord(), buildMockRows(), buildPalette() (+28 more)

### Community 5 - "Field Type Registry"
Cohesion: 0.12
Nodes (18): GET(), FieldRegistry, FieldTypePlugin, AddressType, AttachmentType, AutoNumberType, BooleanType, CurrencyType (+10 more)

### Community 6 - "Object Permissions API"
Cohesion: 0.11
Nodes (23): GET(), POST(), DELETE(), PATCH(), GET(), POST(), PATCH(), POST() (+15 more)

### Community 7 - "Agent Docs and Context Map"
Cohesion: 0.08
Nodes (35): Code Review Criteria (Correctness, Security, Performance, Style, Type Safety), Code Reviewer Subagent, Database Backup Procedure (backup-db.sh, schema/data dumps), SAILS Platform (Multi-tenant, schema-per-tenant monorepo), SAILS Context Map (Repo Orientation Index), Feature-Based UI Organization (packages/console/src/features), Shared Kernel Principle (@sails/shared), Root Docker Compose (db + core + console) (+27 more)

### Community 8 - "Shared Types Index"
Cohesion: 0.06
Nodes (31): AddressFieldConfig, AttachmentFieldConfig, AuditLog, AutoNumberFieldConfig, BooleanFieldConfig, CreateFieldRequest, CreateTableRequest, CurrencyFieldConfig (+23 more)

### Community 9 - "Console Apps API"
Cohesion: 0.11
Nodes (26): DELETE(), GET(), PATCH(), DELETE(), GET(), PATCH(), POST(), DELETE() (+18 more)

### Community 10 - "Dynamic Table API"
Cohesion: 0.16
Nodes (18): DELETE(), GET(), PATCH(), POST(), resolveTable(), RouteContext, AccessGuard, CrudAction (+10 more)

### Community 11 - "Core tsconfig"
Cohesion: 0.07
Nodes (28): compilerOptions, allowJs, baseUrl, downlevelIteration, esModuleInterop, incremental, isolatedModules, jsx (+20 more)

### Community 12 - "Console AI Docs"
Cohesion: 0.08
Nodes (27): TenantProvisioner, GET /api/console/config, ConsoleProvider / ConsoleContext, DynamicIcon mapper, SAILS Console (Frontend UI), SAILS Core (Headless Backend), GET /api/console/config endpoint, ConsoleApp model (+19 more)

### Community 13 - "Console App Shell"
Cohesion: 0.09
Nodes (22): AdminAuditLog, AdminLogin, AppPluginShell, Dashboard, DynamicDetailPage, DynamicTablePage, LayoutDemo, LayoutStudio (+14 more)

### Community 14 - "Alchemacore Engine"
Cohesion: 0.17
Nodes (4): AlchemaCore, TranslatorLayer, run(), run()

### Community 15 - "Console tsconfig"
Cohesion: 0.09
Nodes (22): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+14 more)

### Community 16 - "Console App tsconfig"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+14 more)

### Community 17 - "Common UI Components"
Cohesion: 0.12
Nodes (14): Spinner(), SpinnerProps, SidebarProps, ACTION_COLORS, ACTION_OPTIONS, AdminAuditLog(), AuditRow, PAGE_SIZE_OPTIONS (+6 more)

### Community 18 - "Tenant Provisioning"
Cohesion: 0.17
Nodes (8): seed(), pool, POST(), syncAllTenants(), TenantProvisioner, run(), ProvisionTenantRequest, ProvisionTenantResponse

### Community 19 - "App Layout Components"
Cohesion: 0.16
Nodes (13): AppLayout(), AppLayoutProps, MobileAppSwitcher(), MobileAppSwitcherProps, MobileGlobalBar(), MobileGlobalBarProps, MobileNav(), MobileNavProps (+5 more)

### Community 20 - "Core Auth Dependencies"
Cohesion: 0.12
Nodes (17): @auth/prisma-adapter, bcryptjs, next-auth, dependencies, @auth/prisma-adapter, bcryptjs, next-auth, pg-format (+9 more)

### Community 21 - "Core Dev Dependencies"
Cohesion: 0.12
Nodes (17): devDependencies, prisma, @types/bcryptjs, @types/node, @types/pg, @types/pg-format, @types/react, typescript (+9 more)

### Community 22 - "DB Reset Scripts"
Cohesion: 0.16
Nodes (5): GET(), POST(), GET(), globalForPrisma, runTests()

### Community 23 - "Dynamic Icon Picker"
Cohesion: 0.18
Nodes (8): DynamicIcon(), DynamicIconProps, IconPickerProps, ICONS, AdminAppManager(), AppDetailView(), DetailTab, EMPTY_MENU

### Community 24 - "Field Sequence API"
Cohesion: 0.23
Nodes (10): POST(), RouteContext, DELETE(), PATCH(), POST(), DELETE(), PATCH(), GET() (+2 more)

### Community 25 - "Core Engine SQL"
Cohesion: 0.23
Nodes (8): buildAutoNumberSqlExpression(), FieldDefinition, parseAutoNumberPattern(), IsolationStrategy, pool, run(), clearTestSession(), setTestSession()

### Community 26 - "Custom Select and SSO Config"
Cohesion: 0.16
Nodes (10): CustomSelect(), CustomSelectProps, SelectOption, DEFAULT_DOMAINS, DEFAULT_PROVIDERS, JIT_ROLE_OPTIONS, ProviderConfig, SESSION_TIMEOUT_OPTIONS (+2 more)

### Community 27 - "Team Manager Admin"
Cohesion: 0.14
Nodes (10): AdminTeamManager(), ManageDataAccessModalProps, ObjectPermission, Position, PositionSlot, SystemPermission, Team, TeamMember (+2 more)

### Community 28 - "Route Builder Mockups"
Cohesion: 0.19
Nodes (13): ACTION_COLORS, ACTION_TYPES, ActionBlock(), ActionBlockProps, ActionTrigger, newAction(), newStage(), RouteAction (+5 more)

### Community 29 - "Zoning and Global Roadmap"
Cohesion: 0.15
Nodes (13): Global Control Plane, Super Admin War Room, Zoning Multi-Tenancy Architecture, sails_global_master Registry, Super Admin War Room, GET /api/zone/health Telemetry, Cell-Based Zoning Architecture, Global Control Plane (+5 more)

### Community 30 - "Backlog Docs"
Cohesion: 0.18
Nodes (12): ObjectManager.tsx, Plugin Registry (registry.tsx), SailsTableDefinition shared interface, SailsUser shared interface, UserManager.tsx, DynamicTablePage, AppPluginShell, Custom Plugin Action Type (+4 more)

### Community 31 - "Console Config Context"
Cohesion: 0.26
Nodes (7): ConsoleContext, ConsoleContextType, AdminPluginRegistry, ConsoleConfig, AppPluginShell(), ConsoleApp, ConsoleMenu

### Community 32 - "Console Config API"
Cohesion: 0.21
Nodes (8): GET(), getMockData(), DELETE(), GET(), POST(), PermissionDefinition, SYSTEM_PERMISSION_REGISTRY, SystemCapability

### Community 33 - "Sails CLI"
Cohesion: 0.35
Nodes (11): COMMANDS, dbCheck(), dbClean(), getPool(), main(), printHeader(), printHelp(), seedSystemFields() (+3 more)

### Community 35 - "Dynamic Pages"
Cohesion: 0.29
Nodes (7): LoadingScreen(), LayoutRow, DynamicTablePage(), LIST_PER_PAGE_OPTIONS, renderListFieldValue(), resolveLabel(), TableLayout

### Community 36 - "Widget Bar Registry"
Cohesion: 0.24
Nodes (5): WidgetBarProps, WidgetRegistry, WIDGET_KEYS, WidgetsTabProps, ConsoleWidget

### Community 37 - "Position Manager"
Cohesion: 0.24
Nodes (7): AdminPositionManager(), generateAcronym(), Position, PositionDetailsModalProps, PositionSlot, renderHighlightedText(), UserPickerModalProps

### Community 38 - "User Details Modal"
Cohesion: 0.22
Nodes (8): AccessibleTable, PositionSlot, TeamMember, UserDetailsData, UserDetailsModal(), UserDetailsModalProps, User, UserManager()

### Community 39 - "Shared tsconfig"
Cohesion: 0.20
Nodes (9): compilerOptions, declaration, esModuleInterop, module, skipLibCheck, strict, target, include (+1 more)

### Community 40 - "Object Manager Custom"
Cohesion: 0.28
Nodes (6): ObjectManager(), DEFAULT_FIELD_TYPES, FieldTypeMetadata, LayoutType, SailsTableDefinition, ViewType

### Community 42 - "Alchemacore Docs"
Cohesion: 0.25
Nodes (8): AlchemaCore Engine (SQL Generation), TranslatorLayer (Metadata to DB Sync), PWA Offline-First Constraint, AlchemaCore.ts, TranslatorLayer.ts, Last-Write-Wins Conflict Resolution, PWA Offline-First Architecture, PWA Offline-First Field Ops

### Community 43 - "Query and Transaction Docs"
Cohesion: 0.25
Nodes (8): QueryLayer (Atomic DML), TransactionContext (RLS injection), AccessGuard.ts, QueryLayer.ts, TransactionContext.ts, Mandatory Security Pipeline, Field-Level Security (FLS), RecordShares Intersection Table

### Community 44 - "Company Profile Admin"
Cohesion: 0.25
Nodes (6): CompanyProfileData, COUNTRY_OPTIONS, DEFAULT_PROFILE_DATA, INDUSTRY_OPTIONS, SIZE_OPTIONS, STATE_PROVINCE_MAP

### Community 45 - "Console Node tsconfig"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, include, vite.config.ts

### Community 46 - "Core Package Scripts"
Cohesion: 0.25
Nodes (8): scripts, build, cli, db:clean, dev, platform:reset, start, test

### Community 47 - "Social Icon Sprites"
Cohesion: 0.29
Nodes (7): Bluesky Icon, Discord Icon, Documentation Icon, Github Icon, Social Icon, Console SVG Icon Sprite, X Icon

### Community 49 - "Company Profile API"
Cohesion: 0.53
Nodes (5): GET(), pickProfileFields(), PROFILE_FIELDS, PUT(), resolveTenantId()

### Community 50 - "Zone Health API"
Cohesion: 0.33
Nodes (3): PoolEntry, ZoneHealthStatus, ZoneTelemetryPayload

### Community 51 - "Zoning Architecture Agents"
Cohesion: 0.40
Nodes (5): Cell-Based Zoning Deployment Model (Global Control Plane, Super Admin War Room), DB-Driven Navigation (console_apps + console_menus), Schema-per-Tenant Multi-Tenancy, Tenant Data Isolation (tenant_{schema} + RLS + SET LOCAL), Zoning Multi-Tenancy Architecture (Cell-Based Zoning)

### Community 52 - "Root Package Config"
Cohesion: 0.40
Nodes (4): name, private, workspaces, packages/*

### Community 53 - "Favicon Brand SVG"
Cohesion: 0.80
Nodes (5): Sails Console Favicon, Brand Palette (Purple Lavender), Ghost Glass Design Language, Neon Gaussian Blur Glow Effect, Primary Glyph Path (Sail Mark)

### Community 54 - "Plugin Scaffold Script"
Cohesion: 0.40
Nodes (3): fs, components, path

### Community 55 - "Shared Package Config"
Cohesion: 0.40
Nodes (4): main, name, types, version

### Community 56 - "Sails Logo Nodes"
Cohesion: 0.50
Nodes (4): SAILS Platform Logo (Dark Theme), SAILS Platform Logo (Light Theme), SAILS Platform Logo (Standard Theme), SAILS Console Brand Display

### Community 57 - "Navigation Constants"
Cohesion: 0.50
Nodes (3): NAV_ITEMS, NAVIGATION_ITEMS, NavItem

### Community 59 - "Core Package Config"
Cohesion: 0.50
Nodes (3): description, name, version

### Community 61 - "Audit Logs API"
Cohesion: 0.67
Nodes (3): GET(), resolveTenantId(), SortableField

### Community 63 - "Field Registry Docs"
Cohesion: 0.67
Nodes (3): FieldRegistry Plugin Architecture, FieldRegistry.ts, zodGenerator.ts

### Community 64 - "is_system Metadata Rule"
Cohesion: 0.67
Nodes (3): is_system Metadata Constraint, is_system Column Rule, Schema Drift

### Community 65 - "Schema Segregation"
Cohesion: 0.67
Nodes (3): FieldDefinition Prisma model, TableDefinition Prisma model, core vs tenant_{schema} Segregation

### Community 66 - "Monorepo Shared Kernel"
Cohesion: 0.67
Nodes (3): shared/types.ts Contract, Monorepo Architecture, @sails/shared Shared Kernel

### Community 67 - "Design Tokens Theming"
Cohesion: 0.67
Nodes (3): Design Tokens, design-tokens.css, data-sails-theme Theming

### Community 68 - "Logo and Theme Provider"
Cohesion: 1.00
Nodes (3): SAILS Dark Theme Logo Asset, SAILS Standard Platform Logo Asset, SAILS Console Theme Provider

## Ambiguous Edges - Review These
- `CUID Primary Keys Rule` → `SAILS Backend Engineer Skill`  [AMBIGUOUS]
  .agents/skills/backend-developer/SKILL.md · relation: conceptually_related_to
- `SAILS Dark Theme Logo Asset` → `SAILS Standard Platform Logo Asset`  [AMBIGUOUS]
  packages/console/public/assets/logo-dark.jpg · relation: semantically_similar_to
- `SAILS Platform Logo (Light Theme)` → `SAILS Console Brand Display`  [AMBIGUOUS]
  packages/console/public/assets/logo-light.jpg · relation: semantically_similar_to

## Knowledge Gaps
- **405 isolated node(s):** `name`, `private`, `packages/*`, `name`, `private` (+400 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **28 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `CUID Primary Keys Rule` and `SAILS Backend Engineer Skill`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `SAILS Dark Theme Logo Asset` and `SAILS Standard Platform Logo Asset`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **What is the exact relationship between `SAILS Platform Logo (Light Theme)` and `SAILS Console Brand Display`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **Why does `getAppSession()` connect `Console Apps API` to `Console Config API`, `Object Permissions API`, `Dynamic Table API`, `Alchemacore Engine`, `Company Profile API`, `DB Reset Scripts`, `Field Sequence API`, `Core Engine SQL`, `NextAuth Setup`, `Audit Logs API`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `CustomSelect()` connect `Custom Select and SSO Config` to `Brand Assets and Theme`, `Layout Builder Mockups`, `Layout Studio Builder`, `Position Manager`, `User Details Modal`, `Object Manager Custom`, `Company Profile Admin`, `Common UI Components`, `Dynamic Icon Picker`, `Team Manager Admin`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `ConsoleMenu` connect `Console Config Context` to `Dynamic Pages`, `Shared Types Index`, `Console App Shell`, `App Layout Components`, `Dynamic Icon Picker`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `name`, `private`, `packages/*` to the rest of the system?**
  _405 weakly-connected nodes found - possible documentation gaps or missing edges._