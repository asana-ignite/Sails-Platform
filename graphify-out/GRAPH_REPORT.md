# Graph Report - .  (2026-08-06)

## Corpus Check
- 290 files · ~219,119 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1553 nodes · 3100 edges · 154 communities (111 shown, 43 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 94 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Theme and Palette System
- Layout Builder Blocks
- Field Config Definitions
- Field Registry Plugins
- Layout Studio Conditions
- DB Cleanup and Reset Scripts
- API CRUD Routes
- App Shell and Admin Login
- List View Mobile Table
- Dynamic Icon and Fetch Cache
- API Route Handlers
- Field Path Picker and Filter
- TSConfig Core Config
- Repo Orientation Index
- Custom Select Component
- Detail Field Display Controls
- AccessGuard and QueryLayer
- AlchemaCore AutoNumber
- Route Param Builders
- Related List and Record Detail
- TSConfig Shared Config
- TSConfig App Config
- Field Control Registry
- AlchemaCore DDL Builder
- DB-Driven Navigation Models
- Spinner and Admin Audit Log
- Field Control Wrappers
- Seed and Provision Scripts
- API Client Cache Layer
- Number and Currency Controls
- App and Layout Modals
- Core Dependencies
- Phone Control
- DateTime Prefs System
- Dev Dependencies
- UI Library Dependencies
- App Layout and Switcher
- Search List Control
- Route Handlers
- QA Test Suites and Rules
- Action Registry
- Route Builder Actions
- Connection Manager Pools
- React Type Dependencies
- Console Config Route
- Layout Studio Workspace
- Date Time Controls
- SAILS CLI Commands
- RLS and Engine Safety
- TipTap Rich Text Extensions
- Tenant Connection Pools
- Plugin Platform Registries
- Cell-Based Zoning
- Console Package Config
- Widget Registry
- Shared TSConfig
- Security Pipeline Components
- Validation Utilities
- Field Registry and Backlog
- CSV Export
- Field Control Registry
- Admin Permissions
- TSConfig Node Config
- Core Scripts
- Offline-First and ID Strategy
- Social Media Icons
- List View Engine
- Company Profile Admin
- Route Handlers
- Monorepo Architecture
- Analytics Roadmap
- Plugin Action Routes
- Address Control
- Date Control
- Tenant Seeding and Reset
- Workspace Package Config
- Console Brand Assets
- Plugin Scaffold Template
- Attachment Control
- Profile Fields Route
- Shared Package Config
- Ghost Glass Design System
- Logo Assets
- SAILS Logo Assets
- Static Navigation
- Rich Text Control
- User Manager Admin
- Package Metadata
- Tenant Resolution Route
- Zone Health API
- Context Macros
- Backup and CLI Utilities
- SAILS Theme Logos
- Plugin Scaffolder
- Draggable Panel
- Button Component
- Agent Chat Windows
- Code Review Criteria
- Data Layer Boundary
- Design System Basics
- Offline Conflict Resolution
- Shared Kernel Architecture
- Theme Tokens CSS
- Tenant Migration Protocols
- Next Framework
- React Router
- Shared Types Package
- TipTap Font Family
- TipTap Link Extension
- TipTap Table Extension
- TipTap Table Cell
- TipTap Table Row
- TipTap Text Style
- TipTap React Bindings
- Auth Background Assets
- Plugin Registry Map
- Next Env Types
- PG Driver
- Backup Script
- SPA Routing
- System Column Rule
- Runtime Mutation Ban
- Schema Segregation
- Mandatory Security Pipeline
- Tenant Connection Manager
- ApexCharts Dashboards
- App Layout Component
- SAILS Light Logo
- Console Standard Logo

## God Nodes (most connected - your core abstractions)
1. `requireSession()` - 60 edges
2. `db` - 50 edges
3. `requireAdmin()` - 43 edges
4. `useConsole()` - 38 edges
5. `FieldControlPlugin` - 30 edges
6. `FieldTypePlugin` - 28 edges
7. `FieldControlProps` - 27 edges
8. `fetchCached()` - 24 edges
9. `AlchemaCore` - 24 edges
10. `SailsFieldDefinition` - 24 edges

## Surprising Connections (you probably didn't know these)
- `Hard Rules for AI Agents` --semantically_similar_to--> `Golden Rules`  [INFERRED] [semantically similar]
  docs/KB_UNLOADED_CONFIG.md → AGENTS.md
- `db Service (PostgreSQL 16, sails-db)` --semantically_similar_to--> `db Service (standalone core compose)`  [INFERRED] [semantically similar]
  docker-compose.yml → packages/core/docker-compose.yml
- `core Service (sails-core, Next.js API)` --semantically_similar_to--> `app Service (sails-core standalone)`  [INFERRED] [semantically similar]
  docker-compose.yml → packages/core/docker-compose.yml
- `console Service (sails-console, Vite)` --semantically_similar_to--> `Standalone Console Docker Compose`  [INFERRED] [semantically similar]
  docker-compose.yml → packages/console/docker-compose.yml
- `Dynamic Navigation` --semantically_similar_to--> `DB-driven Navigation`  [INFERRED] [semantically similar]
  docs/CONSOLE_AI.md → AGENTS.md

## Import Cycles
- 4-file cycle: `packages/console/src/components/list/ListViewTable.tsx -> packages/console/src/features/controls/DetailFieldControl.tsx -> packages/console/src/features/controls/FieldControlRegistry.ts -> packages/console/src/features/controls/plugins/SearchListControl.tsx -> packages/console/src/components/list/ListViewTable.tsx`

## Hyperedges (group relationships)
- **Layout Engine & Dynamic Table Chain** — _agents_rules_sails_platform_rules_layout_engine, _agents_agents_dynamictablepage, _agents_agents_layout_studio, _agents_agents_list_view_layouts [INFERRED 0.85]
- **SAILS Full-Stack Deployment Stack (db, core, console)** — docker_compose_dbservice, docker_compose_coreservice, docker_compose_consoleservice, docker_compose_pgdatavolume [EXTRACTED 1.00]
- **Mandatory Security Pipeline (Auth -> RBAC -> RLS -> DML -> Verify)** — docs_development_standards_security_pipeline, docs_core_ai_transactioncontext [EXTRACTED 1.00]
- **Cell-Based Zoning Topology** — docs_zoning_architecture_cell_based_zoning, docs_zoning_architecture_global_control_plane, docs_zoning_architecture_sails_global_master, docs_zoning_architecture_super_admin_war_room, docs_zoning_architecture_zone_health_api, docs_development_standards_tenantconnectionmanager [EXTRACTED 1.00]
- **SAILS Console Design System (Aquiry + Ghost Glass + BEM)** — packages_console_skill_aquirydesignsystem, packages_console_readme_aquirydesignsystem, packages_console_readme_ghostglass, packages_console_skill_bemmethodology [INFERRED 0.85]
- **Console Branding Logo Assets (dark/light/standard variants)** — packages_console_public_assets_logo_dark_logo, packages_console_public_assets_logo_light_logo, packages_console_public_assets_logo_standard_logo [INFERRED 0.75]
- **SAILS Logo Theme Variant Set** — packages_console_public_assets_logo_light_sails_logo, packages_console_public_assets_logo_standard_sails_logo, packages_console_public_assets_logo_dark_sails_logo [INFERRED 0.95]
- **Sails Auth Hero Side Visual** — packages_console_public_auth_bg, packages_console_src_pages_login_css [EXTRACTED 1.00]
- **Console Brand Mark** — packages_console_public_favicon_svg_asset, packages_console_public_favicon_svg_primary_path, packages_console_public_favicon_svg_brand_palette, packages_console_public_favicon_svg_glow_effect [EXTRACTED 0.95]
- **Console Brand and Social Icon Set** — packages_console_public_icons_bluesky_icon, packages_console_public_icons_discord_icon, packages_console_public_icons_documentation_icon, packages_console_public_icons_github_icon, packages_console_public_icons_social_icon, packages_console_public_icons_x_icon [EXTRACTED 1.00]
- **SAILS Console Logo Asset Family** — packages_console_src_assets_logo_png, packages_console_public_assets_logo_standard_jpg, packages_console_public_assets_logo_light_jpg, packages_console_public_assets_logo_dark_jpg [INFERRED 0.85]
- **Security Pipeline** — agents_skills_backend_developer_skill_securitypipeline, agents_skills_backend_developer_skill_getsession, agents_skills_backend_developer_skill_accessguard, docs_core_ai_transactioncontext, agents_skills_backend_developer_skill_querylayer [EXTRACTED 1.00]
- **Tenant Isolation Stack** — agents_tenant_rls, docs_core_ai_transactioncontext, agents_skills_database_engineer_skill_rlspolicy, agents_skills_database_engineer_skill_schemasegregation, docs_kb_unloaded_config_rlsuser [INFERRED 0.85]
- **Cell-Based Zoning Evolution** — agents_zoning_architecture, docs_roadmap_cellularzoning, docs_roadmap_globalcontrolplane, docs_roadmap_warroom [INFERRED 0.85]

## Communities (154 total, 43 thin omitted)

### Community 0 - "Theme and Palette System"
Cohesion: 0.06
Nodes (50): applyPaletteToDOM(), DEFAULT_THEME, generatePalette(), loadFromStorage(), saveToStorage(), ThemeContext, ThemeContextType, ThemeProvider() (+42 more)

### Community 1 - "Layout Builder Blocks"
Cohesion: 0.05
Nodes (49): BlockCondition, blockId(), BlockType, BuilderSection, buildPalette(), ConditionOp, defaultPropsForBlock(), DragPayload (+41 more)

### Community 2 - "Field Config Definitions"
Cohesion: 0.04
Nodes (48): AddressFieldConfig, AttachmentFieldConfig, AuditLog, AutoNumberFieldConfig, BooleanFieldConfig, CONTEXT_CATEGORIES, CreateFieldRequest, CreateTableRequest (+40 more)

### Community 3 - "Field Registry Plugins"
Cohesion: 0.10
Nodes (23): FieldTypePlugin, AddressType, AttachmentType, AutoNumberType, BooleanType, CurrencyType, DateTimeType, DateType (+15 more)

### Community 4 - "Layout Studio Conditions"
Cohesion: 0.09
Nodes (36): ConditionOp, actionRegistry, applyRuleToMockRow(), BlockCondition, blockId(), BlockType, buildDefaultListColumns(), BuilderSection (+28 more)

### Community 5 - "DB Cleanup and Reset Scripts"
Cohesion: 0.16
Nodes (9): RouteContext, generateId(), getLogPool(), getLogSchema(), SchemaLogger, AppSession, _sessionStore, db (+1 more)

### Community 6 - "API CRUD Routes"
Cohesion: 0.11
Nodes (27): DELETE(), GET(), PATCH(), DELETE(), GET(), PATCH(), POST(), DELETE() (+19 more)

### Community 7 - "App Shell and Admin Login"
Cohesion: 0.09
Nodes (26): invalidateCache(), AdminAuditLog, AdminLogin, App(), AppPluginShell, Dashboard, DynamicDetailPage, DynamicTablePage (+18 more)

### Community 8 - "List View Mobile Table"
Cohesion: 0.14
Nodes (24): LIST_PER_PAGE_OPTIONS, ListViewMobile(), ListViewMobileProps, getVisibleColumns(), highlightText(), LIST_PER_PAGE_OPTIONS, ListViewTable(), NUMERIC_COLUMN_TYPES (+16 more)

### Community 9 - "Dynamic Icon and Fetch Cache"
Cohesion: 0.14
Nodes (23): fetchCached(), DynamicIcon(), DynamicIconProps, IconPicker(), IconPickerProps, ICONS, MobileNav(), MobileNavProps (+15 more)

### Community 10 - "API Route Handlers"
Cohesion: 0.14
Nodes (25): POST(), DELETE(), PATCH(), POST(), DELETE(), PATCH(), GET(), POST() (+17 more)

### Community 11 - "Field Path Picker and Filter"
Cohesion: 0.11
Nodes (26): FieldDefinition, FieldPathPicker(), FieldPathPickerProps, resolveChainDetails(), emptyGroup(), emptyRule(), FILTER_OPERATOR_OPTIONS, FilterBuilder() (+18 more)

### Community 12 - "TSConfig Core Config"
Cohesion: 0.07
Nodes (28): compilerOptions, allowJs, baseUrl, downlevelIteration, esModuleInterop, incremental, isolatedModules, jsx (+20 more)

### Community 13 - "Repo Orientation Index"
Cohesion: 0.09
Nodes (28): SAILS Context Map (Repo Orientation Index), Feature-Based UI Organization (packages/console/src/features), Shared Kernel Principle (@sails/shared), Root Docker Compose (db + core + console), console Service (sails-console, Vite), core Service (sails-core, Next.js API), db Service (PostgreSQL 16, sails-db), pgdata Volume (klaoplatform_pgdata, external) (+20 more)

### Community 14 - "Custom Select Component"
Cohesion: 0.09
Nodes (19): CustomSelect(), CustomSelectProps, SelectOption, AdminPositionManager(), generateAcronym(), Position, PositionDetailsModalProps, PositionSlot (+11 more)

### Community 15 - "Detail Field Display Controls"
Cohesion: 0.10
Nodes (21): ListViewTableProps, compareCondition(), DetailFieldDisplay(), DetailFieldDisplayProps, DetailFieldInput(), DetailFieldInputProps, DetailFieldLabel(), evaluateBlockRules() (+13 more)

### Community 16 - "AccessGuard and QueryLayer"
Cohesion: 0.20
Nodes (16): AccessGuard, CrudAction, generateTimeOrderedId(), QueryLayer, resolveSessionContext(), stripProtectedColumns(), WhereClauseOptions, TransactionContext (+8 more)

### Community 17 - "AlchemaCore AutoNumber"
Cohesion: 0.16
Nodes (9): buildAutoNumberSqlExpression(), FieldDefinition, parseAutoNumberPattern(), FieldRegistry, generateZodSchema(), TranslatorLayer, run(), run() (+1 more)

### Community 18 - "Route Param Builders"
Cohesion: 0.20
Nodes (18): buildIdResolver(), GET(), RouteContext, GET(), RouteContext, DELETE(), GET(), PATCH() (+10 more)

### Community 19 - "Related List and Record Detail"
Cohesion: 0.14
Nodes (18): RelatedListView(), RelatedListViewProps, isMobileViewport(), RecordDetailPanel(), StackCardProps, RecordStackContext, RecordStackContextValue, RecordStackProvider() (+10 more)

### Community 20 - "TSConfig Shared Config"
Cohesion: 0.09
Nodes (22): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+14 more)

