# Workspace Configuration: Apps & Navigation

This document outlines the standard configuration for the KLAO Workspace, including core apps and their navigation structures. This set is designed to provide a comprehensive CRM experience.

## 1. Sales App
*Focus: Individual contributor pipeline management.*

**App Definition:**
- **Name**: `Sales`
- **Icon**: `ShoppingBag`
- **Order**: 0

**Navigation Items:**
1. **Leads** (Icon: `Users`, Path: `/table/leads`)
2. **Accounts** (Icon: `Building`, Path: `/table/accounts`)
3. **Contacts** (Icon: `UserSquare`, Path: `/table/contacts`)
4. **Opportunities** (Icon: `Target`, Path: `/table/opportunities`)
5. **Quotes** (Icon: `FileText`, Path: `/table/quotes`)

---

## 2. Sales Manager App
*Focus: Strategic oversight and team performance.*

**App Definition:**
- **Name**: `Sales Manager`
- **Icon**: `Briefcase`
- **Order**: 1

**Navigation Items:**
1. **Team Performance** (Icon: `BarChart3`, Path: `/dashboard/performance`)
2. **Sales Forecast** (Icon: `LineChart`, Path: `/dashboard/forecast`)
3. **Territory Management** (Icon: `Map`, Path: `/table/territories`)
4. **Commission Reports** (Icon: `BadgeDollarSign`, Path: `/table/commissions`)
5. **Approval Requests** (Icon: `ClipboardCheck`, Path: `/approvals`)

---

## 3. Marketing App
*Focus: Lead generation and campaign management.*

**App Definition:**
- **Name**: `Marketing`
- **Icon**: `Megaphone`
- **Order**: 2

**Navigation Items:**
1. **Campaigns** (Icon: `Flag`, Path: `/table/campaigns`)
2. **Email Templates** (Icon: `Mail`, Path: `/table/templates`)
3. **Content Library** (Icon: `Library`, Path: `/library`)
4. **Social Analytics** (Icon: `Share2`, Path: `/dashboard/social`)
5. **Customer Segments** (Icon: `Users2`, Path: `/table/segments`)

---

## 4. Services App
*Focus: Post-sales support and knowledge management.*

**App Definition:**
- **Name**: `Services`
- **Icon**: `LifeBuoy`
- **Order**: 3

**Navigation Items:**
1. **Support Cases** (Icon: `Inbox`, Path: `/table/cases`)
2. **Knowledge Base** (Icon: `BookOpen`, Path: `/kb`)
3. **SLA Management** (Icon: `ShieldCheck`, Path: `/table/sla`)
4. **Customer Feedback** (Icon: `MessageSquare`, Path: `/table/feedback`)
5. **Resource Scheduling** (Icon: `Calendar`, Path: `/calendar/resources`)

---

## API Payloads Reference

To provision these via the KLAO Core API, use the following patterns:

### Create App
```http
POST /api/console/apps
{
  "name": "Sales",
  "icon": "ShoppingBag",
  "order": 0
}
```

### Create Nav Item
```http
POST /api/console/menus
{
  "appId": "UUID_FROM_ABOVE",
  "label": "Leads",
  "icon": "Users",
  "path": "/table/leads",
  "actionType": "table",
  "order": 0
}
```
