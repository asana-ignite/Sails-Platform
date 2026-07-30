# SAILS Platform — Workspace Agent Guidelines

## Development & Architecture Rules

### 1. Dynamic Table & Layout Engine Standards
- **Layout Alignment**: `DynamicTablePage` maps configuration from selected List View Layouts (`config.columns`, `config.filters`, `config.sortBy`, `allowMultiSelect`, `allowPaging`, `recordsPerPage`) to real database query records, matching Layout Studio's runtime preview components (`.ls-table-card`, `.ls-runtime-table`, `.ls-rth`, `.ls-rtd`, `.ls-pagination`).
- **System Field Exclusion**: Default fallback column resolution for unconfigured dynamic tables automatically excludes internal system/audit fields (`is_active`, `is_system`, `tenant_id`, `owner_id`) from table views.
- **Layout Activation Sync**: Activating or publishing a layout (`action === 'activate'`) atomically updates both `config` and `publishedConfig` in the database to ensure instant runtime propagation.
- **Tenant Admin Fast-Path**: `AccessGuard.checkPermission` includes fast-path authorization for both `SUPER_ADMIN` and `TENANT_ADMIN` roles across dynamic tenant objects.
- **Dropdown & Popover Positioning**: Custom select inputs rendered inside bottom containers (such as pagination footers) specify upward dropup direction (`direction="up"`) or boundary detection, while parent containers (`.ls-table-card`, `.ls-pagination`) enforce `overflow: visible` to prevent clipping.