### Community 21 - "TSConfig App Config"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+14 more)

### Community 22 - "Field Control Registry"
Cohesion: 0.15
Nodes (12): AutoNumberControl, BooleanCheckboxControl, BooleanControl, BooleanDropdownControl, BooleanToggleControl, CurrencyControl, DecimalControl, LongTextControl (+4 more)

### Community 23 - "AlchemaCore DDL Builder"
Cohesion: 0.23
Nodes (4): AlchemaCore, clearTestSession(), run(), setTestSession()

### Community 24 - "DB-Driven Navigation Models"
Cohesion: 0.12
Nodes (19): DB-driven Navigation, AppPluginShell Layout, Zoning Multi-Tenancy Architecture, AnalyticsDashboard Model, ConsoleApp and ConsoleMenu Models, ConsoleProvider Context, DynamicIcon Mapper, Dynamic Navigation (+11 more)

### Community 25 - "Spinner and Admin Audit Log"
Cohesion: 0.12
Nodes (16): Spinner(), SpinnerProps, ACTION_COLORS, ACTION_OPTIONS, AdminAuditLog(), AuditRow, PAGE_SIZE_OPTIONS, SYSTEM_ACTION_OPTIONS (+8 more)

### Community 26 - "Field Control Wrappers"
Cohesion: 0.14
Nodes (7): FieldControlWrapperProps, LatLngValue, FONT_OPTIONS, LookupOptionsProps, SelectControl, FieldControlProps, ValidationType

