--
-- PostgreSQL database dump
--

\restrict CG5YEmLWWh8EvjMQDKBPEm4iVZ5elgMC7ZlSziHAwqyGXLt1vxJGSmD5AV5edwg

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP DATABASE IF EXISTS postgres;
--
-- Name: postgres; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE postgres WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.utf8';


ALTER DATABASE postgres OWNER TO postgres;

\unrestrict CG5YEmLWWh8EvjMQDKBPEm4iVZ5elgMC7ZlSziHAwqyGXLt1vxJGSmD5AV5edwg
\connect postgres
\restrict CG5YEmLWWh8EvjMQDKBPEm4iVZ5elgMC7ZlSziHAwqyGXLt1vxJGSmD5AV5edwg

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: DATABASE postgres; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON DATABASE postgres IS 'default administrative connection database';


--
-- Name: core; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA core;


ALTER SCHEMA core OWNER TO postgres;

--
-- Name: tenant_klao_default; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA tenant_klao_default;


ALTER SCHEMA tenant_klao_default OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: core; Owner: postgres
--

CREATE TABLE core._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE core._prisma_migrations OWNER TO postgres;

--
-- Name: accounts; Type: TABLE; Schema: core; Owner: postgres
--

CREATE TABLE core.accounts (
    id text NOT NULL,
    user_id text NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    provider_account_id text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at integer,
    token_type text,
    scope text,
    id_token text,
    session_state text
);


ALTER TABLE core.accounts OWNER TO postgres;

--
-- Name: console_apps; Type: TABLE; Schema: core; Owner: postgres
--

CREATE TABLE core.console_apps (
    id text NOT NULL,
    tenant_id text NOT NULL,
    name text NOT NULL,
    icon text,
    "order" integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    required_capability text
);


ALTER TABLE core.console_apps OWNER TO postgres;

--
-- Name: console_menus; Type: TABLE; Schema: core; Owner: postgres
--

CREATE TABLE core.console_menus (
    id text NOT NULL,
    app_id text,
    label text NOT NULL,
    icon text,
    path text,
    action_type text DEFAULT 'table'::text NOT NULL,
    parent_id text,
    "order" integer DEFAULT 0 NOT NULL,
    required_capability text,
    component_key text
);


ALTER TABLE core.console_menus OWNER TO postgres;

--
-- Name: data_audit_logs; Type: TABLE; Schema: core; Owner: postgres
--

