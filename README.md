# SAILS — Enterprise-Grade CRM Application

Welcome to **SAILS**, an enterprise-grade CRM application engineered for flexible configuration. SAILS enables organizations to configure data models, security policies, workflows, and user interfaces visually — without writing code. The platform serves as a central operating layer for managing Customers, Sales Pipelines, Projects, Cases, and Timesheets.

This project is structured as a Bun Workspace to centralize backend, frontend, and shared logic.

## Project Structure

- `docs/`: Centralized architectural documentation. **(Check here first for system context)**
- `packages/core/`: Headless Backend API (Bun/Next.js).
- `packages/console/`: Frontend PWA (Vite/React).
- `packages/shared/`: Shared types and API contracts.

## System Prerequisites & Deployment

- **Runtime**: **Bun >= 1.4.0** (Monorepo package management, native TypeScript execution, and fast container builds).
- **Database**: PostgreSQL 16+ (Multi-schema multi-tenancy with RLS).
- **Orchestration**: Docker Engine 24+ & Docker Compose v2.

For full environment configuration, production sizing, and container operations, see **[DEPLOYMENT_PREREQUISITES.md](./docs/DEPLOYMENT_PREREQUISITES.md)**.

## Architectural Guidance

For deep dives into the platform's design, please refer to the files in the [docs/](./docs) directory:

- [DEPLOYMENT_PREREQUISITES.md](./docs/DEPLOYMENT_PREREQUISITES.md) - System Prerequisites, Deployment & Ops Playbook
- [DEVELOPMENT_STANDARDS.md](./docs/DEVELOPMENT_STANDARDS.md) - Centralized Architecture & Standards
- [ZONING_ARCHITECTURE.md](./docs/ZONING_ARCHITECTURE.md) - Cell-Based Multi-Database Zoning
- [CORE_AI.md](./docs/CORE_AI.md) - Backend Overview
- [CONSOLE_AI.md](./docs/CONSOLE_AI.md) - Frontend Overview
- [ROADMAP.md](./docs/ROADMAP.md) - Strategic Roadmap

---
*SAILS: Enterprise-Grade CRM, Configurable by Design*