### Community 27 - "Seed and Provision Scripts"
Cohesion: 0.17
Nodes (8): seed(), pool, POST(), syncAllTenants(), TenantProvisioner, run(), ProvisionTenantRequest, ProvisionTenantResponse

### Community 28 - "API Client Cache Layer"
Cohesion: 0.11
Nodes (12): cache, CacheEntry, inflight, ManageDataAccessModalProps, ObjectPermission, Position, PositionSlot, SystemPermission (+4 more)

### Community 29 - "Number and Currency Controls"
Cohesion: 0.26
Nodes (10): NumberFormatInput(), decimalPlaceholder(), addThousandSeparators(), clampDecimalInput(), DEFAULT_DECIMAL_PLACES, formatDecimalValue(), formatEditableValue(), normalizeEditableValue() (+2 more)

### Community 30 - "App and Layout Modals"
Cohesion: 0.16
Nodes (13): CreateAppModal(), CreateLayoutModal(), CreateLayoutModalProps, LayoutRow, VIEW_TYPE_LABELS, ObjectManager(), SelectOptionSourceConfigProps, LayoutStatus (+5 more)

### Community 31 - "Core Dependencies"
Cohesion: 0.12
Nodes (17): @auth/prisma-adapter, bcryptjs, next-auth, dependencies, @auth/prisma-adapter, bcryptjs, next-auth, pg-format (+9 more)

