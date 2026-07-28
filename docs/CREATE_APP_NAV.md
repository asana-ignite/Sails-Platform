# Workspace Configuration: Modules & Navigation

This document outlines the standard configuration for the **SAILS** Workspace, including core modules and their navigation structures tailored for Ignite Idea operations.

## 1. Sales Module
*Focus: Pipeline management and lead tracking.*

**Module Definition:**
- **Name**: `Sales`
- **Icon**: `TrendingUp`
- **Order**: 0

**Navigation Items:**
1. **Leads** (Icon: `Users`, Path: `/table/leads`)
2. **Opportunities** (Icon: `Target`, Path: `/table/opportunities`)
3. **Accounts** (Icon: `Building`, Path: `/table/accounts`)
4. **Contacts** (Icon: `UserSquare`, Path: `/table/contacts`)

---

## 2. Project Management
*Focus: Internal project tracking and task management.*

**Module Definition:**
- **Name**: `Projects`
- **Icon**: `Briefcase`
- **Order**: 1

**Navigation Items:**
1. **Active Projects** (Icon: `FolderKanban`, Path: `/table/projects`)
2. **My Tasks** (Icon: `CheckCircle2`, Path: `/table/tasks`)
3. **Milestones** (Icon: `Flag`, Path: `/table/milestones`)
4. **Resource Allocation** (Icon: `Users2`, Path: `/table/resources`)

---

## 3. Case Management
*Focus: Issue tracking and support resolution.*

**Module Definition:**
- **Name**: `Case Management`
- **Icon**: `LifeBuoy`
- **Order**: 2

**Navigation Items:**
1. **Open Cases** (Icon: `Inbox`, Path: `/table/cases`)
2. **SLA Reports** (Icon: `ShieldCheck`, Path: `/dashboard/sla`)
3. **Knowledge Base** (Icon: `BookOpen`, Path: `/table/kb`)

---

## 4. Timesheets
*Focus: Daily time logging and utilization.*

**Module Definition:**
- **Name**: `Timesheets`
- **Icon**: `Clock`
- **Order**: 3

**Navigation Items:**
1. **My Timesheets** (Icon: `Calendar`, Path: `/table/timesheets`)
2. **Approval Queue** (Icon: `ClipboardCheck`, Path: `/table/approvals`)
3. **Utilization Dashboard** (Icon: `BarChart3`, Path: `/dashboard/utilization`)

---

## API Payloads Reference

> [!WARNING]
> Creating a dynamic table in the database is NOT enough to make it visible in the UI. You MUST create a corresponding `ConsoleMenu` item and link it to an existing `ConsoleApp` using the APIs below.

To provision these via the **SAILS Core** API, use the following patterns:

### Create Module (App)
```http
POST /api/console/apps
{
  "name": "Projects",
  "icon": "Briefcase",
  "order": 1
}
```

### Create Nav Item
```http
POST /api/console/menus
{
  "appId": "UUID_FROM_ABOVE",
  "label": "Active Projects",
  "icon": "FolderKanban",
  "path": "/table/projects",
  "actionType": "table",
  "order": 0
}
```