CREATE TABLE core.data_audit_logs (
    id text NOT NULL,
    tenant_id text NOT NULL,
    user_id text,
    ip_address text,
    action text NOT NULL,
    object_name text NOT NULL,
    record_id text,
    old_values jsonb,
    new_values jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE core.data_audit_logs OWNER TO postgres;

--
-- Name: ddl_logs; Type: TABLE; Schema: core; Owner: postgres
--

CREATE TABLE core.ddl_logs (
    id text NOT NULL,
    tenant_id text,
    user_id text,
    schema_name text NOT NULL,
    table_name text,
    action text NOT NULL,
    sql_executed text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE core.ddl_logs OWNER TO postgres;

--
-- Name: fields; Type: TABLE; Schema: core; Owner: postgres
--

CREATE TABLE core.fields (
    id text NOT NULL,
    table_id text NOT NULL,
    name text NOT NULL,
    field_name text NOT NULL,
    physical_type text NOT NULL,
    logical_type text NOT NULL,
    config jsonb,
    is_required boolean DEFAULT false NOT NULL,
    default_value text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    description text
);


ALTER TABLE core.fields OWNER TO postgres;

--
-- Name: object_permissions; Type: TABLE; Schema: core; Owner: postgres
--

CREATE TABLE core.object_permissions (
    id text NOT NULL,
    object_name text NOT NULL,
    can_create boolean DEFAULT false NOT NULL,
    can_read boolean DEFAULT false NOT NULL,
    can_update boolean DEFAULT false NOT NULL,
    can_delete boolean DEFAULT false NOT NULL,
    view_all_data boolean DEFAULT false NOT NULL,
    modify_all_data boolean DEFAULT false NOT NULL,
    team_id text NOT NULL
);


ALTER TABLE core.object_permissions OWNER TO postgres;

--
-- Name: sessions; Type: TABLE; Schema: core; Owner: postgres
--

CREATE TABLE core.sessions (
    id text NOT NULL,
    session_token text NOT NULL,
    user_id text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


ALTER TABLE core.sessions OWNER TO postgres;

--
-- Name: system_event_logs; Type: TABLE; Schema: core; Owner: postgres
--

CREATE TABLE core.system_event_logs (
    id text NOT NULL,
    tenant_id text NOT NULL,
    user_id text,
    ip_address text,
    category text NOT NULL,
    action text NOT NULL,
    event_name text NOT NULL,
    details jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE core.system_event_logs OWNER TO postgres;

--
-- Name: system_permissions; Type: TABLE; Schema: core; Owner: postgres
--

CREATE TABLE core.system_permissions (
    id text NOT NULL,
    team_id text NOT NULL,
    capability text NOT NULL
);


ALTER TABLE core.system_permissions OWNER TO postgres;

--
-- Name: tables; Type: TABLE; Schema: core; Owner: postgres
--

CREATE TABLE core.tables (
    id text NOT NULL,
    tenant_id text NOT NULL,
    name text NOT NULL,
    table_name text NOT NULL,
    description text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE core.tables OWNER TO postgres;

--
-- Name: teams; Type: TABLE; Schema: core; Owner: postgres
--

CREATE TABLE core.teams (
    id text NOT NULL,
    tenant_id text NOT NULL,
    name text NOT NULL,
    is_system_admin boolean DEFAULT false NOT NULL,
    parent_id text
);


ALTER TABLE core.teams OWNER TO postgres;

--
-- Name: tenants; Type: TABLE; Schema: core; Owner: postgres
--

CREATE TABLE core.tenants (
    id text NOT NULL,
    name text NOT NULL,
    schema_name text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE core.tenants OWNER TO postgres;

--
-- Name: user_teams; Type: TABLE; Schema: core; Owner: postgres
--

CREATE TABLE core.user_teams (
    user_id text NOT NULL,
    team_id text NOT NULL,
    is_leader boolean DEFAULT false NOT NULL
);


ALTER TABLE core.user_teams OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: core; Owner: postgres
--

CREATE TABLE core.users (
    id text NOT NULL,
    name text,
    email text NOT NULL,
    email_verified timestamp(3) without time zone,
    image text,
    password text,
    tenant_id text,
    role text DEFAULT 'MEMBER'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    google_domain text,
    google_id text,
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp(3) without time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    phone text,
    title text
);


ALTER TABLE core.users OWNER TO postgres;

--
-- Name: validation_rules; Type: TABLE; Schema: core; Owner: postgres
--

CREATE TABLE core.validation_rules (
    id text NOT NULL,
    table_id text NOT NULL,
    field_id text,
    "ruleType" text NOT NULL,
    "ruleDefinition" text NOT NULL,
    error_message text
);


ALTER TABLE core.validation_rules OWNER TO postgres;

--
-- Name: verification_tokens; Type: TABLE; Schema: core; Owner: postgres
--

CREATE TABLE core.verification_tokens (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


ALTER TABLE core.verification_tokens OWNER TO postgres;

--
-- Name: Lead; Type: TABLE; Schema: tenant_klao_default; Owner: postgres
--

CREATE TABLE tenant_klao_default."Lead" (
    id character varying(30) NOT NULL,
    tenant_id character varying(30) DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    owner_id character varying(30) DEFAULT NULLIF(current_setting('app.current_user_id'::text, true), ''::text) NOT NULL,
    owner_team_id character varying(30) DEFAULT NULLIF(current_setting('app.current_team_id'::text, true), ''::text),
    created_by character varying(30),
    updated_by character varying(30),
    "Name" text
);

ALTER TABLE ONLY tenant_klao_default."Lead" FORCE ROW LEVEL SECURITY;


ALTER TABLE tenant_klao_default."Lead" OWNER TO postgres;

--
-- Name: Order; Type: TABLE; Schema: tenant_klao_default; Owner: postgres
--

CREATE TABLE tenant_klao_default."Order" (
    id character varying(30) NOT NULL,
    tenant_id character varying(30) DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    owner_id character varying(30) DEFAULT NULLIF(current_setting('app.current_user_id'::text, true), ''::text) NOT NULL,
    owner_team_id character varying(30) DEFAULT NULLIF(current_setting('app.current_team_id'::text, true), ''::text),
    created_by character varying(30),
    updated_by character varying(30),
    "OrderName" text,
    ordertype text
);

ALTER TABLE ONLY tenant_klao_default."Order" FORCE ROW LEVEL SECURITY;


ALTER TABLE tenant_klao_default."Order" OWNER TO postgres;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: core; Owner: postgres
--

COPY core._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
9bc8aa9f-c017-4cb4-9d27-6e0a5418e9fc	8996eb7978613b9c4c40c2e50cb8dc8b632829e13b540c83e7a7d7049cffec87	2026-07-15 16:27:09.528941+00	20260502093918_auth_schema_core	\N	\N	2026-07-15 16:27:09.500884+00	1
66b3963f-ce5f-4169-802f-002e5111160a	be3e73800287259a809dd007df95e079b02d3efd141693285fa299adc38d1547	2026-07-15 16:27:09.54371+00	20260512145650_add_google_fields	\N	\N	2026-07-15 16:27:09.529195+00	1
2a9136df-2081-42db-ac92-d1183632b174	9828dd23b729a6aac818730cdc86d257933cea925134e673bbe08b27916c08b4	2026-07-15 16:27:09.544668+00	20260512165015_add_user_title	\N	\N	2026-07-15 16:27:09.543907+00	1
4f56bc0c-793e-40ee-9121-df8e11c28bbd	199b5fcf89fd22af45814ecd12dd7024b555dce6cdb3c054084f6ae040d98baa	2026-07-19 06:17:48.055844+00	20260719061531_init_cuid_schema	\N	\N	2026-07-19 06:17:47.996268+00	1
432bb234-9c6d-4883-b953-a6438ed6b390	def199fc97d8a950c711d29469dd203feb9e612b2c3d085ad7e821e6ebcdb6ec	2026-07-19 07:01:39.900183+00	20260719070139_logging_restructure	\N	\N	2026-07-19 07:01:39.884872+00	1
f7887d36-ee55-4e48-a919-d9ba3cf6e8d7	a10105d3dd4c594d8250367bc323ca7b8def79a7db42acd0893d8d418982a0d1	2026-07-21 14:56:39.191238+00	20260721145639_add_field_description	\N	\N	2026-07-21 14:56:39.188924+00	1
\.


--
-- Data for Name: accounts; Type: TABLE DATA; Schema: core; Owner: postgres
--

COPY core.accounts (id, user_id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state) FROM stdin;
cmrrep9ot001fky2cpixqwqa7	cmrrep9ol001dky2ckcjmceom	oauth	google	116798919041763409124	\N	mock_google_access_token_placeholder	1784445611	Bearer	openid https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email	eyJhbGciOiJSUzI1NiIsImtpZCI6IjU4OTYyMjUzMjk3OTQzNDZiMDYzOWU2ZjlkN2JkOGJjZTI5NTRmZDIiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiIyMTY2NTg2MzU3MjgtYm84MXVna29sa2xuaTExYXBsOWZlMGl0NTRnbWZldXUuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiIyMTY2NTg2MzU3MjgtYm84MXVna29sa2xuaTExYXBsOWZlMGl0NTRnbWZldXUuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMTY3OTg5MTkwNDE3NjM0MDkxMjQiLCJoZCI6Imlnbml0ZS1pZGVhLmNvbSIsImVtYWlsIjoiYXNhbmFAaWduaXRlLWlkZWEuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImF0X2hhc2giOiJpUWxSdFRrXzBnSXBBOHlJWjM4Nk1nIiwibmFtZSI6IkFzYW5hIFRhd2FuYW1wYWkiLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jS0hGYzRsQk9waU03Uno4UXVLYTh5WVJ2N252bXEzREp1WVdsQk9wNmQyTHV0bG1iQT1zOTYtYyIsImdpdmVuX25hbWUiOiJBc2FuYSIsImZhbWlseV9uYW1lIjoiVGF3YW5hbXBhaSIsImlhdCI6MTc4NDQ0MjAxMywiZXhwIjoxNzg0NDQ1NjEzfQ.dOjEPwLI42nJa0Yk56nXeop3_WBTVVhspfXqlMAdl4Wgct1yG-zK3ZOndMd6JuMzUz30m4LSkpmqrHCMNLkGSzbh9vNUQ0VZjcV67Tbp-lHH5rm72OX7VYxQRtXn7C_y7Fdh7Uwr6vt-pqaxHwwbE15CFuFJNdefV7Nw0S1IUQs9XIIfR0HgElSCtfwDvl7ZGsA6NqTr3pYe4jK6agN7uesoBmIgx1wWOrZHx_LYU1J3mAGSJAFYXegrpJLw4Xwz4JKQihE8fZPyWX_WdT7rDdp-xit2-eezGhTJ7Vt3EgkOeBzSlZY-G8bkgLQRWHd39OAnmYgyITXlkkkvIcu07Q	\N
\.


--
-- Data for Name: console_apps; Type: TABLE DATA; Schema: core; Owner: postgres
--

COPY core.console_apps (id, tenant_id, name, icon, "order", created_at, updated_at, required_capability) FROM stdin;
cmrren4zy0005ky2drpf29ccy	cmrren4zs0000ky2dfuxxs3td	Settings & Admin	Settings	99	2026-07-19 06:18:34.126	2026-07-19 06:18:34.126	ADMIN
cmrrenjdq0001ky2ctfwsqfkq	cmrren4zs0000ky2dfuxxs3td	Sales	ShoppingBag	0	2026-07-19 06:18:52.766	2026-07-19 06:18:52.766	\N
cmrrenjtt000dky2cxzp8vmjb	cmrren4zs0000ky2dfuxxs3td	Sales Manager	Briefcase	1	2026-07-19 06:18:53.345	2026-07-19 06:18:53.345	\N
cmrrenk68000pky2cudhletfb	cmrren4zs0000ky2dfuxxs3td	Marketing	Megaphone	2	2026-07-19 06:18:53.792	2026-07-19 06:18:53.792	\N
cmrrenkjl0011ky2cs4chpqwp	cmrren4zs0000ky2dfuxxs3td	Services	LifeBuoy	3	2026-07-19 06:18:54.273	2026-07-19 06:18:54.273	\N
\.


--
-- Data for Name: console_menus; Type: TABLE DATA; Schema: core; Owner: postgres
--

COPY core.console_menus (id, app_id, label, icon, path, action_type, parent_id, "order", required_capability, component_key) FROM stdin;
cmrren4zy0006ky2dywcbzigr	cmrren4zy0005ky2drpf29ccy	General	Sliders	\N	plugin	\N	0	\N	\N
cmrren4zy000aky2djxij4dnp	cmrren4zy0005ky2drpf29ccy	Users & Team	Users	\N	plugin	\N	1	\N	\N
cmrren4zy000eky2d5eyztko0	cmrren4zy0005ky2drpf29ccy	Platform Studio	Layout	\N	plugin	\N	2	\N	\N
cmrren4zy000iky2dzgvllyyf	cmrren4zy0005ky2drpf29ccy	Identity & Security	Lock	\N	plugin	\N	3	\N	\N
cmrren4zy000mky2dg99uaogo	cmrren4zy0005ky2drpf29ccy	Extensions	Blocks	\N	plugin	\N	4	\N	\N
cmrren4zy000pky2dpx3qs7d0	cmrren4zy0005ky2drpf29ccy	Governance	Building2	\N	plugin	\N	5	\N	\N
cmrren4zy0007ky2d85p4ocye	cmrren4zy0005ky2drpf29ccy	Company Profile	Building	/admin/profile	plugin	cmrren4zy0006ky2dywcbzigr	0	system.settings.profile	AdminCompanyProfile
cmrren4zy0008ky2dkptohb3q	cmrren4zy0005ky2drpf29ccy	General Settings	Settings	/admin/general	plugin	cmrren4zy0006ky2dywcbzigr	1	system.settings.edit	AdminGeneralSettings
cmrren4zy0009ky2dszh4rso9	cmrren4zy0005ky2drpf29ccy	Subscription & Billing	CreditCard	/admin/billing	plugin	cmrren4zy0006ky2dywcbzigr	2	system.billing.manage	AdminBilling
cmrren4zy000bky2ddoe9254s	cmrren4zy0005ky2drpf29ccy	Users	UserPlus	/admin/users	plugin	cmrren4zy000aky2djxij4dnp	0	system.users.manage	AdminUserManager
cmrren4zy000cky2di741v67l	cmrren4zy0005ky2drpf29ccy	Teams	GitBranch	/admin/teams	plugin	cmrren4zy000aky2djxij4dnp	1	system.teams.manage	AdminTeamManager
cmrren4zy000dky2d44ntpye6	cmrren4zy0005ky2drpf29ccy	Access Roles	ShieldCheck	/admin/roles	plugin	cmrren4zy000aky2djxij4dnp	2	system.roles.assign	AdminPermissions
cmrren4zy000fky2dz2ubyib1	cmrren4zy0005ky2drpf29ccy	Data Model	Database	/admin/schema	plugin	cmrren4zy000eky2d5eyztko0	0	system.schema.manage	AdminEntityManager
cmrren4zy000views000000001	cmrren4zy0005ky2drpf29ccy	Views	LayoutTemplate	/admin/views	plugin	cmrren4zy000eky2d5eyztko0	1	system.schema.manage	AdminViewManager
cmrren4zy000gky2db6xp98ek	cmrren4zy0005ky2drpf29ccy	Console Apps	LayoutGrid	/admin/apps	plugin	cmrren4zy000eky2d5eyztko0	2	system.apps.manage	AdminAppManager
cmrren4zy000hky2dovgh6gur	cmrren4zy0005ky2drpf29ccy	Navigation Menus	Menu	/admin/menus	plugin	cmrren4zy000eky2d5eyztko0	3	system.menus.manage	AdminMenuManager
cmrren4zy000jky2dpyji1i2a	cmrren4zy0005ky2drpf29ccy	SSO Configuration	Key	/admin/sso	plugin	cmrren4zy000iky2dzgvllyyf	0	system.security.sso	AdminSSOConfig
cmrren4zy000kky2diyy3a63e	cmrren4zy0005ky2drpf29ccy	API Tokens	FileDigit	/admin/tokens	plugin	cmrren4zy000iky2dzgvllyyf	1	system.security.tokens	AdminApiTokens
cmrren4zy000lky2dwj0ox01h	cmrren4zy0005ky2drpf29ccy	Connected Apps	Link	/admin/apps	plugin	cmrren4zy000iky2dzgvllyyf	2	system.security.apps	AdminConnectedApps
cmrren4zy000nky2dliu6dtys	cmrren4zy0005ky2drpf29ccy	Custom Modules (BYOC)	Code2	/admin/byoc	plugin	cmrren4zy000mky2dg99uaogo	0	system.extensions.byoc	AdminByocModules
cmrren4zy000oky2dzn1867ov	cmrren4zy0005ky2drpf29ccy	API & Webhooks	Webhook	/admin/integrations	plugin	cmrren4zy000mky2dg99uaogo	1	system.integrations.api	AdminIntegrations
cmrren4zy000qky2d9zbsh9wc	cmrren4zy0005ky2drpf29ccy	Audit History	FileClock	/admin/audit	plugin	cmrren4zy000pky2dpx3qs7d0	0	system.audit.view	AdminAuditLog
cmrrenjj90003ky2cgohlc9w6	cmrrenjdq0001ky2ctfwsqfkq	Leads	Users	/table/leads	table	\N	0	\N	\N
cmrrenjlf0005ky2ctmomfdxd	cmrrenjdq0001ky2ctfwsqfkq	Accounts	Building	/table/accounts	table	\N	1	\N	\N
cmrrenjnj0007ky2c22sf7rvr	cmrrenjdq0001ky2ctfwsqfkq	Contacts	UserSquare	/table/contacts	table	\N	2	\N	\N
cmrrenjpm0009ky2crgnkmqzb	cmrrenjdq0001ky2ctfwsqfkq	Opportunities	Target	/table/opportunities	table	\N	3	\N	\N
cmrrenjrp000bky2c6mmm82jn	cmrrenjdq0001ky2ctfwsqfkq	Quotes	FileText	/table/quotes	table	\N	4	\N	\N
cmrrenjvw000fky2ccttltl0d	cmrrenjtt000dky2cxzp8vmjb	Team Performance	BarChart3	/dashboard/performance	plugin	\N	0	\N	\N
cmrrenjy0000hky2cxqao7rr1	cmrrenjtt000dky2cxzp8vmjb	Sales Forecast	LineChart	/dashboard/forecast	plugin	\N	1	\N	\N
cmrrenk02000jky2c6z5jw9pq	cmrrenjtt000dky2cxzp8vmjb	Territory Management	Map	/table/territories	table	\N	2	\N	\N
cmrrenk24000lky2cfaw8amqy	cmrrenjtt000dky2cxzp8vmjb	Commission Reports	BadgeDollarSign	/table/commissions	table	\N	3	\N	\N
cmrrenk46000nky2cnyp3p6jz	cmrrenjtt000dky2cxzp8vmjb	Approval Requests	ClipboardCheck	/approvals	plugin	\N	4	\N	\N
cmrrenk8b000rky2cydhwhxxe	cmrrenk68000pky2cudhletfb	Campaigns	Flag	/table/campaigns	table	\N	0	\N	\N
cmrrenkaf000tky2c631djysf	cmrrenk68000pky2cudhletfb	Email Templates	Mail	/table/templates	table	\N	1	\N	\N
cmrrenkci000vky2c2b881ddi	cmrrenk68000pky2cudhletfb	Content Library	Library	/library	plugin	\N	2	\N	\N
cmrrenkeq000xky2cdpbz8t9a	cmrrenk68000pky2cudhletfb	Social Analytics	Share2	/dashboard/social	plugin	\N	3	\N	\N
cmrrenkh6000zky2cpabrtdtv	cmrrenk68000pky2cudhletfb	Customer Segments	Users2	/table/segments	table	\N	4	\N	\N
cmrrenklx0013ky2carns6cfr	cmrrenkjl0011ky2cs4chpqwp	Support Cases	Inbox	/table/cases	table	\N	0	\N	\N
cmrrenkor0015ky2cbco0i2ii	cmrrenkjl0011ky2cs4chpqwp	Knowledge Base	BookOpen	/kb	plugin	\N	1	\N	\N
cmrrenkr30017ky2ceyv43x9x	cmrrenkjl0011ky2cs4chpqwp	SLA Management	ShieldCheck	/table/sla	table	\N	2	\N	\N
cmrrenku00019ky2cpmtp0y22	cmrrenkjl0011ky2cs4chpqwp	Customer Feedback	MessageSquare	/table/feedback	table	\N	3	\N	\N
cmrrenkwr001bky2cypv9gylk	cmrrenkjl0011ky2cs4chpqwp	Resource Scheduling	Calendar	/calendar/resources	plugin	\N	4	\N	\N
\.


--
-- Data for Name: data_audit_logs; Type: TABLE DATA; Schema: core; Owner: postgres
--

COPY core.data_audit_logs (id, tenant_id, user_id, ip_address, action, object_name, record_id, old_values, new_values, created_at) FROM stdin;
\.


--
-- Data for Name: ddl_logs; Type: TABLE DATA; Schema: core; Owner: postgres
--

COPY core.ddl_logs (id, tenant_id, user_id, schema_name, table_name, action, sql_executed, created_at) FROM stdin;
mrrg9t4pf3909ba7b02c8c05	cmrren4zs0000ky2dfuxxs3td	cmrren4zv0003ky2dvoemwg2x	tenant_klao_default	Order	CREATE_TABLE	CREATE TABLE tenant_klao_default."Order" (\n        id VARCHAR(30) PRIMARY KEY,\n        tenant_id VARCHAR(30) DEFAULT NULLIF(current_setting('app.current_tenant_id', true), '') NOT NULL,\n        created_at TIMESTAMPTZ DEFAULT NOW(),\n        updated_at TIMESTAMPTZ DEFAULT NOW(),\n        owner_id VARCHAR(30) DEFAULT NULLIF(current_setting('app.current_user_id', true), '') NOT NULL,\n        owner_team_id VARCHAR(30) DEFAULT NULLIF(current_setting('app.current_team_id', true), ''),\n        created_by VARCHAR(30) NULL,\n        updated_by VARCHAR(30) NULL\n      )	2026-07-19 07:04:11.45
mrrg9t52e0001745ee9e259c	cmrren4zs0000ky2dfuxxs3td	cmrren4zv0003ky2dvoemwg2x	tenant_klao_default	Order	CREATE_POLICY	CREATE POLICY "Order_owner_policy" ON tenant_klao_default."Order" \n       FOR ALL \n       USING (\n         tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')\n         AND (\n           owner_id = NULLIF(current_setting('app.current_user_id', true), '')\n           OR owner_team_id = NULLIF(current_setting('app.current_team_id', true), '')\n           OR EXISTS (\n             SELECT 1 FROM core.user_teams ut\n             LEFT JOIN core.object_permissions p ON ut.team_id = p.team_id AND p.object_name = 'Order'\n             LEFT JOIN core.teams t ON ut.team_id = t.id\n             WHERE ut.user_id = NULLIF(current_setting('app.current_user_id', true), '')\n             AND t.tenant_id = tenant_id\n             AND (p.view_all_data = true OR t.is_system_admin = true)\n           )\n           OR owner_id IN (\n             SELECT user_id FROM core.user_teams ut\n             JOIN core.teams t ON ut.team_id = t.id\n             WHERE t.parent_id IN (\n               SELECT team_id FROM core.user_teams WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')\n             )\n             AND t.tenant_id = tenant_id\n           )\n           OR owner_team_id IN (\n             SELECT id FROM core.teams \n             WHERE parent_id IN (\n               SELECT team_id FROM core.user_teams WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')\n             )\n             AND tenant_id = tenant_id\n           )\n         )\n       )	2026-07-19 07:04:11.463
mrrga3ce8a3b3f6cecb28533	cmrren4zs0000ky2dfuxxs3td	cmrren4zv0003ky2dvoemwg2x	tenant_klao_default	Order	ADD_COLUMN	ALTER TABLE tenant_klao_default."Order" ADD COLUMN "OrderName" TEXT	2026-07-19 07:04:24.687
mruscvqracf4cbad9097367f	cmrren4zs0000ky2dfuxxs3td	cmrren4zv0003ky2dvoemwg2x	tenant_klao_default	Lead	ADD_COLUMN	ALTER TABLE tenant_klao_default."Lead" ADD COLUMN "Name" TEXT	2026-07-21 15:05:48.724
mrusf6r6c82fb54e669538ff	cmrren4zs0000ky2dfuxxs3td	cmrren4zv0003ky2dvoemwg2x	tenant_klao_default	Lead	ADD_COLUMN	ALTER TABLE tenant_klao_default."Lead" ADD COLUMN "Name2" TEXT	2026-07-21 15:07:36.307
mrusff1g9853ba9dfbf245fc	cmrren4zs0000ky2dfuxxs3td	cmrren4zv0003ky2dvoemwg2x	tenant_klao_default	Lead	DROP_COLUMN	ALTER TABLE tenant_klao_default."Lead" DROP COLUMN "Name2" CASCADE	2026-07-21 15:07:47.045
mrwbe0ybee71975aad4863a8	cmrren4zs0000ky2dfuxxs3td	cmrren4zv0003ky2dvoemwg2x	tenant_klao_default	Order	ADD_COLUMN	ALTER TABLE tenant_klao_default."Order" ADD COLUMN ordertype TEXT	2026-07-22 16:46:21.013
mrwc30ptcf855526887d71ce	cmrren4zs0000ky2dfuxxs3td	cmrren4zv0003ky2dvoemwg2x	tenant_klao_default	Order	ALTER_COLUMN_TYPE	ALTER TABLE tenant_klao_default."Order" ALTER COLUMN ordertype TYPE NUMERIC USING ordertype::NUMERIC	2026-07-22 17:05:47.105
mrwc30pt4ba38d4199d1917e	cmrren4zs0000ky2dfuxxs3td	cmrren4zv0003ky2dvoemwg2x	tenant_klao_default	Order	ALTER_COLUMN_TYPE	ALTER TABLE tenant_klao_default."Order" ALTER COLUMN ordertype TYPE NUMERIC USING ordertype::NUMERIC	2026-07-22 17:05:47.106
mrwc36y3fa0e490fcae9ac97	cmrren4zs0000ky2dfuxxs3td	cmrren4zv0003ky2dvoemwg2x	tenant_klao_default	Order	ALTER_COLUMN_TYPE	ALTER TABLE tenant_klao_default."Order" ALTER COLUMN ordertype TYPE TEXT USING ordertype::TEXT	2026-07-22 17:05:55.181
\.


--
-- Data for Name: fields; Type: TABLE DATA; Schema: core; Owner: postgres
--

COPY core.fields (id, table_id, name, field_name, physical_type, logical_type, config, is_required, default_value, created_at, description) FROM stdin;
cmrrga3cf0005ky2dtd72dkr3	cmrrg9t530003ky2dkd0p5aho	Order Name	OrderName	text	short_text	{}	f	\N	2026-07-19 07:04:24.687	\N
cmrwbe0yd0001ky2cc9c7w09b	cmrrg9t530003ky2dkd0p5aho	Order Type	ordertype	text	select	{"options": [{"label": "Type 1", "value": "type_1"}, {"label": "Type 2", "value": "type_2"}, {"label": "Type 3", "value": "type_3"}], "sourceType": "custom", "allowMultiple": false}	f	\N	2026-07-22 16:46:21.013	
\.


--
-- Data for Name: object_permissions; Type: TABLE DATA; Schema: core; Owner: postgres
--

COPY core.object_permissions (id, object_name, can_create, can_read, can_update, can_delete, view_all_data, modify_all_data, team_id) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: core; Owner: postgres
--

COPY core.sessions (id, session_token, user_id, expires) FROM stdin;
\.


--
-- Data for Name: system_event_logs; Type: TABLE DATA; Schema: core; Owner: postgres
--

COPY core.system_event_logs (id, tenant_id, user_id, ip_address, category, action, event_name, details, created_at) FROM stdin;
mrrg9t544aab344a0d1c7ffa	cmrren4zs0000ky2dfuxxs3td	cmrren4zv0003ky2dvoemwg2x	\N	METADATA	CREATE	Create Table Definition	{"id": "cmrrg9t530003ky2dkd0p5aho", "name": "Order", "tableName": "Order", "description": ""}	2026-07-19 07:04:11.468
mrrga3ck492fdf7bb27e77b9	cmrren4zs0000ky2dfuxxs3td	cmrren4zv0003ky2dvoemwg2x	\N	METADATA	CREATE	Create Field Definition	{"id": "cmrrga3cf0005ky2dtd72dkr3", "name": "Order Name", "tableId": "cmrrg9t530003ky2dkd0p5aho", "fieldName": "OrderName", "isRequired": false, "logicalType": "short_text", "physicalType": "text"}	2026-07-19 07:04:24.694
mrusf6r86393ea3faff5adb7	cmrren4zs0000ky2dfuxxs3td	cmrren4zv0003ky2dvoemwg2x	\N	METADATA	CREATE	Create Field Definition	{"id": "cmrusf6r70001ky2dbiga8cd8", "name": "ชื่อ", "tableId": "cmrrfpoqy0001ky2d8b1gk4tk", "fieldName": "Name2", "isRequired": false, "description": "Name", "logicalType": "short_text", "physicalType": "text"}	2026-07-21 15:07:36.404
mrwbe0yj65807035a2902045	cmrren4zs0000ky2dfuxxs3td	cmrren4zv0003ky2dvoemwg2x	\N	METADATA	CREATE	Create Field Definition	{"id": "cmrwbe0yd0001ky2cc9c7w09b", "name": "Order Type", "tableId": "cmrrg9t530003ky2dkd0p5aho", "fieldName": "ordertype", "isRequired": false, "description": "", "logicalType": "select", "physicalType": "text"}	2026-07-22 16:46:21.078
\.


--
-- Data for Name: system_permissions; Type: TABLE DATA; Schema: core; Owner: postgres
--

COPY core.system_permissions (id, team_id, capability) FROM stdin;
\.


--
-- Data for Name: tables; Type: TABLE DATA; Schema: core; Owner: postgres
--

COPY core.tables (id, tenant_id, name, table_name, description, created_at) FROM stdin;
cmrrg9t530003ky2dkd0p5aho	cmrren4zs0000ky2dfuxxs3td	Order	Order	This Data Model is to store the Order 	2026-07-19 07:04:11.463
cmrrfpoqy0001ky2d8b1gk4tk	cmrren4zs0000ky2dfuxxs3td	Lead	Lead	Manage all Lead in System	2026-07-19 06:48:32.65
\.


--
-- Data for Name: teams; Type: TABLE DATA; Schema: core; Owner: postgres
--

COPY core.teams (id, tenant_id, name, is_system_admin, parent_id) FROM stdin;
cmrren4zs0001ky2dp7gr3q20	cmrren4zs0000ky2dfuxxs3td	System Administrator	t	\N
\.


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: core; Owner: postgres
--

COPY core.tenants (id, name, schema_name, created_at, updated_at) FROM stdin;
cmrren4zs0000ky2dfuxxs3td	KLAO Default	tenant_klao_default	2026-07-19 06:18:34.121	2026-07-19 06:18:34.121
\.


--
-- Data for Name: user_teams; Type: TABLE DATA; Schema: core; Owner: postgres
--

COPY core.user_teams (user_id, team_id, is_leader) FROM stdin;
cmrren4zv0003ky2dvoemwg2x	cmrren4zs0001ky2dp7gr3q20	t
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: core; Owner: postgres
--

COPY core.users (id, name, email, email_verified, image, password, tenant_id, role, created_at, updated_at, google_domain, google_id, is_active, last_login_at, metadata, phone, title) FROM stdin;
cmrren4zv0003ky2dvoemwg2x	Tenant Administrator	admin@klao.app	\N	\N	$2b$12$zuEnB61aE3PKKCuGr2BmxOgxcGxXCc6eC4j7rn5NUzYWAi4NUEHKW	cmrren4zs0000ky2dfuxxs3td	TENANT_ADMIN	2026-07-19 06:18:34.123	2026-07-19 06:24:44.08	\N	\N	t	2026-07-19 06:22:09.987	{}		
cmrrep9ol001dky2ckcjmceom	Asana Tawanampai	asana@ignite-idea.com	2026-07-19 06:20:13.502	https://lh3.googleusercontent.com/a/ACg8ocKHFc4lBOpiM7Rz8QuKa8yYRv7nvmq3DJuYWlBOp6d2LutlmbA=s96-c	\N	cmrren4zs0000ky2dfuxxs3td	TENANT_ADMIN	2026-07-19 06:20:13.51	2026-07-19 06:24:53.093	ignite-idea.com	116798919041763409124	t	\N	{}		
\.


--
-- Data for Name: validation_rules; Type: TABLE DATA; Schema: core; Owner: postgres
--

COPY core.validation_rules (id, table_id, field_id, "ruleType", "ruleDefinition", error_message) FROM stdin;
\.


--
-- Data for Name: verification_tokens; Type: TABLE DATA; Schema: core; Owner: postgres
--

COPY core.verification_tokens (identifier, token, expires) FROM stdin;
\.


--
-- Data for Name: Lead; Type: TABLE DATA; Schema: tenant_klao_default; Owner: postgres
--

COPY tenant_klao_default."Lead" (id, tenant_id, created_at, updated_at, owner_id, owner_team_id, created_by, updated_by, "Name") FROM stdin;
\.


--
-- Data for Name: Order; Type: TABLE DATA; Schema: tenant_klao_default; Owner: postgres
--

COPY tenant_klao_default."Order" (id, tenant_id, created_at, updated_at, owner_id, owner_team_id, created_by, updated_by, "OrderName", ordertype) FROM stdin;
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: console_apps console_apps_pkey; Type: CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.console_apps
    ADD CONSTRAINT console_apps_pkey PRIMARY KEY (id);


--
-- Name: console_menus console_menus_pkey; Type: CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.console_menus
    ADD CONSTRAINT console_menus_pkey PRIMARY KEY (id);


--
-- Name: data_audit_logs data_audit_logs_pkey; Type: CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.data_audit_logs
    ADD CONSTRAINT data_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: ddl_logs ddl_logs_pkey; Type: CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.ddl_logs
    ADD CONSTRAINT ddl_logs_pkey PRIMARY KEY (id);


--
-- Name: fields fields_pkey; Type: CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.fields
    ADD CONSTRAINT fields_pkey PRIMARY KEY (id);


--
-- Name: object_permissions object_permissions_pkey; Type: CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.object_permissions
    ADD CONSTRAINT object_permissions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: system_event_logs system_event_logs_pkey; Type: CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.system_event_logs
    ADD CONSTRAINT system_event_logs_pkey PRIMARY KEY (id);


--
-- Name: system_permissions system_permissions_pkey; Type: CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.system_permissions
    ADD CONSTRAINT system_permissions_pkey PRIMARY KEY (id);


--
-- Name: tables tables_pkey; Type: CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.tables
    ADD CONSTRAINT tables_pkey PRIMARY KEY (id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: user_teams user_teams_pkey; Type: CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.user_teams
    ADD CONSTRAINT user_teams_pkey PRIMARY KEY (user_id, team_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: validation_rules validation_rules_pkey; Type: CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.validation_rules
    ADD CONSTRAINT validation_rules_pkey PRIMARY KEY (id);


--
-- Name: Lead Lead_pkey; Type: CONSTRAINT; Schema: tenant_klao_default; Owner: postgres
--

ALTER TABLE ONLY tenant_klao_default."Lead"
    ADD CONSTRAINT "Lead_pkey" PRIMARY KEY (id);


--
-- Name: Order Order_pkey; Type: CONSTRAINT; Schema: tenant_klao_default; Owner: postgres
--

ALTER TABLE ONLY tenant_klao_default."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY (id);


--
-- Name: accounts_provider_provider_account_id_key; Type: INDEX; Schema: core; Owner: postgres
--

CREATE UNIQUE INDEX accounts_provider_provider_account_id_key ON core.accounts USING btree (provider, provider_account_id);


--
-- Name: accounts_user_id_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX accounts_user_id_idx ON core.accounts USING btree (user_id);


--
-- Name: console_apps_tenant_id_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX console_apps_tenant_id_idx ON core.console_apps USING btree (tenant_id);


--
-- Name: console_apps_tenant_id_name_key; Type: INDEX; Schema: core; Owner: postgres
--

CREATE UNIQUE INDEX console_apps_tenant_id_name_key ON core.console_apps USING btree (tenant_id, name);


--
-- Name: console_menus_app_id_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX console_menus_app_id_idx ON core.console_menus USING btree (app_id);


--
-- Name: console_menus_parent_id_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX console_menus_parent_id_idx ON core.console_menus USING btree (parent_id);


--
-- Name: data_audit_logs_created_at_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX data_audit_logs_created_at_idx ON core.data_audit_logs USING btree (created_at);


--
-- Name: data_audit_logs_tenant_id_object_name_record_id_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX data_audit_logs_tenant_id_object_name_record_id_idx ON core.data_audit_logs USING btree (tenant_id, object_name, record_id);


--
-- Name: data_audit_logs_user_id_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX data_audit_logs_user_id_idx ON core.data_audit_logs USING btree (user_id);


--
-- Name: ddl_logs_created_at_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX ddl_logs_created_at_idx ON core.ddl_logs USING btree (created_at);


--
-- Name: ddl_logs_schema_name_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX ddl_logs_schema_name_idx ON core.ddl_logs USING btree (schema_name);


--
-- Name: fields_table_id_field_name_key; Type: INDEX; Schema: core; Owner: postgres
--

CREATE UNIQUE INDEX fields_table_id_field_name_key ON core.fields USING btree (table_id, field_name);


--
-- Name: fields_table_id_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX fields_table_id_idx ON core.fields USING btree (table_id);


--
-- Name: object_permissions_team_id_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX object_permissions_team_id_idx ON core.object_permissions USING btree (team_id);


--
-- Name: object_permissions_team_id_object_name_key; Type: INDEX; Schema: core; Owner: postgres
--

CREATE UNIQUE INDEX object_permissions_team_id_object_name_key ON core.object_permissions USING btree (team_id, object_name);


--
-- Name: sessions_session_token_key; Type: INDEX; Schema: core; Owner: postgres
--

CREATE UNIQUE INDEX sessions_session_token_key ON core.sessions USING btree (session_token);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX sessions_user_id_idx ON core.sessions USING btree (user_id);


--
-- Name: system_event_logs_created_at_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX system_event_logs_created_at_idx ON core.system_event_logs USING btree (created_at);


--
-- Name: system_event_logs_tenant_id_category_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX system_event_logs_tenant_id_category_idx ON core.system_event_logs USING btree (tenant_id, category);


--
-- Name: system_event_logs_user_id_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX system_event_logs_user_id_idx ON core.system_event_logs USING btree (user_id);


--
-- Name: system_permissions_team_id_capability_key; Type: INDEX; Schema: core; Owner: postgres
--

CREATE UNIQUE INDEX system_permissions_team_id_capability_key ON core.system_permissions USING btree (team_id, capability);


--
-- Name: system_permissions_team_id_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX system_permissions_team_id_idx ON core.system_permissions USING btree (team_id);


--
-- Name: tables_tenant_id_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX tables_tenant_id_idx ON core.tables USING btree (tenant_id);


--
-- Name: tables_tenant_id_table_name_key; Type: INDEX; Schema: core; Owner: postgres
--

CREATE UNIQUE INDEX tables_tenant_id_table_name_key ON core.tables USING btree (tenant_id, table_name);


--
-- Name: teams_parent_id_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX teams_parent_id_idx ON core.teams USING btree (parent_id);


--
-- Name: teams_tenant_id_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX teams_tenant_id_idx ON core.teams USING btree (tenant_id);


--
-- Name: tenants_created_at_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX tenants_created_at_idx ON core.tenants USING btree (created_at);


--
-- Name: tenants_schema_name_key; Type: INDEX; Schema: core; Owner: postgres
--

CREATE UNIQUE INDEX tenants_schema_name_key ON core.tenants USING btree (schema_name);


--
-- Name: user_teams_team_id_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX user_teams_team_id_idx ON core.user_teams USING btree (team_id);


--
-- Name: users_email_key; Type: INDEX; Schema: core; Owner: postgres
--

CREATE UNIQUE INDEX users_email_key ON core.users USING btree (email);


--
-- Name: users_google_id_key; Type: INDEX; Schema: core; Owner: postgres
--

CREATE UNIQUE INDEX users_google_id_key ON core.users USING btree (google_id);


--
-- Name: users_tenant_id_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX users_tenant_id_idx ON core.users USING btree (tenant_id);


--
-- Name: validation_rules_field_id_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX validation_rules_field_id_idx ON core.validation_rules USING btree (field_id);


--
-- Name: validation_rules_table_id_idx; Type: INDEX; Schema: core; Owner: postgres
--

CREATE INDEX validation_rules_table_id_idx ON core.validation_rules USING btree (table_id);


--
-- Name: verification_tokens_identifier_token_key; Type: INDEX; Schema: core; Owner: postgres
--

CREATE UNIQUE INDEX verification_tokens_identifier_token_key ON core.verification_tokens USING btree (identifier, token);


--
-- Name: verification_tokens_token_key; Type: INDEX; Schema: core; Owner: postgres
--

CREATE UNIQUE INDEX verification_tokens_token_key ON core.verification_tokens USING btree (token);


--
-- Name: accounts accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.accounts
    ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES core.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: console_apps console_apps_tenant_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.console_apps
    ADD CONSTRAINT console_apps_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES core.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: console_menus console_menus_app_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.console_menus
    ADD CONSTRAINT console_menus_app_id_fkey FOREIGN KEY (app_id) REFERENCES core.console_apps(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: console_menus console_menus_parent_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.console_menus
    ADD CONSTRAINT console_menus_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES core.console_menus(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: data_audit_logs data_audit_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.data_audit_logs
    ADD CONSTRAINT data_audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES core.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: data_audit_logs data_audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.data_audit_logs
    ADD CONSTRAINT data_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES core.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ddl_logs ddl_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.ddl_logs
    ADD CONSTRAINT ddl_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES core.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ddl_logs ddl_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.ddl_logs
    ADD CONSTRAINT ddl_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES core.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: fields fields_table_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.fields
    ADD CONSTRAINT fields_table_id_fkey FOREIGN KEY (table_id) REFERENCES core.tables(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: object_permissions object_permissions_team_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.object_permissions
    ADD CONSTRAINT object_permissions_team_id_fkey FOREIGN KEY (team_id) REFERENCES core.teams(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES core.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: system_event_logs system_event_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.system_event_logs
    ADD CONSTRAINT system_event_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES core.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: system_event_logs system_event_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.system_event_logs
    ADD CONSTRAINT system_event_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES core.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: system_permissions system_permissions_team_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.system_permissions
    ADD CONSTRAINT system_permissions_team_id_fkey FOREIGN KEY (team_id) REFERENCES core.teams(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tables tables_tenant_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.tables
    ADD CONSTRAINT tables_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES core.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: teams teams_parent_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.teams
    ADD CONSTRAINT teams_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES core.teams(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: teams teams_tenant_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.teams
    ADD CONSTRAINT teams_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES core.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_teams user_teams_team_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.user_teams
    ADD CONSTRAINT user_teams_team_id_fkey FOREIGN KEY (team_id) REFERENCES core.teams(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_teams user_teams_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.user_teams
    ADD CONSTRAINT user_teams_user_id_fkey FOREIGN KEY (user_id) REFERENCES core.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES core.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: validation_rules validation_rules_field_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.validation_rules
    ADD CONSTRAINT validation_rules_field_id_fkey FOREIGN KEY (field_id) REFERENCES core.fields(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: validation_rules validation_rules_table_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: postgres
--

ALTER TABLE ONLY core.validation_rules
    ADD CONSTRAINT validation_rules_table_id_fkey FOREIGN KEY (table_id) REFERENCES core.tables(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Lead; Type: ROW SECURITY; Schema: tenant_klao_default; Owner: postgres
--

ALTER TABLE tenant_klao_default."Lead" ENABLE ROW LEVEL SECURITY;

--
-- Name: Lead Lead_owner_policy; Type: POLICY; Schema: tenant_klao_default; Owner: postgres
--

CREATE POLICY "Lead_owner_policy" ON tenant_klao_default."Lead" USING ((((tenant_id)::text = NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)) AND (((owner_id)::text = NULLIF(current_setting('app.current_user_id'::text, true), ''::text)) OR ((owner_team_id)::text = NULLIF(current_setting('app.current_team_id'::text, true), ''::text)) OR (EXISTS ( SELECT 1
   FROM ((core.user_teams ut
     LEFT JOIN core.object_permissions p ON (((ut.team_id = p.team_id) AND (p.object_name = 'Lead'::text))))
     LEFT JOIN core.teams t ON ((ut.team_id = t.id)))
  WHERE ((ut.user_id = NULLIF(current_setting('app.current_user_id'::text, true), ''::text)) AND (t.tenant_id = t.tenant_id) AND ((p.view_all_data = true) OR (t.is_system_admin = true))))) OR ((owner_id)::text IN ( SELECT ut.user_id
   FROM (core.user_teams ut
     JOIN core.teams t ON ((ut.team_id = t.id)))
  WHERE ((t.parent_id IN ( SELECT user_teams.team_id
           FROM core.user_teams
          WHERE (user_teams.user_id = NULLIF(current_setting('app.current_user_id'::text, true), ''::text)))) AND (t.tenant_id = t.tenant_id)))) OR ((owner_team_id)::text IN ( SELECT teams.id
   FROM core.teams
  WHERE ((teams.parent_id IN ( SELECT user_teams.team_id
           FROM core.user_teams
          WHERE (user_teams.user_id = NULLIF(current_setting('app.current_user_id'::text, true), ''::text)))) AND (teams.tenant_id = teams.tenant_id)))))));


--
-- Name: Order; Type: ROW SECURITY; Schema: tenant_klao_default; Owner: postgres
--

ALTER TABLE tenant_klao_default."Order" ENABLE ROW LEVEL SECURITY;

--
-- Name: Order Order_owner_policy; Type: POLICY; Schema: tenant_klao_default; Owner: postgres
--

CREATE POLICY "Order_owner_policy" ON tenant_klao_default."Order" USING ((((tenant_id)::text = NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)) AND (((owner_id)::text = NULLIF(current_setting('app.current_user_id'::text, true), ''::text)) OR ((owner_team_id)::text = NULLIF(current_setting('app.current_team_id'::text, true), ''::text)) OR (EXISTS ( SELECT 1
   FROM ((core.user_teams ut
     LEFT JOIN core.object_permissions p ON (((ut.team_id = p.team_id) AND (p.object_name = 'Order'::text))))
     LEFT JOIN core.teams t ON ((ut.team_id = t.id)))
  WHERE ((ut.user_id = NULLIF(current_setting('app.current_user_id'::text, true), ''::text)) AND (t.tenant_id = t.tenant_id) AND ((p.view_all_data = true) OR (t.is_system_admin = true))))) OR ((owner_id)::text IN ( SELECT ut.user_id
   FROM (core.user_teams ut
     JOIN core.teams t ON ((ut.team_id = t.id)))
  WHERE ((t.parent_id IN ( SELECT user_teams.team_id
           FROM core.user_teams
          WHERE (user_teams.user_id = NULLIF(current_setting('app.current_user_id'::text, true), ''::text)))) AND (t.tenant_id = t.tenant_id)))) OR ((owner_team_id)::text IN ( SELECT teams.id
   FROM core.teams
  WHERE ((teams.parent_id IN ( SELECT user_teams.team_id
           FROM core.user_teams
          WHERE (user_teams.user_id = NULLIF(current_setting('app.current_user_id'::text, true), ''::text)))) AND (teams.tenant_id = teams.tenant_id)))))));


--
-- Name: SCHEMA core; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA core TO rls_user;


--
-- Name: TABLE object_permissions; Type: ACL; Schema: core; Owner: postgres
--

GRANT SELECT ON TABLE core.object_permissions TO rls_user;


--
-- Name: TABLE teams; Type: ACL; Schema: core; Owner: postgres
--

GRANT SELECT ON TABLE core.teams TO rls_user;


--
-- Name: TABLE user_teams; Type: ACL; Schema: core; Owner: postgres
--

GRANT SELECT ON TABLE core.user_teams TO rls_user;


--
-- Name: TABLE users; Type: ACL; Schema: core; Owner: postgres
--

GRANT SELECT ON TABLE core.users TO rls_user;


--
-- PostgreSQL database dump complete
--

\unrestrict CG5YEmLWWh8EvjMQDKBPEm4iVZ5elgMC7ZlSziHAwqyGXLt1vxJGSmD5AV5edwg