### Community 32 - "Phone Control"
Cohesion: 0.15
Nodes (10): COUNTRY_SELECT_OPTIONS, iso2ForPrefix(), prefixForSelectValue(), COUNTRY_OPTIONS, CountryOption, PHONE_COUNTRY_OPTIONS, PhoneCountryOption, phoneFlag() (+2 more)

### Community 33 - "DateTime Prefs System"
Cohesion: 0.21
Nodes (16): DateTimePrefsContext, DateTimePrefsProvider(), DEFAULT_DATETIME_PREFS, fetchGeneralDateTimePrefs(), formatInTimezone(), formatSystemDateTimeValue(), GeneralDateTimePrefs, parseAsUtcInstant() (+8 more)

### Community 34 - "Dev Dependencies"
Cohesion: 0.12
Nodes (17): devDependencies, prisma, @types/bcryptjs, @types/node, @types/pg, @types/pg-format, @types/react, typescript (+9 more)

### Community 35 - "UI Library Dependencies"
Cohesion: 0.13
Nodes (15): lucide-react, dependencies, lucide-react, react, react-colorful, react-dom, @tiptap/extension-table-header, @tiptap/extension-underline (+7 more)

### Community 36 - "App Layout and Switcher"
Cohesion: 0.17
Nodes (10): AppLayout(), AppLayoutProps, MobileAppSwitcher(), MobileAppSwitcherProps, MobileGlobalBar(), MobileGlobalBarProps, MobileSearchBar(), MobileSearchBarProps (+2 more)

