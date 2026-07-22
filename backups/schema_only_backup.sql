--
-- PostgreSQL database dump
--

\restrict tHTQxsVkIgWDuX3tasP26YbZVgLc6pW90zpcSoKpXHzXaHyNpu3Q5TKvQ6Gh2q8

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

\unrestrict tHTQxsVkIgWDuX3tasP26YbZVgLc6pW90zpcSoKpXHzXaHyNpu3Q5TKvQ6Gh2q8