### Community 37 - "Search List Control"
Cohesion: 0.24
Nodes (13): DATE_SORT_TYPES, formatRecord(), isSearchableField(), NUMERIC_SORT_TYPES, pickLabelFields(), resolveListLayout(), resolvePrimaryFieldName(), resolveRecordLabel() (+5 more)

### Community 38 - "Route Handlers"
Cohesion: 0.25
Nodes (11): DELETE(), GET(), PATCH(), findPathConflict(), GET(), PATCH(), pathConflictError(), POST() (+3 more)

### Community 39 - "QA Test Suites and Rules"
Cohesion: 0.16
Nodes (14): Destructive Test Suites, Golden Rules, Prisma Migrate Diff, Security Test Suite, Strict Sign-Off Protocol, Tenant Schema RLS, Postgres as Analytics Engine, DEFAULT_TENANT_ID Env (+6 more)

### Community 40 - "Action Registry"
Cohesion: 0.34
Nodes (4): ActionRegistry, CreateAction, ActionContext, ActionPlugin

### Community 41 - "Route Builder Actions"
Cohesion: 0.19
Nodes (13): ACTION_COLORS, ACTION_TYPES, ActionBlock(), ActionBlockProps, ActionTrigger, newAction(), newStage(), RouteAction (+5 more)

### Community 43 - "React Type Dependencies"
Cohesion: 0.15
Nodes (13): devDependencies, @types/react, @types/react-dom, @types/react-router-dom, typescript, vite, @vitejs/plugin-react, @types/react (+5 more)

### Community 44 - "Console Config Route"
Cohesion: 0.24
Nodes (9): handler, GET(), getMockData(), authOptions, jwtCache, getAppSession(), configCache, getConfigCache() (+1 more)

### Community 45 - "Layout Studio Workspace"
Cohesion: 0.24
Nodes (12): SAILS Workspace Agent Guidelines, AccessGuard.checkPermission, DynamicTablePage, Layout Studio, List View Layouts, Sails Platform Rules, CUID Primary Keys Rule, generateTimeOrderedId() (+4 more)

### Community 46 - "Date Time Controls"
Cohesion: 0.18
Nodes (9): DateTimeControl, MONTH_NAMES, SailsDateTimePickerProps, WEEKDAYS, HOURS, MINUTES, SailsTimePicker(), SailsTimePickerProps (+1 more)

### Community 47 - "SAILS CLI Commands"
Cohesion: 0.35
Nodes (11): COMMANDS, dbCheck(), dbClean(), getPool(), main(), printHeader(), printHelp(), seedSystemFields() (+3 more)

### Community 48 - "RLS and Engine Safety"
Cohesion: 0.18
Nodes (11): AlchemaCore, pg-format Injection Prevention, RLS Policy Enforcement, Engine Integration Tests, RLS-Wrapped Materialized Rollups, Prisma Schema of Schemas, TransactionContext, Physical Type Whitelist (+3 more)

### Community 49 - "TipTap Rich Text Extensions"
Cohesion: 0.18
Nodes (10): @tiptap/extension-font-family, @tiptap/extension-link, @tiptap/extension-table, @tiptap/extension-table-cell, @tiptap/extension-table-header, @tiptap/extension-table-row, @tiptap/extension-text-style, @tiptap/extension-underline (+2 more)

### Community 51 - "Plugin Platform Registries"
Cohesion: 0.20
Nodes (10): Plugin Registry, ChartRegistry, Recharts Charting Library, Dynamic ESM Bundle Loading, Module Federation, Plugin Manifest plugin.json, Third-Party Plugin Platform, @sails/plugin-sdk (+2 more)

### Community 52 - "Cell-Based Zoning"
Cohesion: 0.20
Nodes (10): Global Control Plane, Super Admin War Room, Zoning Multi-Tenancy Architecture, Cell-Based Zoning Architecture, Global Control Plane, sails_global_master Schema, SchemaLogger, Super Admin War Room (+2 more)

### Community 53 - "Console Package Config"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, preview, type (+1 more)

### Community 54 - "Widget Registry"
Cohesion: 0.24
Nodes (7): WidgetBar(), WidgetBarProps, WidgetRegistry, WIDGET_KEYS, WidgetsTab(), WidgetsTabProps, ConsoleWidget

### Community 55 - "Shared TSConfig"
Cohesion: 0.20
Nodes (9): compilerOptions, declaration, esModuleInterop, module, skipLibCheck, strict, target, include (+1 more)

### Community 56 - "Security Pipeline Components"
Cohesion: 0.22
Nodes (9): getAppSession, QueryLayer, Security Pipeline, Atomic Audit Logging, Security by Design Pipeline, authOptions NextAuth Config, Stale JWT Session, Outbound Webhooks Option C (+1 more)

### Community 57 - "Validation Utilities"
Cohesion: 0.33
Nodes (8): isEmptyValue(), NUMERIC_TYPES, PRESET_REGEX_MAP, TEXT_TYPES, toNumber(), ValidatableField, validateFieldValue(), ValidationIssue

### Community 58 - "Field Registry and Backlog"
Cohesion: 0.25
Nodes (8): FieldRegistry Plugins, Multi-Tenancy and Security Phase, Development Phases Backlog, Team-Level Isolation, TranslatorLayer, ZodGenerator, owner_team_id Sharing, UserTeam N:M Membership

### Community 59 - "CSV Export"
Cohesion: 0.43
Nodes (6): ExportCsvButton(), ExportCsvButtonProps, downloadCsv(), escapeCsvField(), formatCsvRow(), generateCsvBlob()

### Community 61 - "Admin Permissions"
Cohesion: 0.36
Nodes (4): getAllCapabilities(), PermissionDefinition, SYSTEM_PERMISSION_REGISTRY, SystemCapability

### Community 62 - "TSConfig Node Config"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, include, vite.config.ts

### Community 63 - "Core Scripts"
Cohesion: 0.25
Nodes (8): scripts, build, cli, db:clean, dev, platform:reset, start, test

### Community 64 - "Offline-First and ID Strategy"
Cohesion: 0.29
Nodes (7): Client-Side UUIDv4 IDs, PWA Offline-First Constraint, Field-Level Security, Client Auto-Retry, Server-Side Idempotency, IdempotencyKey Model, IdempotencyService

### Community 65 - "Social Media Icons"
Cohesion: 0.29
Nodes (7): Bluesky Icon, Discord Icon, Documentation Icon, Github Icon, Social Icon, Console SVG Icon Sprite, X Icon

### Community 66 - "List View Engine"
Cohesion: 0.48
Nodes (6): defaultSyntheticConfig(), ListViewEngine(), ListViewEngineProps, parseConfig(), ListAction, normalizeFilters()

### Community 67 - "Company Profile Admin"
Cohesion: 0.29
Nodes (5): CompanyProfileData, DEFAULT_PROFILE_DATA, INDUSTRY_OPTIONS, SIZE_OPTIONS, STATE_PROVINCE_MAP

### Community 68 - "Route Handlers"
Cohesion: 0.48
Nodes (4): GET(), POST(), GET(), runTests()

### Community 69 - "Monorepo Architecture"
Cohesion: 0.33
Nodes (6): Strict Decoupling Monorepo Rule, Shared Types Single Source of Truth, Headless Backend API, System Permission Registry, Bun Workspace Monorepo, SAILS Enterprise CRM

### Community 70 - "Analytics Roadmap"
Cohesion: 0.47
Nodes (6): Advanced Analytics Roadmap, AnalyticsQueryBuilder, AnalyticsQuerySpec, Natural-Language Querying, PostgresML Forecasting, Aggregation Whitelist

### Community 71 - "Plugin Action Routes"
Cohesion: 0.33
Nodes (6): AppPluginShell, Custom Plugin Action Type, registry.tsx Plugin Map, AppPluginShell, DynamicTablePage, Universal Routing /:appSlug/:path*

### Community 72 - "Address Control"
Cohesion: 0.33
Nodes (3): AddressControl, AddressParts, EMPTY_PARTS

### Community 73 - "Date Control"
Cohesion: 0.33
Nodes (4): DateControl, MONTH_NAMES, SailsDatePickerProps, WEEKDAYS

### Community 74 - "Tenant Seeding and Reset"
Cohesion: 0.40
Nodes (5): Rebuild Test Tenant Workflow, App & Menu Seeding, DEFAULT_TENANT_ID, platform:reset, POST /api/tenant/provision

### Community 75 - "Workspace Package Config"
Cohesion: 0.40
Nodes (4): name, private, workspaces, packages/*

### Community 76 - "Console Brand Assets"
Cohesion: 0.80
Nodes (5): Sails Console Favicon, Brand Palette (Purple Lavender), Ghost Glass Design Language, Neon Gaussian Blur Glow Effect, Primary Glyph Path (Sail Mark)

### Community 77 - "Plugin Scaffold Template"
Cohesion: 0.40
Nodes (3): fs, components, path

### Community 79 - "Profile Fields Route"
Cohesion: 0.50
Nodes (4): GET(), pickProfileFields(), PROFILE_FIELDS, PUT()

### Community 80 - "Shared Package Config"
Cohesion: 0.40
Nodes (4): main, name, types, version

### Community 82 - "Ghost Glass Design System"
Cohesion: 0.67
Nodes (4): BEM Naming with sails- Prefix, Design Tokens CSS Variables, Ghost Glass Design DNA, Template Design Tokens

### Community 83 - "Logo Assets"
Cohesion: 0.50
Nodes (4): Dark Variant Logo (logo-dark.jpg), Light Variant Logo (logo-light.jpg), Standard Platform Sailboat Logo (logo-standard.jpg), SAILS Console Logo (logo.png)

### Community 84 - "SAILS Logo Assets"
Cohesion: 0.50
Nodes (4): SAILS Platform Logo (Dark Theme), SAILS Platform Logo (Light Theme), SAILS Platform Logo (Standard Theme), SAILS Console Brand Display

### Community 85 - "Static Navigation"
Cohesion: 0.50
Nodes (3): NAV_ITEMS, NAVIGATION_ITEMS, NavItem

### Community 88 - "Package Metadata"
Cohesion: 0.50
Nodes (3): description, name, version

### Community 89 - "Tenant Resolution Route"
Cohesion: 0.67
Nodes (3): GET(), resolveTenantId(), SortableField

### Community 91 - "Context Macros"
Cohesion: 0.67
Nodes (3): resolveContextMacro(), isNPeriodMacro(), N_PERIOD_MACROS

### Community 92 - "Backup and CLI Utilities"
Cohesion: 0.67
Nodes (3): Standard Backup Procedure, ConnectionManager, sails-cli Tooling

### Community 93 - "SAILS Theme Logos"
Cohesion: 1.00
Nodes (3): SAILS Dark Theme Logo Asset, SAILS Standard Platform Logo Asset, SAILS Console Theme Provider

## Ambiguous Edges - Review These
- `SAILS Dark Theme Logo Asset` → `SAILS Standard Platform Logo Asset`  [AMBIGUOUS]
  packages/console/public/assets/logo-dark.jpg · relation: semantically_similar_to
- `SAILS Platform Logo (Light Theme)` → `SAILS Console Brand Display`  [AMBIGUOUS]
  packages/console/public/assets/logo-light.jpg · relation: semantically_similar_to

## Knowledge Gaps
- **472 isolated node(s):** `name`, `private`, `packages/*`, `name`, `private` (+467 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **43 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `SAILS Dark Theme Logo Asset` and `SAILS Standard Platform Logo Asset`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **What is the exact relationship between `SAILS Platform Logo (Light Theme)` and `SAILS Console Brand Display`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **Why does `requireSession()` connect `API CRUD Routes` to `Route Handlers`, `DB Cleanup and Reset Scripts`, `Route Handlers`, `API Route Handlers`, `Console Config Route`, `Profile Fields Route`, `AccessGuard and QueryLayer`, `Route Param Builders`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `db` connect `DB Cleanup and Reset Scripts` to `Route Handlers`, `Route Handlers`, `API CRUD Routes`, `API Route Handlers`, `Console Config Route`, `Profile Fields Route`, `SAILS CLI Commands`, `AccessGuard and QueryLayer`, `Route Param Builders`, `AlchemaCore AutoNumber`, `AlchemaCore DDL Builder`, `Tenant Resolution Route`, `Zone Health API`, `Seed and Provision Scripts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `useConsole()` connect `Dynamic Icon and Fetch Cache` to `App Layout and Switcher`, `App Shell and Admin Login`, `Custom Select Component`, `Related List and Record Detail`, `Widget Registry`, `Spinner and Admin Audit Log`, `API Client Cache Layer`, `App and Layout Modals`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `name`, `private`, `packages/*` to the rest of the system?**
  _472 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Theme and Palette System` be split into smaller, more focused modules?**
  _Cohesion score 0.05989110707803993 - nodes in this community are weakly interconnected._