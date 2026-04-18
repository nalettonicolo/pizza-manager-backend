-- =============================================================================
-- PizzaManager — SCHEMA SQL COMPLETO (baseline unificato)
-- =============================================================================
-- Contenuto: ex supabase/migrations/*.sql consolidate in un unico file, in ordine:
--   1) 20260220171734_remote_schema.sql (snapshot Supabase)
--   2) 20260405120000 + 20260405140000 (registratore Super Admin)
--   3) 20260406100000_post_remote_schema_unified.sql (incrementale unificato)
--   4) delivery / turni cassa / ordine / audit / Stripe / rider / vista Ordine / policy anon
--
-- Modifiche successive al baseline: solo sql/sql_upgrade.sql (idempotente).
-- Cartella supabase/migrations/ non contiene più file SQL (usare sql_upgrade o rigenerare snapshot).
--
-- In coda: blocco "CONSOLIDAMENTO sql/modules" (contabilità, magazzino, fiscal/payment,
-- estensioni core.punti_vendita per seed multi-PV, vista Ordine allineata a sql_upgrade).
-- I file sotto sql/modules/ restano copie di lavoro; fonte operativa unica: questo file + sql_upgrade.
-- =============================================================================

-- ---------- BEGIN: supabase/migrations/20260220171734_remote_schema.sql ----------



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


CREATE SCHEMA IF NOT EXISTS "admin";


ALTER SCHEMA "admin" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "app";


ALTER SCHEMA "app" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "core";


ALTER SCHEMA "core" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "pizzamanager";


ALTER SCHEMA "pizzamanager" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "pizzamanager"."LicenseStatus" AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'EXPIRED'
);


ALTER TYPE "pizzamanager"."LicenseStatus" OWNER TO "postgres";


CREATE TYPE "pizzamanager"."UserRole" AS ENUM (
    'ADMIN',
    'STAFF'
);


ALTER TYPE "pizzamanager"."UserRole" OWNER TO "postgres";


CREATE TYPE "public"."IngredientQuantity" AS ENUM (
    'SENZA',
    'POCO',
    'NORMALE',
    'ABBONDANTE',
    'DOPPIO'
);


ALTER TYPE "public"."IngredientQuantity" OWNER TO "postgres";


CREATE TYPE "public"."UserRole" AS ENUM (
    'SUPER_ADMIN',
    'ADMIN',
    'STAFF',
    'RIDER'
);


ALTER TYPE "public"."UserRole" OWNER TO "postgres";


CREATE TYPE "public"."ruolo_azienda" AS ENUM (
    'owner',
    'admin',
    'manager',
    'operatore',
    'viewer'
);


ALTER TYPE "public"."ruolo_azienda" OWNER TO "postgres";


CREATE TYPE "public"."ruolo_sistema_enum" AS ENUM (
    'admin',
    'bancone',
    'pony'
);


ALTER TYPE "public"."ruolo_sistema_enum" OWNER TO "postgres";


CREATE TYPE "public"."ruolo_utente" AS ENUM (
    'superadmin',
    'admin',
    'operatore',
    'cassiere',
    'pizzaiolo'
);


ALTER TYPE "public"."ruolo_utente" OWNER TO "postgres";


CREATE TYPE "public"."stato_ordine" AS ENUM (
    'bozza',
    'confermato',
    'in_preparazione',
    'pronto',
    'consegnato',
    'annullato'
);


ALTER TYPE "public"."stato_ordine" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."audit_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO core.audit_log(
        user_id,
        table_name,
        action,
        record_id,
        old_data,
        new_data
    )
    VALUES (
        auth.uid(),
        TG_TABLE_NAME,
        TG_OP,
        COALESCE(NEW.id, OLD.id),
        to_jsonb(OLD),
        to_jsonb(NEW)
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "core"."audit_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."compute_audit_hash"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE last_hash text;
BEGIN
    SELECT hash INTO last_hash
    FROM core.audit_log
    ORDER BY created_at DESC
    LIMIT 1;

    NEW.previous_hash := last_hash;

    NEW.hash := encode(
        digest(
            coalesce(last_hash,'') ||
            NEW.table_name ||
            NEW.action ||
            coalesce(NEW.record_id::text,'') ||
            now()::text,
            'sha256'
        ),
        'hex'
    );

    RETURN NEW;
END;
$$;


ALTER FUNCTION "core"."compute_audit_hash"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."create_order_with_items"("p_tenant_id" "uuid", "p_totale" numeric, "p_stato" "text", "p_items" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_order_id uuid;
BEGIN

  -- 1️⃣ Crea ordine
  INSERT INTO core.ordini (
    tenant_id,
    totale,
    stato
  )
  VALUES (
    p_tenant_id,
    p_totale,
    p_stato
  )
  RETURNING id INTO v_order_id;

  -- 2️⃣ Inserisci order_items (validando tenant)
  INSERT INTO core.order_items (
    tenant_id,
    ordine_id,
    prodotto_id,
    quantita,
    prezzo
  )
  SELECT
    p_tenant_id,
    v_order_id,
    (item->>'prodotto_id')::uuid,
    (item->>'quantita')::integer,
    (item->>'prezzo')::numeric
  FROM jsonb_array_elements(p_items) AS item
  JOIN core.prodotti pr
    ON pr.id = (item->>'prodotto_id')::uuid
   AND pr.tenant_id = p_tenant_id;

  RETURN v_order_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Errore creazione ordine atomico: %', SQLERRM;
END;
$$;


ALTER FUNCTION "core"."create_order_with_items"("p_tenant_id" "uuid", "p_totale" numeric, "p_stato" "text", "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."create_tenant"("p_tenant_name" "text", "p_domain" "text", "p_plan" "text", "p_owner_user_id" "uuid", "p_owner_email" "text", "p_owner_full_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
    v_tenant_id uuid;
    v_subscription_id uuid;
    v_superadmin_role_id uuid;
    v_admin_role_id uuid;
    v_operator_role_id uuid;
    v_pos_id uuid;
begin

    -- 1️⃣ Create tenant
    insert into core.tenants (name, domain)
    values (p_tenant_name, p_domain)
    returning id into v_tenant_id;

    -- 2️⃣ Create subscription
    insert into core.subscriptions (tenant_id, plan)
    values (v_tenant_id, p_plan)
    returning id into v_subscription_id;

    -- 3️⃣ Create default roles

    insert into core.roles (tenant_id, name, is_system, is_superadmin)
    values (v_tenant_id, 'SuperAdmin', true, true)
    returning id into v_superadmin_role_id;

    insert into core.roles (tenant_id, name, is_system)
    values (v_tenant_id, 'Admin', true)
    returning id into v_admin_role_id;

    insert into core.roles (tenant_id, name, is_system)
    values (v_tenant_id, 'Operatore', true)
    returning id into v_operator_role_id;

    -- 4️⃣ Create default POS

    insert into core.points_of_sale (tenant_id, name, address)
    values (v_tenant_id, 'Sede Principale', 'Da configurare')
    returning id into v_pos_id;

    -- 5️⃣ Create user profile

    insert into core.user_profiles (
        user_id,
        tenant_id,
        email,
        full_name
    )
    values (
        p_owner_user_id,
        v_tenant_id,
        p_owner_email,
        p_owner_full_name
    );

    -- 6️⃣ Assign SuperAdmin role to owner

    insert into core.user_roles (
        user_id,
        tenant_id,
        point_of_sale_id,
        role_id
    )
    values (
        p_owner_user_id,
        v_tenant_id,
        v_pos_id,
        v_superadmin_role_id
    );

    return v_tenant_id;

end;
$$;


ALTER FUNCTION "core"."create_tenant"("p_tenant_name" "text", "p_domain" "text", "p_plan" "text", "p_owner_user_id" "uuid", "p_owner_email" "text", "p_owner_full_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."current_punto_vendita_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
    SELECT current_setting('app.punto_vendita_id', true)::uuid;
$$;


ALTER FUNCTION "core"."current_punto_vendita_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."current_tenant_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
    SELECT current_setting('app.tenant_id', true)::uuid;
$$;


ALTER FUNCTION "core"."current_tenant_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."decrypt_data"("data" "bytea") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE active_key text;
BEGIN
    SELECT key_name INTO active_key
    FROM core.encryption_keys
    WHERE is_active = true
    ORDER BY key_version DESC
    LIMIT 1;

    RETURN pgp_sym_decrypt(data, active_key);
END;
$$;


ALTER FUNCTION "core"."decrypt_data"("data" "bytea") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."enable_audit_on_all_tables"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'core'
          AND table_type = 'BASE TABLE'
          AND table_name NOT IN ('audit_log')
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS audit_trigger ON core.%I;
            CREATE TRIGGER audit_trigger
            AFTER INSERT OR UPDATE OR DELETE
            ON core.%I
            FOR EACH ROW
            EXECUTE FUNCTION core.audit_trigger();
        ', r.table_name, r.table_name);
    END LOOP;
END;
$$;


ALTER FUNCTION "core"."enable_audit_on_all_tables"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."enable_rls_for_table"("p_table_name" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    has_tenant boolean;
    has_pv boolean;
BEGIN

    -- Verifica presenza tenant_id
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'core'
        AND c.table_name = p_table_name
        AND c.column_name = 'tenant_id'
    ) INTO has_tenant;

    -- Verifica presenza punto_vendita_id
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'core'
        AND c.table_name = p_table_name
        AND c.column_name = 'punto_vendita_id'
    ) INTO has_pv;

    IF NOT has_tenant THEN
        RAISE EXCEPTION 'Tabella % non ha tenant_id', p_table_name;
    END IF;

    EXECUTE format('ALTER TABLE core.%I ENABLE ROW LEVEL SECURITY;', p_table_name);

    EXECUTE format('DROP POLICY IF EXISTS %I_select ON core.%I;', p_table_name, p_table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON core.%I;', p_table_name, p_table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON core.%I;', p_table_name, p_table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON core.%I;', p_table_name, p_table_name);

    IF has_pv THEN

        EXECUTE format(
        'CREATE POLICY %I_select ON core.%I
         FOR SELECT
         USING (
            core.is_superadmin()
            OR (
                tenant_id = core.current_tenant_id()
                AND punto_vendita_id = core.current_punto_vendita_id()
            )
         );',
        p_table_name, p_table_name);

        EXECUTE format(
        'CREATE POLICY %I_insert ON core.%I
         FOR INSERT
         WITH CHECK (
            core.is_superadmin()
            OR (
                tenant_id = core.current_tenant_id()
                AND punto_vendita_id = core.current_punto_vendita_id()
            )
         );',
        p_table_name, p_table_name);

        EXECUTE format(
        'CREATE POLICY %I_update ON core.%I
         FOR UPDATE
         USING (
            core.is_superadmin()
            OR (
                tenant_id = core.current_tenant_id()
                AND punto_vendita_id = core.current_punto_vendita_id()
            )
         )
         WITH CHECK (
            core.is_superadmin()
            OR (
                tenant_id = core.current_tenant_id()
                AND punto_vendita_id = core.current_punto_vendita_id()
            )
         );',
        p_table_name, p_table_name);

        EXECUTE format(
        'CREATE POLICY %I_delete ON core.%I
         FOR DELETE
         USING (
            core.is_superadmin()
            OR (
                tenant_id = core.current_tenant_id()
                AND punto_vendita_id = core.current_punto_vendita_id()
            )
         );',
        p_table_name, p_table_name);

    ELSE

        EXECUTE format(
        'CREATE POLICY %I_select ON core.%I
         FOR SELECT
         USING (
            core.is_superadmin()
            OR tenant_id = core.current_tenant_id()
         );',
        p_table_name, p_table_name);

        EXECUTE format(
        'CREATE POLICY %I_insert ON core.%I
         FOR INSERT
         WITH CHECK (
            core.is_superadmin()
            OR tenant_id = core.current_tenant_id()
         );',
        p_table_name, p_table_name);

        EXECUTE format(
        'CREATE POLICY %I_update ON core.%I
         FOR UPDATE
         USING (
            core.is_superadmin()
            OR tenant_id = core.current_tenant_id()
         )
         WITH CHECK (
            core.is_superadmin()
            OR tenant_id = core.current_tenant_id()
         );',
        p_table_name, p_table_name);

        EXECUTE format(
        'CREATE POLICY %I_delete ON core.%I
         FOR DELETE
         USING (
            core.is_superadmin()
            OR tenant_id = core.current_tenant_id()
         );',
        p_table_name, p_table_name);

    END IF;

END;
$$;


ALTER FUNCTION "core"."enable_rls_for_table"("p_table_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."enable_rls_on_all_tables"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    r record;
    has_tenant boolean;
BEGIN
    FOR r IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'core'
          AND table_type = 'BASE TABLE'
          AND table_name NOT IN ('audit_log')
    LOOP

        -- Verifica se la tabella ha tenant_id
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns c
            WHERE c.table_schema = 'core'
              AND c.table_name = r.table_name
              AND c.column_name = 'tenant_id'
        ) INTO has_tenant;

        IF has_tenant THEN
            PERFORM core.enable_rls_for_table(r.table_name);
        END IF;

    END LOOP;
END;
$$;


ALTER FUNCTION "core"."enable_rls_on_all_tables"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."encrypt_data"("data" "text") RETURNS "bytea"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE active_key text;
BEGIN
    SELECT key_name INTO active_key
    FROM core.encryption_keys
    WHERE is_active = true
    ORDER BY key_version DESC
    LIMIT 1;

    IF active_key IS NULL THEN
        RAISE EXCEPTION 'No active encryption key found';
    END IF;

    RETURN pgp_sym_encrypt(data, active_key);
END;
$$;


ALTER FUNCTION "core"."encrypt_data"("data" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO core.users (id, tenant_id, role)
  VALUES (
    NEW.id,
    NULL,
    'OPERATORE'
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "core"."handle_new_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."has_permission"("p_code" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM core.user_roles ur
        JOIN core.role_feature_permissions rfp ON ur.role_id = rfp.role_id
        JOIN core.feature_permissions fp ON fp.id = rfp.permission_id
        WHERE ur.user_id = auth.uid()
        AND fp.code = p_code
    );
$$;


ALTER FUNCTION "core"."has_permission"("p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."is_superadmin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM core.utenti_tenant
    WHERE user_id = auth.uid()
      AND ruolo = 'superadmin'
  );
$$;


ALTER FUNCTION "core"."is_superadmin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."require_tenant"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'core'
    AS $$
declare
    v_tenant uuid;
begin
    v_tenant := current_setting('app.tenant_id', true)::uuid;

    if v_tenant is null then
        raise exception 'Tenant not set in session';
    end if;

    if not exists (
        select 1
        from core.tenants t
        where t.id = v_tenant
        and t.is_active = true
    ) then
        raise exception 'Invalid tenant';
    end if;

    return v_tenant;
end;
$$;


ALTER FUNCTION "core"."require_tenant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."resolve_tenant_from_domain"("p_host" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
    v_tenant_id uuid;
begin
    select id
    into v_tenant_id
    from core.tenants
    where domain = lower(p_host)
    and is_active = true
    limit 1;

    if v_tenant_id is null then
        raise exception 'Tenant not found for domain %', p_host;
    end if;

    return v_tenant_id;
end;
$$;


ALTER FUNCTION "core"."resolve_tenant_from_domain"("p_host" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."set_app_context"("tenant" "uuid", "punto_vendita" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    PERFORM set_config('app.tenant_id', tenant::text, true);
    PERFORM set_config('app.punto_vendita_id', punto_vendita::text, true);
END;
$$;


ALTER FUNCTION "core"."set_app_context"("tenant" "uuid", "punto_vendita" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."set_current_tenant_from_host"("p_host" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
    v_tenant_id uuid;
begin
    v_tenant_id := core.resolve_tenant_from_domain(p_host);

    perform set_config('app.tenant_id', v_tenant_id::text, true);

    return v_tenant_id;
end;
$$;


ALTER FUNCTION "core"."set_current_tenant_from_host"("p_host" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_annulla"("p_ordine_id" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN

    IF get_ruolo_corrente() != 'admin' THEN
        RAISE EXCEPTION 'Non autorizzato';
    END IF;

    UPDATE ordini
    SET stato_override = 'annullato'
    WHERE id = p_ordine_id;

END;
$$;


ALTER FUNCTION "public"."admin_annulla"("p_ordine_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_annulla_ordine"("ordine_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  update ordini
  set stato_override = 'annullato'
  where id = ordine_id;
end;
$$;


ALTER FUNCTION "public"."admin_annulla_ordine"("ordine_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."annulla_ordine"("p_ordine_id" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF get_ruolo_corrente() NOT IN ('admin','cassa') THEN
        RAISE EXCEPTION 'Non autorizzato';
    END IF;

    UPDATE ordini
    SET stato_override = 'annullato'
    WHERE id = p_ordine_id;
END;
$$;


ALTER FUNCTION "public"."annulla_ordine"("p_ordine_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."attach_audit_to_all_tables"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  r record;
begin
  for r in
    select distinct table_name
    from information_schema.columns
    where table_schema = 'public'
    and column_name = 'azienda_id'
    and table_name <> 'audit_log'
  loop
    perform public.attach_audit_trigger_safe(r.table_name);
  end loop;
end;
$$;


ALTER FUNCTION "public"."attach_audit_to_all_tables"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."attach_audit_trigger_safe"("p_table" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $_$
declare
  v_exists boolean;
  v_has_azienda boolean;
  v_fn_exists boolean;
begin

  -- verifica funzione audit_trigger_fn
  select exists (
    select 1
    from pg_proc
    where proname = 'audit_trigger_fn'
  ) into v_fn_exists;

  if not v_fn_exists then
    raise exception 'Funzione audit_trigger_fn() non esiste';
  end if;

  -- verifica esistenza tabella
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
    and table_name = p_table
  ) into v_exists;

  if not v_exists then
    raise notice 'Tabella % non esiste. Skip.', p_table;
    return;
  end if;

  -- verifica colonna azienda_id
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
    and table_name = p_table
    and column_name = 'azienda_id'
  ) into v_has_azienda;

  if not v_has_azienda then
    raise notice 'Tabella % non ha azienda_id. Skip.', p_table;
    return;
  end if;

  execute format('
    drop trigger if exists trg_audit_%1$s on public.%1$s;
    create trigger trg_audit_%1$s
    after insert or update or delete
    on public.%1$s
    for each row
    execute function public.audit_trigger_fn();
  ', p_table);

  raise notice 'Trigger audit attivato su %', p_table;

end;
$_$;


ALTER FUNCTION "public"."attach_audit_trigger_safe"("p_table" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_all"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO admin.audit_global(
    table_name,
    operation,
    record_id,
    tenant_id,
    changed_by
  )
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    COALESCE(NEW.id::text, OLD.id::text),
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    auth.uid()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."audit_all"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid;
  v_azienda uuid;
begin

  -- Evita recursion se qualcuno mette audit su audit_log
  if tg_table_name = 'audit_log' then
    return null;
  end if;

  -- Recupera utente corrente
  v_user := auth.uid();

  -- Recupera azienda in modo sicuro
  if tg_op = 'DELETE' then
    v_azienda := old.azienda_id;
  else
    v_azienda := new.azienda_id;
  end if;

  -- Anti-noise: logga update solo se dati cambiano davvero
  if tg_op = 'UPDATE' then
    if to_jsonb(old) = to_jsonb(new) then
      return new;
    end if;
  end if;

  insert into public.audit_log (
    user_id,
    azienda_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  )
  values (
    v_user,
    v_azienda,
    tg_op,
    tg_table_name,
    coalesce(new.id, old.id),
    to_jsonb(old),
    to_jsonb(new)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."audit_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_trigger_fn"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid;
  v_azienda uuid;
  v_old jsonb;
  v_new jsonb;
  v_previous_checksum text;
  v_new_checksum text;
begin

  if TG_TABLE_NAME = 'audit_log' then
    return null;
  end if;

  v_user := auth.uid();

  if TG_OP = 'DELETE' then
    v_azienda := old.azienda_id;
    v_old := to_jsonb(old);
    v_new := null;
  else
    v_azienda := new.azienda_id;
    v_new := to_jsonb(new);
    if TG_OP = 'UPDATE' then
      v_old := to_jsonb(old);
    end if;
  end if;

  -- Skip update senza modifiche reali
  if TG_OP = 'UPDATE' and v_old = v_new then
    return new;
  end if;

  -- Recupero ultimo checksum
  select checksum
  into v_previous_checksum
  from public.audit_log
  where azienda_id = v_azienda
  order by created_at desc
  limit 1;

  -- Calcolo nuovo checksum concatenando il precedente
  v_new_checksum := encode(
    digest(
      coalesce(v_previous_checksum,'') ||
      coalesce(v_old::text,'') ||
      coalesce(v_new::text,'') ||
      TG_OP ||
      now()::text,
    'sha256'),
  'hex');

  insert into public.audit_log (
    azienda_id,
    user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    previous_checksum,
    checksum
  )
  values (
    v_azienda,
    v_user,
    TG_OP,
    TG_TABLE_NAME,
    coalesce(new.id, old.id),
    v_old,
    v_new,
    v_previous_checksum,
    v_new_checksum
  );

  if TG_OP = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."audit_trigger_fn"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_trigger_function"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tenant uuid;
begin

  -- recupera tenant dal record
  if (TG_OP = 'DELETE') then
    v_tenant := old.tenant_id;
  else
    v_tenant := new.tenant_id;
  end if;

  insert into public.audit_log (
    tenant_id,
    user_id,
    tabella,
    operazione,
    record_id,
    old_data,
    new_data
  )
  values (
    v_tenant,
    auth.uid(),
    TG_TABLE_NAME,
    TG_OP,
    coalesce(new.id, old.id),
    case when TG_OP <> 'INSERT' then to_jsonb(old) else null end,
    case when TG_OP <> 'DELETE' then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."audit_trigger_function"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_attach_audit"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  r record;
begin
  for r in
    select objid::regclass::text as table_name
    from pg_event_trigger_ddl_commands()
    where command_tag = 'CREATE TABLE'
  loop
    perform public.attach_audit_trigger_safe(split_part(r.table_name, '.', 2));
  end loop;
end;
$$;


ALTER FUNCTION "public"."auto_attach_audit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bancone_consegna"("p_ordine_id" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF get_ruolo_corrente() NOT IN ('bancone','admin') THEN
        RAISE EXCEPTION 'Non autorizzato';
    END IF;

    UPDATE ordini
    SET stato_override = 'consegnato'
    WHERE id = p_ordine_id
    AND tipo_consegna = 'asporto';
END;
$$;


ALTER FUNCTION "public"."bancone_consegna"("p_ordine_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bancone_consegna_ordine"("ordine_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  update ordini
  set stato_override = 'consegnato'
  where id = ordine_id
    and tipo_servizio = 'asporto';
end;
$$;


ALTER FUNCTION "public"."bancone_consegna_ordine"("ordine_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."blocca_update_stato_override"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RAISE EXCEPTION 'Modifica diretta stato non consentita. Usa funzione autorizzata.';
END;
$$;


ALTER FUNCTION "public"."blocca_update_stato_override"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calcola_totale_ordine"("p_ordine_id" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_iva NUMERIC(5,2);
    v_imponibile NUMERIC(10,2);
    v_iva_tot NUMERIC(10,2);
BEGIN

    -- recupero aliquota
    SELECT aliquota INTO v_iva
    FROM iva_config
    WHERE attiva = true
    LIMIT 1;

    -- aggiorno totale riga (imponibile)
    UPDATE righe_ordine
    SET totale_riga = ROUND(prezzo_unitario * quantita, 2)
    WHERE ordine_id = p_ordine_id;

    -- somma imponibile ordine
    SELECT COALESCE(SUM(totale_riga),0)
    INTO v_imponibile
    FROM righe_ordine
    WHERE ordine_id = p_ordine_id;

    -- calcolo IVA
    v_iva_tot := ROUND(v_imponibile * (v_iva / 100), 2);

    -- aggiorno ordine
    UPDATE ordini
    SET
        totale_imponibile = v_imponibile,
        totale_iva = v_iva_tot,
        totale = ROUND(v_imponibile + v_iva_tot, 2)
    WHERE id = p_ordine_id;

END;
$$;


ALTER FUNCTION "public"."calcola_totale_ordine"("p_ordine_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_punto_vendita"("pv_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select
    case
      when get_my_role() = 'superadmin' then true
      else pv_id = get_my_punto_vendita()
    end;
$$;


ALTER FUNCTION "public"."can_access_punto_vendita"("pv_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_pv"("pv_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select
    case
      when get_my_role() = 'superadmin' then true
      else pv_id = get_my_punto_vendita()
    end;
$$;


ALTER FUNCTION "public"."can_access_pv"("pv_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_write"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.get_my_role() in ('owner','admin','manager');
$$;


ALTER FUNCTION "public"."can_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."checkout_ordine"("p_ordine_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  riga record;
  ingrediente record;
  giacenza_attuale numeric;
begin

  -- Controllo esistenza ordine
  if not exists (
    select 1 from ordini where id = p_ordine_id
  ) then
    raise exception 'Ordine non trovato';
  end if;

  -- Loop righe ordine
  for riga in
    select * from ordine_righe
    where ordine_id = p_ordine_id
  loop

    -- Loop ingredienti ricetta
    for ingrediente in
      select 
        ri.ingrediente_id,
        ri.quantita * riga.quantita as quantita_totale
      from ricetta_ingredienti ri
      where ri.prodotto_id = riga.prodotto_id
    loop

      -- Controllo giacenza
      select giacenza
      into giacenza_attuale
      from ingredienti
      where id = ingrediente.ingrediente_id;

      if giacenza_attuale < ingrediente.quantita_totale then
        raise exception 'Magazzino insufficiente per ingrediente %',
          ingrediente.ingrediente_id;
      end if;

      -- Inserisco ordine_ingredienti
      insert into ordine_ingredienti (
        ordine_id,
        ingrediente_id,
        quantita
      )
      values (
        p_ordine_id,
        ingrediente.ingrediente_id,
        ingrediente.quantita_totale
      );

      -- Scalo magazzino
      update ingredienti
      set giacenza = giacenza - ingrediente.quantita_totale
      where id = ingrediente.ingrediente_id;

    end loop;

  end loop;

  -- Aggiorno stato ordine
  update ordini
  set stato = 'confermato'
  where id = p_ordine_id;

end;
$$;


ALTER FUNCTION "public"."checkout_ordine"("p_ordine_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_default_roles"("p_tenant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_admin uuid;
  v_manager uuid;
  v_pizzaiolo uuid;
begin

  -- ADMIN
  insert into public.ruoli (tenant_id, nome, descrizione, is_system, is_superadmin)
  values (p_tenant_id, 'Admin', 'Amministratore tenant', true, true)
  returning id into v_admin;

  -- MANAGER
  insert into public.ruoli (tenant_id, nome, descrizione, is_system)
  values (p_tenant_id, 'Manager', 'Responsabile punto vendita', true)
  returning id into v_manager;

  -- PIZZAIOLO
  insert into public.ruoli (tenant_id, nome, descrizione, is_system)
  values (p_tenant_id, 'Pizzaiolo', 'Operatore cucina', true)
  returning id into v_pizzaiolo;

  -- Admin → tutti i permessi
  insert into public.ruoli_permessi (ruolo_id, permesso_id)
  select v_admin, id from public.permessi;

  -- Manager → subset
  insert into public.ruoli_permessi (ruolo_id, permesso_id)
  select v_manager, id
  from public.permessi
  where codice in (
    'ordine.crea',
    'ordine.modifica',
    'prodotto.modifica',
    'dashboard.analytics'
  );

  -- Pizzaiolo → solo ordini
  insert into public.ruoli_permessi (ruolo_id, permesso_id)
  select v_pizzaiolo, id
  from public.permessi
  where codice in (
    'ordine.crea'
  );

end;
$$;


ALTER FUNCTION "public"."create_default_roles"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_tenant"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE
    AS $$
declare
  jwt_tenant uuid;
begin
  begin
    jwt_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  exception
    when others then
      jwt_tenant := null;
  end;

  return jwt_tenant;
end;
$$;


ALTER FUNCTION "public"."current_tenant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_tenant"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_current_tenant uuid;
BEGIN
    /*
      Recupero tenant dal contesto applicativo.
      Deve essere impostato tramite:
      SET app.current_tenant = 'uuid';
      oppure funzione current_tenant().
    */
    v_current_tenant := current_tenant();

    IF v_current_tenant IS NULL THEN
        RAISE EXCEPTION USING
            MESSAGE = 'Tenant non impostato nel contesto della sessione',
            ERRCODE = 'P0001',
            HINT = 'Impostare il tenant tramite SET app.current_tenant';
    END IF;

    -- ==========================
    -- INSERT
    -- ==========================
    IF TG_OP = 'INSERT' THEN

        -- Se qualcuno prova a forzare un tenant diverso → blocca
        IF NEW.tenant_id IS NOT NULL
           AND NEW.tenant_id IS DISTINCT FROM v_current_tenant THEN

            RAISE EXCEPTION USING
                MESSAGE = 'Tentativo di inserimento con tenant diverso',
                ERRCODE = '42501',
                DETAIL = 'Tenant corrente: ' || v_current_tenant::text,
                HINT = 'Il tenant viene assegnato automaticamente';
        END IF;

        -- Forza sempre il tenant corretto
        NEW.tenant_id := v_current_tenant;

        RETURN NEW;
    END IF;

    -- ==========================
    -- UPDATE
    -- ==========================
    IF TG_OP = 'UPDATE' THEN

        -- Blocco modifica tenant
        IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
            RAISE EXCEPTION USING
                MESSAGE = 'Modifica tenant_id non consentita',
                ERRCODE = '42501';
        END IF;

        -- Blocco cross-tenant
        IF OLD.tenant_id IS DISTINCT FROM v_current_tenant THEN
            RAISE EXCEPTION USING
                MESSAGE = 'Operazione su record di altro tenant non consentita',
                ERRCODE = '42501',
                DETAIL = 'Tenant record: ' || OLD.tenant_id::text ||
                         ' | Tenant corrente: ' || v_current_tenant::text;
        END IF;

        RETURN NEW;
    END IF;

    -- ==========================
    -- DELETE
    -- ==========================
    IF TG_OP = 'DELETE' THEN

        IF OLD.tenant_id IS DISTINCT FROM v_current_tenant THEN
            RAISE EXCEPTION USING
                MESSAGE = 'Eliminazione record di altro tenant non consentita',
                ERRCODE = '42501';
        END IF;

        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."enforce_tenant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."genera_delivery_token"("p_ordine_id" integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_token UUID;
BEGIN

    v_token := gen_random_uuid();

    UPDATE ordini
    SET
        delivery_token = v_token,
        delivery_token_scadenza = now() + interval '2 hours',
        delivery_token_usato = false
    WHERE id = p_ordine_id;

    RETURN v_token;

END;
$$;


ALTER FUNCTION "public"."genera_delivery_token"("p_ordine_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."genera_numero_ordine"("pv_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    nuovo_numero INTEGER;
BEGIN
    -- Se il contatore non esiste lo crea
    INSERT INTO contatori_ordini (punto_vendita_id, ultimo_numero)
    VALUES (pv_id, 1)
    ON CONFLICT (punto_vendita_id)
    DO UPDATE
    SET ultimo_numero = contatori_ordini.ultimo_numero + 1,
        updated_at = now()
    RETURNING ultimo_numero INTO nuovo_numero;

    RETURN nuovo_numero;
END;
$$;


ALTER FUNCTION "public"."genera_numero_ordine"("pv_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_tenant"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select tenant_id
  from public.profili
  where user_id = auth.uid()
$$;


ALTER FUNCTION "public"."get_current_tenant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_azienda_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select azienda_id
  from public.utenti_ruoli
  where user_id = auth.uid()
  limit 1;
$$;


ALTER FUNCTION "public"."get_my_azienda_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_punto_vendita"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select punto_vendita_id
  from utenti
  where id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_punto_vendita"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_role"() RETURNS "public"."ruolo_azienda"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select ruolo
  from public.utenti_ruoli
  where user_id = auth.uid()
  limit 1;
$$;


ALTER FUNCTION "public"."get_my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_ruolo_corrente"() RETURNS "public"."ruolo_sistema_enum"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_ruolo ruolo_sistema_enum;
BEGIN
    SELECT ruolo
    INTO v_ruolo
    FROM utenti_sistema
    WHERE uid = auth.uid()
    AND attivo = true;

    RETURN v_ruolo;
END;
$$;


ALTER FUNCTION "public"."get_ruolo_corrente"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."inserisci_ordine"("p_utente_id" "uuid", "p_ruolo" "text", "p_stato" "text", "p_totale" numeric, "p_carrello" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  nuovo_id UUID;
BEGIN
  -- Verifica che il cliente esista
  IF NOT EXISTS (
    SELECT 1 FROM clienti WHERE id = p_utente_id
  ) THEN
    RAISE EXCEPTION 'Cliente non trovato: %', p_utente_id;
  END IF;

  -- Verifica che il totale sia valido
  IF p_totale < 0 THEN
    RAISE EXCEPTION 'Totale ordine non valido: %', p_totale;
  END IF;

  -- Inserisce l’ordine
  INSERT INTO ordini (
    utente_id,
    ruolo_creazione,
    stato,
    totale,
    carrello,
    creato_il
  )
  VALUES (
    p_utente_id,
    p_ruolo,
    p_stato,
    p_totale,
    p_carrello,
    now()
  )
  RETURNING id INTO nuovo_id;

  RETURN nuovo_id;
END;
$$;


ALTER FUNCTION "public"."inserisci_ordine"("p_utente_id" "uuid", "p_ruolo" "text", "p_stato" "text", "p_totale" numeric, "p_carrello" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN get_ruolo_corrente() = 'admin';
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_superadmin"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND ruolo = 'superadmin'
  );
$$;


ALTER FUNCTION "public"."is_superadmin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."license_is_active"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE v boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM admin.licenze l
    WHERE l.tenant_id = current_tenant()
      AND l.stato = 'attiva'
      AND (
        l.data_scadenza IS NULL
        OR l.data_scadenza > now()
      )
  )
  INTO v;

  RETURN COALESCE(v, false);
END;
$$;


ALTER FUNCTION "public"."license_is_active"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_admin_action"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF is_admin() THEN
        INSERT INTO admin_log (
            admin_uid,
            azione,
            tabella,
            record_id
        )
        VALUES (
            auth.uid(),
            TG_OP,
            TG_TABLE_NAME,
            NEW.id
        );
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_admin_action"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pony_avvia_consegna"("p_ordine_id" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF get_ruolo_corrente() NOT IN ('pony','admin') THEN
        RAISE EXCEPTION 'Non autorizzato';
    END IF;

    UPDATE ordini
    SET stato_override = 'in_consegna'
    WHERE id = p_ordine_id;
END;
$$;


ALTER FUNCTION "public"."pony_avvia_consegna"("p_ordine_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pony_avvia_consegna"("ordine_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  update ordini
  set stato_override = 'in_consegna'
  where id = ordine_id;
end;
$$;


ALTER FUNCTION "public"."pony_avvia_consegna"("ordine_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pony_consegna_completata"("p_ordine_id" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF get_ruolo_corrente() NOT IN ('pony','admin') THEN
        RAISE EXCEPTION 'Non autorizzato';
    END IF;

    UPDATE ordini
    SET stato_override = 'consegnato'
    WHERE id = p_ordine_id;
END;
$$;


ALTER FUNCTION "public"."pony_consegna_completata"("p_ordine_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pony_consegna_completata"("ordine_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  update ordini
  set stato_override = 'consegnato'
  where id = ordine_id;
end;
$$;


ALTER FUNCTION "public"."pony_consegna_completata"("ordine_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pony_consegna_con_token"("p_token" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_ordine_id INTEGER;
BEGIN

    IF get_ruolo_corrente() NOT IN ('pony','admin') THEN
        RAISE EXCEPTION 'Non autorizzato';
    END IF;

    SELECT id
    INTO v_ordine_id
    FROM ordini
    WHERE delivery_token = p_token
    LIMIT 1;

    IF v_ordine_id IS NULL THEN
        RAISE EXCEPTION 'Ordine non trovato';
    END IF;

    UPDATE ordini
    SET stato_override = 'consegnato'
    WHERE id = v_ordine_id;

END;
$$;


ALTER FUNCTION "public"."pony_consegna_con_token"("p_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pony_scan_qr"("p_token" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_ordine_id INTEGER;
BEGIN

    IF get_ruolo_corrente() NOT IN ('pony','admin') THEN
        RAISE EXCEPTION 'Non autorizzato';
    END IF;

    SELECT id
    INTO v_ordine_id
    FROM ordini
    WHERE delivery_token = p_token
    AND delivery_token_usato = false
    AND delivery_token_scadenza > now()
    AND stato_override IS DISTINCT FROM 'annullato'
    LIMIT 1;

    IF v_ordine_id IS NULL THEN
        RAISE EXCEPTION 'Token non valido o scaduto';
    END IF;

    UPDATE ordini
    SET
        stato_override = 'in_consegna',
        delivery_token_usato = true
    WHERE id = v_ordine_id;

END;
$$;


ALTER FUNCTION "public"."pony_scan_qr"("p_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_azienda_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if new.azienda_id is null then
    new.azienda_id := public.get_my_azienda_id();
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_azienda_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_numero_ordine"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Se numero_ordine è già valorizzato non lo tocca
    IF NEW.numero_ordine IS NULL THEN
        NEW.numero_ordine := genera_numero_ordine(NEW.punto_vendita_id);
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_numero_ordine"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_tenant_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_tenant uuid;
BEGIN
  -- Recupera tenant dal profilo utente
  SELECT tenant_id INTO v_tenant
  FROM profiles
  WHERE id = auth.uid();

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Tenant non trovato per utente %', auth.uid();
  END IF;

  -- Imposta SEMPRE il tenant corretto (override totale)
  NEW.tenant_id := v_tenant;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_tenant_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_permission"("p_permesso" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
declare
  v_count int;
begin
  select count(*)
  into v_count
  from utenti_ruoli ur
  join ruoli_permessi rp on rp.ruolo_id = ur.ruolo_id
  join permessi p on p.id = rp.permesso_id
  where ur.user_id = auth.uid()
    and ur.tenant_id = get_current_tenant()
    and p.codice = p_permesso;

  return v_count > 0;
end;
$$;


ALTER FUNCTION "public"."user_has_permission"("p_permesso" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_permission"("p_permesso" "text", "p_punto_vendita_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_count int;
begin
  select count(*)
  into v_count
  from public.utenti_ruoli ur
  join public.ruoli_permessi rp on rp.ruolo_id = ur.ruolo_id
  join public.permessi p on p.id = rp.permesso_id
  where ur.user_id = auth.uid()
    and ur.tenant_id = public.get_current_tenant()
    and p.codice = p_permesso
    and (
      ur.punto_vendita_id is null
      or ur.punto_vendita_id = p_punto_vendita_id
    );

  return v_count > 0;
end;
$$;


ALTER FUNCTION "public"."user_has_permission"("p_permesso" "text", "p_punto_vendita_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_audit_chain"("p_azienda" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
declare
  r record;
  v_expected text;
  v_prev text;
begin
  for r in
    select *
    from public.audit_log
    where azienda_id = p_azienda
    order by created_at
  loop
    v_expected := encode(
      digest(
        coalesce(v_prev,'') ||
        coalesce(r.old_data::text,'') ||
        coalesce(r.new_data::text,'') ||
        r.action ||
        r.created_at::text,
      'sha256'),
    'hex');

    if r.checksum <> v_expected then
      return false;
    end if;

    v_prev := r.checksum;
  end loop;

  return true;
end;
$$;


ALTER FUNCTION "public"."verify_audit_chain"("p_azienda" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "admin"."audit_global" (
    "id" bigint NOT NULL,
    "table_name" "text",
    "operation" "text",
    "record_id" "text",
    "tenant_id" "uuid",
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "admin"."audit_global" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "admin"."audit_global_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "admin"."audit_global_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "admin"."audit_global_id_seq" OWNED BY "admin"."audit_global"."id";



CREATE TABLE IF NOT EXISTS "admin"."licenze" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "piano" "text" DEFAULT 'free'::"text" NOT NULL,
    "stato" "text" DEFAULT 'attiva'::"text" NOT NULL,
    "data_inizio" timestamp with time zone DEFAULT "now"(),
    "data_scadenza" timestamp with time zone,
    "rinnovo_automatico" boolean DEFAULT false,
    "stripe_subscription_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "admin"."licenze" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "admin"."licenze_pagamenti" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "licenza_id" "uuid",
    "importo" numeric NOT NULL,
    "metodo" "text",
    "stripe_payment_id" "text",
    "pagato" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "admin"."licenze_pagamenti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "admin"."piani_config" (
    "piano" "text" NOT NULL,
    "max_utenti" integer,
    "max_punti_vendita" integer,
    "max_prodotti" integer,
    "audit_attivo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "admin"."piani_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "admin"."tenants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "nome" "text" NOT NULL,
    "piano" "text" DEFAULT 'free'::"text",
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "attivo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "admin"."tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."Tenant" (
    "id" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "app"."Tenant" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."User" (
    "id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "password" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "app"."User" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."UserTenant" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "tenantId" "text" NOT NULL,
    "ruolo" "text" DEFAULT 'owner'::"text" NOT NULL
);


ALTER TABLE "app"."UserTenant" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "table_name" "text" NOT NULL,
    "operation" "text" NOT NULL,
    "record_id" "uuid",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);

ALTER TABLE ONLY "core"."audit_log" FORCE ROW LEVEL SECURITY;


ALTER TABLE "core"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "deleted_at" timestamp with time zone
);

ALTER TABLE ONLY "core"."categories" FORCE ROW LEVEL SECURITY;


ALTER TABLE "core"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."encryption_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key_version" integer NOT NULL,
    "key_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true
);


ALTER TABLE "core"."encryption_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "aggregate_type" "text" NOT NULL,
    "aggregate_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "core"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."feature_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL
);


ALTER TABLE "core"."feature_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "order_id" "uuid",
    "number" "text",
    "issued_at" timestamp with time zone DEFAULT "now"(),
    "total" numeric NOT NULL,
    "deleted_at" timestamp with time zone
);

ALTER TABLE ONLY "core"."invoices" FORCE ROW LEVEL SECURITY;


ALTER TABLE "core"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "qty" integer NOT NULL,
    "price" numeric NOT NULL
);


ALTER TABLE "core"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "point_of_sale_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "status" "text" NOT NULL,
    "total" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);

ALTER TABLE ONLY "core"."orders" FORCE ROW LEVEL SECURITY;


ALTER TABLE "core"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "amount" numeric NOT NULL,
    "method" "text" NOT NULL,
    "paid_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "point_of_sale_id" "uuid" NOT NULL,
    "deleted_at" timestamp with time zone
);

ALTER TABLE ONLY "core"."payments" FORCE ROW LEVEL SECURITY;


ALTER TABLE "core"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "description" "text"
);


ALTER TABLE "core"."permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."points_of_sale" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);

ALTER TABLE ONLY "core"."points_of_sale" FORCE ROW LEVEL SECURITY;


ALTER TABLE "core"."points_of_sale" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "name" "text" NOT NULL,
    "price" numeric NOT NULL,
    "cost" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);

ALTER TABLE ONLY "core"."products" FORCE ROW LEVEL SECURITY;


ALTER TABLE "core"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."punti_vendita" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "indirizzo" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);

ALTER TABLE ONLY "core"."punti_vendita" FORCE ROW LEVEL SECURITY;


ALTER TABLE "core"."punti_vendita" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."role_feature_permissions" (
    "role_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL
);


ALTER TABLE "core"."role_feature_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."role_permissions" (
    "role_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL
);


ALTER TABLE "core"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "is_system" boolean DEFAULT false,
    "is_superadmin" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);

ALTER TABLE ONLY "core"."roles" FORCE ROW LEVEL SECURITY;


ALTER TABLE "core"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "plan" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "active" boolean DEFAULT true,
    "deleted_at" timestamp with time zone
);

ALTER TABLE ONLY "core"."subscriptions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "core"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "domain" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true NOT NULL
);

ALTER TABLE ONLY "core"."tenants" FORCE ROW LEVEL SECURITY;


ALTER TABLE "core"."tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."turni" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "punto_vendita_id" "uuid" NOT NULL,
    "titolo" "text" NOT NULL,
    "data" "date" NOT NULL,
    "operatore_id" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "core"."turni" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."user_profiles" (
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "role" "text" DEFAULT 'admin'::"text",
    "deleted_at" timestamp with time zone
);

ALTER TABLE ONLY "core"."user_profiles" FORCE ROW LEVEL SECURITY;


ALTER TABLE "core"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "point_of_sale_id" "uuid",
    "role_id" "uuid" NOT NULL,
    "deleted_at" timestamp with time zone
);

ALTER TABLE ONLY "core"."user_roles" FORCE ROW LEVEL SECURITY;


ALTER TABLE "core"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."users" (
    "id" "uuid" NOT NULL,
    "tenant_id" "uuid",
    "email" "text" NOT NULL,
    "password_hash" "text" NOT NULL,
    "role" "text" DEFAULT 'admin'::"text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);

ALTER TABLE ONLY "core"."users" FORCE ROW LEVEL SECURITY;


ALTER TABLE "core"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."utenti_tenant" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "ruolo" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "utenti_tenant_ruolo_check" CHECK (("ruolo" = ANY (ARRAY['owner'::"text", 'manager'::"text", 'operatore'::"text"])))
);

ALTER TABLE ONLY "core"."utenti_tenant" FORCE ROW LEVEL SECURITY;


ALTER TABLE "core"."utenti_tenant" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "pizzamanager"."License" (
    "id" "text" NOT NULL,
    "status" "pizzamanager"."LicenseStatus" DEFAULT 'ACTIVE'::"pizzamanager"."LicenseStatus" NOT NULL,
    "startDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "endDate" timestamp(3) without time zone,
    "pizzeriaId" "text" NOT NULL
);


ALTER TABLE "pizzamanager"."License" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "pizzamanager"."Pizzeria" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "phone" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "pizzamanager"."Pizzeria" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "pizzamanager"."PlatformUser" (
    "id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "password" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "pizzamanager"."PlatformUser" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "pizzamanager"."User" (
    "id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "password" "text" NOT NULL,
    "role" "pizzamanager"."UserRole" DEFAULT 'STAFF'::"pizzamanager"."UserRole" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "pizzeriaId" "text" NOT NULL
);


ALTER TABLE "pizzamanager"."User" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Ingredient" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "basePrice" double precision NOT NULL,
    "isFinalAdd" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "pizzeriaId" "text" NOT NULL
);


ALTER TABLE "public"."Ingredient" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Order" (
    "id" "text" NOT NULL,
    "total" double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "pizzeriaId" "text" NOT NULL
);


ALTER TABLE "public"."Order" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."OrderItem" (
    "id" "text" NOT NULL,
    "price" double precision NOT NULL,
    "orderId" "text" NOT NULL,
    "pizzaId" "text" NOT NULL
);


ALTER TABLE "public"."OrderItem" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Pizza" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "basePrice" double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "pizzeriaId" "text" NOT NULL
);


ALTER TABLE "public"."Pizza" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PizzaIngredient" (
    "id" "text" NOT NULL,
    "pizzaId" "text" NOT NULL,
    "ingredientId" "text" NOT NULL
);


ALTER TABLE "public"."PizzaIngredient" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Pizzeria" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "phone" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."Pizzeria" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."User" (
    "id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "password" "text" NOT NULL,
    "role" "public"."UserRole" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "pizzeriaId" "text" NOT NULL
);


ALTER TABLE "public"."User" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "tabella" "text" NOT NULL,
    "operazione" "text" NOT NULL,
    "record_id" "uuid",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "azienda_id" "uuid",
    "action" "text",
    "table_name" "text",
    "checksum" "text",
    "previous_checksum" "text"
);

ALTER TABLE ONLY "public"."audit_log" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."aziende" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "owner_id" "uuid",
    "logo_url" "text",
    "favicon_url" "text",
    "colore_primario" "text" DEFAULT '#111111'::"text",
    "colore_secondario" "text" DEFAULT '#ffffff'::"text",
    "colore_accento" "text" DEFAULT '#e63946'::"text",
    "indirizzo" "text",
    "sede_legale" "text",
    "email_assistenza" "text",
    "telefono" "text",
    "telefoni" "jsonb" DEFAULT '[]'::"jsonb",
    "giorni_apertura" "jsonb" DEFAULT '{"dom": false, "gio": false, "lun": false, "mar": false, "mer": false, "sab": false, "ven": false}'::"jsonb"
);

ALTER TABLE ONLY "public"."aziende" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."aziende" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categorie_prodotti" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."categorie_prodotti" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."categorie_prodotti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clienti" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "nome" "text",
    "telefono" "text",
    "email" "text",
    "punti" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "indirizzo" "text",
    "note" "text"
);

ALTER TABLE ONLY "public"."clienti" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."clienti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ingredienti" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "costo_unitario" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "categoria" "text",
    "colore" "text",
    "in_cottura" boolean DEFAULT false
);

ALTER TABLE ONLY "public"."ingredienti" REPLICA IDENTITY FULL;

ALTER TABLE ONLY "public"."ingredienti" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."ingredienti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."movimenti_magazzino" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "ingrediente_id" "uuid",
    "tipo" "text",
    "quantita" numeric,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."movimenti_magazzino" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."movimenti_magazzino" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ordine_ingredienti" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ordine_id" "uuid",
    "ingrediente_id" "uuid",
    "stato" "text" DEFAULT 'da_preparare'::"text",
    "uscita_prevista" timestamp with time zone,
    "tenant_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."ordine_ingredienti" REPLICA IDENTITY FULL;

ALTER TABLE ONLY "public"."ordine_ingredienti" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."ordine_ingredienti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ordini" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "punto_vendita_id" "uuid",
    "totale" numeric DEFAULT 0,
    "stato" "text" DEFAULT 'aperto'::"text",
    "snapshot" "jsonb",
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tipo" "text",
    "cliente_nome" "text",
    "cliente_note" "text",
    "indirizzo" "text",
    "latitudine" numeric,
    "longitudine" numeric,
    "tempo_preparazione" integer DEFAULT 0,
    "tempo_consegna" integer DEFAULT 0,
    "uscita_prevista" timestamp with time zone,
    "azienda_id" "uuid"
);

ALTER TABLE ONLY "public"."ordini" REPLICA IDENTITY FULL;

ALTER TABLE ONLY "public"."ordini" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."ordini" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ordini_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ordine_id" "uuid",
    "prodotto_id" "uuid",
    "nome_prodotto" "text",
    "quantita" integer DEFAULT 1,
    "prezzo" numeric DEFAULT 0,
    "modifiche" "jsonb",
    "tenant_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."ordini_items" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."ordini_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pagamenti" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "ordine_id" "uuid",
    "metodo" "text",
    "importo" numeric,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."pagamenti" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."pagamenti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parametri" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "tempo_medio_preparazione" integer DEFAULT 10,
    "tempo_forno" integer DEFAULT 5,
    "tempo_consegna_default" integer DEFAULT 20,
    "soglia_ritardo" integer DEFAULT 5,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."parametri" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."parametri" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parametri_pv" (
    "id" integer NOT NULL,
    "punto_vendita_id" "uuid",
    "chiusura_automatica_turno" boolean DEFAULT false,
    "stampa_automatica" boolean DEFAULT true,
    "tempo_alert_cucina" integer DEFAULT 10,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."parametri_pv" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."parametri_pv_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."parametri_pv_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."parametri_pv_id_seq" OWNED BY "public"."parametri_pv"."id";



CREATE TABLE IF NOT EXISTS "public"."permessi" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codice" "text" NOT NULL,
    "descrizione" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."permessi" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pm_tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pm_tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prezzi_prodotti" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "prodotto_id" "uuid" NOT NULL,
    "prezzo" numeric NOT NULL,
    "valido_dal" timestamp with time zone DEFAULT "now"(),
    "valido_al" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."prezzi_prodotti" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."prezzi_prodotti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prodotti" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "descrizione" "text",
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."prodotti" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."prodotti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prodotto_ingredienti" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "prodotto_id" "uuid",
    "ingrediente_id" "uuid",
    "quantita" numeric DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."prodotto_ingredienti" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."prodotto_ingredienti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "email" "text",
    "ruolo" "text" DEFAULT 'operatore'::"text",
    "attivo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "punto_vendita_id" "uuid"
);

ALTER TABLE ONLY "public"."profiles" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profili" (
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."profili" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."profili" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."punti_vendita" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "azienda_id" "uuid",
    "nome" "text" NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."punti_vendita" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."punti_vendita" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."righe_ordine" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "ordine_id" "uuid",
    "prodotto_id" "uuid",
    "variante_id" "uuid",
    "quantita" integer DEFAULT 1,
    "prezzo_unitario" numeric NOT NULL
);

ALTER TABLE ONLY "public"."righe_ordine" REPLICA IDENTITY FULL;

ALTER TABLE ONLY "public"."righe_ordine" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."righe_ordine" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" integer NOT NULL,
    "name" character varying(50) NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."roles_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."roles_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."roles_id_seq" OWNED BY "public"."roles"."id";



CREATE TABLE IF NOT EXISTS "public"."ruoli" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "descrizione" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_system" boolean DEFAULT false,
    "is_superadmin" boolean DEFAULT false
);

ALTER TABLE ONLY "public"."ruoli" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."ruoli" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ruoli_permessi" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ruolo_id" "uuid" NOT NULL,
    "permesso_id" "uuid" NOT NULL
);

ALTER TABLE ONLY "public"."ruoli_permessi" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."ruoli_permessi" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."tenant" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."tenants" AS
 SELECT "id",
    "nome",
    "piano",
    "stripe_customer_id",
    "stripe_subscription_id",
    "attivo",
    "created_at"
   FROM "admin"."tenants";


ALTER VIEW "public"."tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."turni_operatori" (
    "id" integer NOT NULL,
    "user_id" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "punto_vendita_id" "uuid",
    "stato" "text" DEFAULT 'aperto'::"text",
    "aperto_il" timestamp with time zone DEFAULT "now"(),
    "chiuso_il" timestamp with time zone,
    "azienda_id" "uuid",
    CONSTRAINT "turni_operatori_stato_check" CHECK (("stato" = ANY (ARRAY['aperto'::"text", 'chiuso'::"text"])))
);

ALTER TABLE ONLY "public"."turni_operatori" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."turni_operatori" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."turni_operatori_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."turni_operatori_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."turni_operatori_id_seq" OWNED BY "public"."turni_operatori"."id";



CREATE TABLE IF NOT EXISTS "public"."user_operatives" (
    "id" integer NOT NULL,
    "user_id" "uuid",
    "operative_role" character varying(50) NOT NULL,
    "tenant_id" "uuid",
    "pv_id" "uuid"
);

ALTER TABLE ONLY "public"."user_operatives" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_operatives" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."user_operatives_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."user_operatives_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_operatives_id_seq" OWNED BY "public"."user_operatives"."id";



CREATE TABLE IF NOT EXISTS "public"."user_tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "tenant_id" "uuid",
    "ruolo" "text" DEFAULT 'owner'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."utenti" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "nome" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."utenti" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."utenti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."utenti_ruoli" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "punto_vendita_id" "uuid",
    "ruolo_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "azienda_id" "uuid",
    "ruolo" "public"."ruolo_azienda" DEFAULT 'operatore'::"public"."ruolo_azienda" NOT NULL
);

ALTER TABLE ONLY "public"."utenti_ruoli" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."utenti_ruoli" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."varianti" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "prodotto_id" "uuid",
    "nome" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."varianti" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."varianti" OWNER TO "postgres";


ALTER TABLE ONLY "admin"."audit_global" ALTER COLUMN "id" SET DEFAULT "nextval"('"admin"."audit_global_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."parametri_pv" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."parametri_pv_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."roles" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."roles_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."turni_operatori" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."turni_operatori_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_operatives" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."user_operatives_id_seq"'::"regclass");



ALTER TABLE ONLY "admin"."audit_global"
    ADD CONSTRAINT "audit_global_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "admin"."licenze_pagamenti"
    ADD CONSTRAINT "licenze_pagamenti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "admin"."licenze"
    ADD CONSTRAINT "licenze_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "admin"."licenze"
    ADD CONSTRAINT "licenze_tenant_id_key" UNIQUE ("tenant_id");



ALTER TABLE ONLY "admin"."piani_config"
    ADD CONSTRAINT "piani_config_pkey" PRIMARY KEY ("piano");



ALTER TABLE ONLY "admin"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."Tenant"
    ADD CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."UserTenant"
    ADD CONSTRAINT "UserTenant_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."encryption_keys"
    ADD CONSTRAINT "encryption_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."feature_permissions"
    ADD CONSTRAINT "feature_permissions_code_key" UNIQUE ("code");



ALTER TABLE ONLY "core"."feature_permissions"
    ADD CONSTRAINT "feature_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."invoices"
    ADD CONSTRAINT "invoices_number_key" UNIQUE ("number");



ALTER TABLE ONLY "core"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."permissions"
    ADD CONSTRAINT "permissions_code_key" UNIQUE ("code");



ALTER TABLE ONLY "core"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."points_of_sale"
    ADD CONSTRAINT "points_of_sale_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."punti_vendita"
    ADD CONSTRAINT "punti_vendita_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."role_feature_permissions"
    ADD CONSTRAINT "role_feature_permissions_pkey" PRIMARY KEY ("role_id", "permission_id");



ALTER TABLE ONLY "core"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id");



ALTER TABLE ONLY "core"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."tenants"
    ADD CONSTRAINT "tenants_domain_key" UNIQUE ("domain");



ALTER TABLE ONLY "core"."tenants"
    ADD CONSTRAINT "tenants_domain_unique" UNIQUE ("domain");



ALTER TABLE ONLY "core"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."turni"
    ADD CONSTRAINT "turni_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id", "tenant_id");



ALTER TABLE ONLY "core"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "core"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."utenti_tenant"
    ADD CONSTRAINT "utenti_tenant_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."utenti_tenant"
    ADD CONSTRAINT "utenti_tenant_user_id_tenant_id_key" UNIQUE ("user_id", "tenant_id");



ALTER TABLE ONLY "pizzamanager"."License"
    ADD CONSTRAINT "License_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "pizzamanager"."Pizzeria"
    ADD CONSTRAINT "Pizzeria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "pizzamanager"."PlatformUser"
    ADD CONSTRAINT "PlatformUser_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "pizzamanager"."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Ingredient"
    ADD CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."OrderItem"
    ADD CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PizzaIngredient"
    ADD CONSTRAINT "PizzaIngredient_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Pizza"
    ADD CONSTRAINT "Pizza_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Pizzeria"
    ADD CONSTRAINT "Pizzeria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."aziende"
    ADD CONSTRAINT "aziende_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categorie_prodotti"
    ADD CONSTRAINT "categorie_prodotti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clienti"
    ADD CONSTRAINT "clienti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ingredienti"
    ADD CONSTRAINT "ingredienti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."movimenti_magazzino"
    ADD CONSTRAINT "movimenti_magazzino_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ordine_ingredienti"
    ADD CONSTRAINT "ordine_ingredienti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ordini_items"
    ADD CONSTRAINT "ordini_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ordini"
    ADD CONSTRAINT "ordini_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pagamenti"
    ADD CONSTRAINT "pagamenti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parametri"
    ADD CONSTRAINT "parametri_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parametri_pv"
    ADD CONSTRAINT "parametri_pv_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permessi"
    ADD CONSTRAINT "permessi_codice_key" UNIQUE ("codice");



ALTER TABLE ONLY "public"."permessi"
    ADD CONSTRAINT "permessi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pm_tenants"
    ADD CONSTRAINT "pm_tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pm_tenants"
    ADD CONSTRAINT "pm_tenants_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."prezzi_prodotti"
    ADD CONSTRAINT "prezzi_prodotti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prodotti"
    ADD CONSTRAINT "prodotti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prodotto_ingredienti"
    ADD CONSTRAINT "prodotto_ingredienti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profili"
    ADD CONSTRAINT "profili_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."punti_vendita"
    ADD CONSTRAINT "punti_vendita_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."righe_ordine"
    ADD CONSTRAINT "righe_ordine_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ruoli_permessi"
    ADD CONSTRAINT "ruoli_permessi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ruoli_permessi"
    ADD CONSTRAINT "ruoli_permessi_ruolo_id_permesso_id_key" UNIQUE ("ruolo_id", "permesso_id");



ALTER TABLE ONLY "public"."ruoli"
    ADD CONSTRAINT "ruoli_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant"
    ADD CONSTRAINT "tenant_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."turni_operatori"
    ADD CONSTRAINT "turni_operatori_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_operatives"
    ADD CONSTRAINT "user_operatives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_tenants"
    ADD CONSTRAINT "user_tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_tenants"
    ADD CONSTRAINT "user_tenants_user_id_tenant_id_key" UNIQUE ("user_id", "tenant_id");



ALTER TABLE ONLY "public"."utenti"
    ADD CONSTRAINT "utenti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."utenti_ruoli"
    ADD CONSTRAINT "utenti_ruoli_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."varianti"
    ADD CONSTRAINT "varianti_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_licenze_pagamenti_tenant" ON "admin"."licenze_pagamenti" USING "btree" ("tenant_id");



CREATE INDEX "idx_licenze_tenant" ON "admin"."licenze" USING "btree" ("tenant_id");



CREATE UNIQUE INDEX "Tenant_slug_key" ON "app"."Tenant" USING "btree" ("slug");



CREATE UNIQUE INDEX "UserTenant_userId_tenantId_key" ON "app"."UserTenant" USING "btree" ("userId", "tenantId");



CREATE UNIQUE INDEX "User_email_key" ON "app"."User" USING "btree" ("email");



CREATE INDEX "idx_audit_log_deleted" ON "core"."audit_log" USING "btree" ("deleted_at");



CREATE INDEX "idx_audit_log_tenant" ON "core"."audit_log" USING "btree" ("tenant_id");



CREATE INDEX "idx_audit_tenant" ON "core"."audit_log" USING "btree" ("tenant_id");



CREATE INDEX "idx_categories_deleted" ON "core"."categories" USING "btree" ("deleted_at");



CREATE INDEX "idx_categories_tenant" ON "core"."categories" USING "btree" ("tenant_id");



CREATE INDEX "idx_events_aggregate" ON "core"."events" USING "btree" ("aggregate_id", "created_at" DESC);



CREATE INDEX "idx_events_tenant" ON "core"."events" USING "btree" ("tenant_id");



CREATE INDEX "idx_invoices_deleted" ON "core"."invoices" USING "btree" ("deleted_at");



CREATE INDEX "idx_invoices_tenant" ON "core"."invoices" USING "btree" ("tenant_id");



CREATE INDEX "idx_orders_deleted" ON "core"."orders" USING "btree" ("deleted_at");



CREATE INDEX "idx_orders_tenant" ON "core"."orders" USING "btree" ("tenant_id");



CREATE INDEX "idx_payments_deleted" ON "core"."payments" USING "btree" ("deleted_at");



CREATE INDEX "idx_payments_tenant" ON "core"."payments" USING "btree" ("tenant_id");



CREATE INDEX "idx_points_of_sale_deleted" ON "core"."points_of_sale" USING "btree" ("deleted_at");



CREATE INDEX "idx_points_of_sale_tenant" ON "core"."points_of_sale" USING "btree" ("tenant_id");



CREATE INDEX "idx_pos_tenant" ON "core"."points_of_sale" USING "btree" ("tenant_id");



CREATE INDEX "idx_products_deleted" ON "core"."products" USING "btree" ("deleted_at");



CREATE INDEX "idx_products_tenant" ON "core"."products" USING "btree" ("tenant_id");



CREATE INDEX "idx_punti_vendita_deleted" ON "core"."punti_vendita" USING "btree" ("deleted_at");



CREATE INDEX "idx_punti_vendita_tenant" ON "core"."punti_vendita" USING "btree" ("tenant_id");



CREATE INDEX "idx_roles_deleted" ON "core"."roles" USING "btree" ("deleted_at");



CREATE INDEX "idx_roles_tenant" ON "core"."roles" USING "btree" ("tenant_id");



CREATE INDEX "idx_subscriptions_deleted" ON "core"."subscriptions" USING "btree" ("deleted_at");



CREATE INDEX "idx_subscriptions_tenant" ON "core"."subscriptions" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenants_domain" ON "core"."tenants" USING "btree" ("domain");



CREATE INDEX "idx_user_profiles_deleted" ON "core"."user_profiles" USING "btree" ("deleted_at");



CREATE INDEX "idx_user_profiles_tenant" ON "core"."user_profiles" USING "btree" ("tenant_id");



CREATE INDEX "idx_user_profiles_user" ON "core"."user_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_user_roles_deleted" ON "core"."user_roles" USING "btree" ("deleted_at");



CREATE INDEX "idx_user_roles_tenant" ON "core"."user_roles" USING "btree" ("tenant_id");



CREATE INDEX "idx_users_deleted" ON "core"."users" USING "btree" ("deleted_at");



CREATE INDEX "idx_users_tenant" ON "core"."users" USING "btree" ("tenant_id");



CREATE INDEX "idx_utenti_tenant_deleted" ON "core"."utenti_tenant" USING "btree" ("deleted_at");



CREATE INDEX "idx_utenti_tenant_tenant" ON "core"."utenti_tenant" USING "btree" ("tenant_id");



CREATE INDEX "idx_utenti_tenant_user" ON "core"."utenti_tenant" USING "btree" ("user_id");



CREATE UNIQUE INDEX "License_pizzeriaId_key" ON "pizzamanager"."License" USING "btree" ("pizzeriaId");



CREATE UNIQUE INDEX "PlatformUser_email_key" ON "pizzamanager"."PlatformUser" USING "btree" ("email");



CREATE UNIQUE INDEX "User_email_pizzeriaId_key" ON "pizzamanager"."User" USING "btree" ("email", "pizzeriaId");



CREATE UNIQUE INDEX "User_email_key" ON "public"."User" USING "btree" ("email");



CREATE INDEX "idx_audit_action" ON "public"."audit_log" USING "btree" ("action");



CREATE INDEX "idx_audit_azienda_created" ON "public"."audit_log" USING "btree" ("azienda_id", "created_at" DESC);



CREATE INDEX "idx_audit_new_data_gin" ON "public"."audit_log" USING "gin" ("new_data");



CREATE INDEX "idx_audit_old_data_gin" ON "public"."audit_log" USING "gin" ("old_data");



CREATE INDEX "idx_audit_record" ON "public"."audit_log" USING "btree" ("record_id");



CREATE INDEX "idx_audit_table" ON "public"."audit_log" USING "btree" ("table_name");



CREATE INDEX "idx_audit_user" ON "public"."audit_log" USING "btree" ("user_id");



CREATE INDEX "idx_aziende_owner" ON "public"."aziende" USING "btree" ("owner_id");



CREATE INDEX "idx_aziende_tenant" ON "public"."aziende" USING "btree" ("tenant_id");



CREATE INDEX "idx_aziende_tenant_id" ON "public"."aziende" USING "btree" ("tenant_id");



CREATE INDEX "idx_ingredienti_tenant" ON "public"."ingredienti" USING "btree" ("tenant_id");



CREATE INDEX "idx_ordine_ing_stato" ON "public"."ordine_ingredienti" USING "btree" ("stato");



CREATE INDEX "idx_ordini_azienda" ON "public"."ordini" USING "btree" ("azienda_id");



CREATE INDEX "idx_ordini_items_ordine" ON "public"."ordini_items" USING "btree" ("ordine_id");



CREATE INDEX "idx_ordini_stato" ON "public"."ordini" USING "btree" ("stato");



CREATE INDEX "idx_ordini_tenant" ON "public"."ordini" USING "btree" ("tenant_id");



CREATE INDEX "idx_ordini_uscita" ON "public"."ordini" USING "btree" ("uscita_prevista");



CREATE INDEX "idx_prezzi_prodotti_tenant" ON "public"."prezzi_prodotti" USING "btree" ("tenant_id");



CREATE INDEX "idx_prodotti_tenant" ON "public"."prodotti" USING "btree" ("tenant_id");



CREATE INDEX "idx_profiles_pv" ON "public"."profiles" USING "btree" ("punto_vendita_id");



CREATE INDEX "idx_profiles_tenant" ON "public"."profiles" USING "btree" ("tenant_id");



CREATE INDEX "idx_punti_vendita_azienda" ON "public"."punti_vendita" USING "btree" ("azienda_id");



CREATE INDEX "idx_punti_vendita_tenant" ON "public"."punti_vendita" USING "btree" ("tenant_id");



CREATE INDEX "idx_turni_operatori_azienda" ON "public"."turni_operatori" USING "btree" ("azienda_id");



CREATE INDEX "idx_turni_operatori_tenant_id" ON "public"."turni_operatori" USING "btree" ("tenant_id");



CREATE INDEX "idx_turni_user" ON "public"."turni_operatori" USING "btree" ("user_id");



CREATE INDEX "idx_user_operatives_user" ON "public"."user_operatives" USING "btree" ("user_id");



CREATE INDEX "idx_user_operatives_user_id" ON "public"."user_operatives" USING "btree" ("user_id");



CREATE INDEX "idx_utenti_ruoli_azienda" ON "public"."utenti_ruoli" USING "btree" ("azienda_id");



CREATE INDEX "idx_utenti_ruoli_user" ON "public"."utenti_ruoli" USING "btree" ("user_id");



CREATE UNIQUE INDEX "unico_turno_aperto_per_operatore" ON "public"."turni_operatori" USING "btree" ("user_id", "tenant_id") WHERE (("stato" = 'aperto'::"text") AND ("chiuso_il" IS NULL));



CREATE OR REPLACE TRIGGER "audit_hash_trigger" BEFORE INSERT ON "core"."audit_log" FOR EACH ROW EXECUTE FUNCTION "core"."compute_audit_hash"();



CREATE OR REPLACE TRIGGER "audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "core"."categories" FOR EACH ROW EXECUTE FUNCTION "core"."audit_trigger"();



CREATE OR REPLACE TRIGGER "audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "core"."feature_permissions" FOR EACH ROW EXECUTE FUNCTION "core"."audit_trigger"();



CREATE OR REPLACE TRIGGER "audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "core"."invoices" FOR EACH ROW EXECUTE FUNCTION "core"."audit_trigger"();



CREATE OR REPLACE TRIGGER "audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "core"."order_items" FOR EACH ROW EXECUTE FUNCTION "core"."audit_trigger"();



CREATE OR REPLACE TRIGGER "audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "core"."orders" FOR EACH ROW EXECUTE FUNCTION "core"."audit_trigger"();



CREATE OR REPLACE TRIGGER "audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "core"."payments" FOR EACH ROW EXECUTE FUNCTION "core"."audit_trigger"();



CREATE OR REPLACE TRIGGER "audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "core"."permissions" FOR EACH ROW EXECUTE FUNCTION "core"."audit_trigger"();



CREATE OR REPLACE TRIGGER "audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "core"."points_of_sale" FOR EACH ROW EXECUTE FUNCTION "core"."audit_trigger"();



CREATE OR REPLACE TRIGGER "audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "core"."products" FOR EACH ROW EXECUTE FUNCTION "core"."audit_trigger"();



CREATE OR REPLACE TRIGGER "audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "core"."punti_vendita" FOR EACH ROW EXECUTE FUNCTION "core"."audit_trigger"();



CREATE OR REPLACE TRIGGER "audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "core"."role_feature_permissions" FOR EACH ROW EXECUTE FUNCTION "core"."audit_trigger"();



CREATE OR REPLACE TRIGGER "audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "core"."role_permissions" FOR EACH ROW EXECUTE FUNCTION "core"."audit_trigger"();



CREATE OR REPLACE TRIGGER "audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "core"."roles" FOR EACH ROW EXECUTE FUNCTION "core"."audit_trigger"();



CREATE OR REPLACE TRIGGER "audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "core"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "core"."audit_trigger"();



CREATE OR REPLACE TRIGGER "audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "core"."tenants" FOR EACH ROW EXECUTE FUNCTION "core"."audit_trigger"();



CREATE OR REPLACE TRIGGER "audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "core"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "core"."audit_trigger"();



CREATE OR REPLACE TRIGGER "audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "core"."user_roles" FOR EACH ROW EXECUTE FUNCTION "core"."audit_trigger"();



CREATE OR REPLACE TRIGGER "audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "core"."users" FOR EACH ROW EXECUTE FUNCTION "core"."audit_trigger"();



CREATE OR REPLACE TRIGGER "audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "core"."utenti_tenant" FOR EACH ROW EXECUTE FUNCTION "core"."audit_trigger"();



CREATE OR REPLACE TRIGGER "audit_ordini" AFTER INSERT OR DELETE OR UPDATE ON "public"."ordini" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger"();



CREATE OR REPLACE TRIGGER "audit_punti_vendita" AFTER INSERT OR DELETE OR UPDATE ON "public"."punti_vendita" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger"();



CREATE OR REPLACE TRIGGER "audit_turni_operatori" AFTER INSERT OR DELETE OR UPDATE ON "public"."turni_operatori" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger"();



CREATE OR REPLACE TRIGGER "audit_utenti_ruoli" AFTER INSERT OR DELETE OR UPDATE ON "public"."utenti_ruoli" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger"();



CREATE OR REPLACE TRIGGER "ordini_audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."ordini" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_function"();



CREATE OR REPLACE TRIGGER "set_azienda_ordini" BEFORE INSERT ON "public"."ordini" FOR EACH ROW EXECUTE FUNCTION "public"."set_azienda_id"();



CREATE OR REPLACE TRIGGER "set_azienda_pv" BEFORE INSERT ON "public"."punti_vendita" FOR EACH ROW EXECUTE FUNCTION "public"."set_azienda_id"();



CREATE OR REPLACE TRIGGER "set_azienda_turni_operatori" BEFORE INSERT ON "public"."turni_operatori" FOR EACH ROW EXECUTE FUNCTION "public"."set_azienda_id"();



CREATE OR REPLACE TRIGGER "set_azienda_utenti_ruoli" BEFORE INSERT ON "public"."utenti_ruoli" FOR EACH ROW EXECUTE FUNCTION "public"."set_azienda_id"();



CREATE OR REPLACE TRIGGER "trg_audit_aziende" AFTER INSERT OR DELETE OR UPDATE ON "public"."aziende" FOR EACH ROW EXECUTE FUNCTION "public"."audit_all"();



CREATE OR REPLACE TRIGGER "trg_audit_categorie_prodotti" AFTER INSERT OR DELETE OR UPDATE ON "public"."categorie_prodotti" FOR EACH ROW EXECUTE FUNCTION "public"."audit_all"();



CREATE OR REPLACE TRIGGER "trg_audit_clienti" AFTER INSERT OR DELETE OR UPDATE ON "public"."clienti" FOR EACH ROW EXECUTE FUNCTION "public"."audit_all"();



CREATE OR REPLACE TRIGGER "trg_audit_ingredienti" AFTER INSERT OR DELETE OR UPDATE ON "public"."ingredienti" FOR EACH ROW EXECUTE FUNCTION "public"."audit_all"();



CREATE OR REPLACE TRIGGER "trg_audit_movimenti_magazzino" AFTER INSERT OR DELETE OR UPDATE ON "public"."movimenti_magazzino" FOR EACH ROW EXECUTE FUNCTION "public"."audit_all"();



CREATE OR REPLACE TRIGGER "trg_audit_ordini" AFTER INSERT OR DELETE OR UPDATE ON "public"."ordini" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_fn"();



CREATE OR REPLACE TRIGGER "trg_audit_pagamenti" AFTER INSERT OR DELETE OR UPDATE ON "public"."pagamenti" FOR EACH ROW EXECUTE FUNCTION "public"."audit_all"();



CREATE OR REPLACE TRIGGER "trg_audit_prezzi_prodotti" AFTER INSERT OR DELETE OR UPDATE ON "public"."prezzi_prodotti" FOR EACH ROW EXECUTE FUNCTION "public"."audit_all"();



CREATE OR REPLACE TRIGGER "trg_audit_prodotti" AFTER INSERT OR DELETE OR UPDATE ON "public"."prodotti" FOR EACH ROW EXECUTE FUNCTION "public"."audit_all"();



CREATE OR REPLACE TRIGGER "trg_audit_prodotto_ingredienti" AFTER INSERT OR DELETE OR UPDATE ON "public"."prodotto_ingredienti" FOR EACH ROW EXECUTE FUNCTION "public"."audit_all"();



CREATE OR REPLACE TRIGGER "trg_audit_profiles" AFTER INSERT OR DELETE OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."audit_all"();



CREATE OR REPLACE TRIGGER "trg_audit_punti_vendita" AFTER INSERT OR DELETE OR UPDATE ON "public"."punti_vendita" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_fn"();



CREATE OR REPLACE TRIGGER "trg_audit_righe_ordine" AFTER INSERT OR DELETE OR UPDATE ON "public"."righe_ordine" FOR EACH ROW EXECUTE FUNCTION "public"."audit_all"();



CREATE OR REPLACE TRIGGER "trg_audit_turni_operatori" AFTER INSERT OR DELETE OR UPDATE ON "public"."turni_operatori" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_fn"();



CREATE OR REPLACE TRIGGER "trg_audit_utenti_ruoli" AFTER INSERT OR DELETE OR UPDATE ON "public"."utenti_ruoli" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_fn"();



CREATE OR REPLACE TRIGGER "trg_audit_varianti" AFTER INSERT OR DELETE OR UPDATE ON "public"."varianti" FOR EACH ROW EXECUTE FUNCTION "public"."audit_all"();



CREATE OR REPLACE TRIGGER "trg_enforce_aziende" BEFORE INSERT OR DELETE OR UPDATE ON "public"."aziende" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_tenant"();



CREATE OR REPLACE TRIGGER "trg_enforce_categorie_prodotti" BEFORE INSERT OR UPDATE ON "public"."categorie_prodotti" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_tenant"();



CREATE OR REPLACE TRIGGER "trg_enforce_clienti" BEFORE INSERT OR UPDATE ON "public"."clienti" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_tenant"();



CREATE OR REPLACE TRIGGER "trg_enforce_ingredienti" BEFORE INSERT OR UPDATE ON "public"."ingredienti" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_tenant"();



CREATE OR REPLACE TRIGGER "trg_enforce_movimenti_magazzino" BEFORE INSERT OR UPDATE ON "public"."movimenti_magazzino" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_tenant"();



CREATE OR REPLACE TRIGGER "trg_enforce_ordini" BEFORE INSERT OR UPDATE ON "public"."ordini" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_tenant"();



CREATE OR REPLACE TRIGGER "trg_enforce_pagamenti" BEFORE INSERT OR UPDATE ON "public"."pagamenti" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_tenant"();



CREATE OR REPLACE TRIGGER "trg_enforce_prezzi_prodotti" BEFORE INSERT OR UPDATE ON "public"."prezzi_prodotti" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_tenant"();



CREATE OR REPLACE TRIGGER "trg_enforce_prodotti" BEFORE INSERT OR UPDATE ON "public"."prodotti" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_tenant"();



CREATE OR REPLACE TRIGGER "trg_enforce_prodotto_ingredienti" BEFORE INSERT OR UPDATE ON "public"."prodotto_ingredienti" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_tenant"();



CREATE OR REPLACE TRIGGER "trg_enforce_profiles" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_tenant"();



CREATE OR REPLACE TRIGGER "trg_enforce_punti_vendita" BEFORE INSERT OR UPDATE ON "public"."punti_vendita" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_tenant"();



CREATE OR REPLACE TRIGGER "trg_enforce_righe_ordine" BEFORE INSERT OR UPDATE ON "public"."righe_ordine" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_tenant"();



CREATE OR REPLACE TRIGGER "trg_enforce_varianti" BEFORE INSERT OR UPDATE ON "public"."varianti" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_tenant"();



ALTER TABLE ONLY "admin"."licenze_pagamenti"
    ADD CONSTRAINT "licenze_pagamenti_licenza_id_fkey" FOREIGN KEY ("licenza_id") REFERENCES "admin"."licenze"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "admin"."licenze_pagamenti"
    ADD CONSTRAINT "licenze_pagamenti_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "admin"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "admin"."licenze"
    ADD CONSTRAINT "licenze_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "admin"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "app"."UserTenant"
    ADD CONSTRAINT "UserTenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "app"."Tenant"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "app"."UserTenant"
    ADD CONSTRAINT "UserTenant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app"."User"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "core"."audit_log"
    ADD CONSTRAINT "audit_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."categories"
    ADD CONSTRAINT "categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."invoices"
    ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "core"."orders"("id");



ALTER TABLE ONLY "core"."invoices"
    ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "core"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "core"."products"("id");



ALTER TABLE ONLY "core"."orders"
    ADD CONSTRAINT "orders_point_of_sale_id_fkey" FOREIGN KEY ("point_of_sale_id") REFERENCES "core"."points_of_sale"("id");



ALTER TABLE ONLY "core"."orders"
    ADD CONSTRAINT "orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."orders"
    ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "core"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "core"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."points_of_sale"
    ADD CONSTRAINT "points_of_sale_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."products"
    ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "core"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "core"."products"
    ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."punti_vendita"
    ADD CONSTRAINT "punti_vendita_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."role_feature_permissions"
    ADD CONSTRAINT "role_feature_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "core"."feature_permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."role_feature_permissions"
    ADD CONSTRAINT "role_feature_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "core"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "core"."permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "core"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."roles"
    ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."subscriptions"
    ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."turni"
    ADD CONSTRAINT "turni_punto_vendita_id_fkey" FOREIGN KEY ("punto_vendita_id") REFERENCES "core"."punti_vendita"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."turni"
    ADD CONSTRAINT "turni_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."user_profiles"
    ADD CONSTRAINT "user_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "core"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."user_roles"
    ADD CONSTRAINT "user_roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."users"
    ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."utenti_tenant"
    ADD CONSTRAINT "utenti_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."utenti_tenant"
    ADD CONSTRAINT "utenti_tenant_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "pizzamanager"."License"
    ADD CONSTRAINT "License_pizzeriaId_fkey" FOREIGN KEY ("pizzeriaId") REFERENCES "pizzamanager"."Pizzeria"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "pizzamanager"."User"
    ADD CONSTRAINT "User_pizzeriaId_fkey" FOREIGN KEY ("pizzeriaId") REFERENCES "pizzamanager"."Pizzeria"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Ingredient"
    ADD CONSTRAINT "Ingredient_pizzeriaId_fkey" FOREIGN KEY ("pizzeriaId") REFERENCES "public"."Pizzeria"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."OrderItem"
    ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."OrderItem"
    ADD CONSTRAINT "OrderItem_pizzaId_fkey" FOREIGN KEY ("pizzaId") REFERENCES "public"."Pizza"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Order"
    ADD CONSTRAINT "Order_pizzeriaId_fkey" FOREIGN KEY ("pizzeriaId") REFERENCES "public"."Pizzeria"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."PizzaIngredient"
    ADD CONSTRAINT "PizzaIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "public"."Ingredient"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."PizzaIngredient"
    ADD CONSTRAINT "PizzaIngredient_pizzaId_fkey" FOREIGN KEY ("pizzaId") REFERENCES "public"."Pizza"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Pizza"
    ADD CONSTRAINT "Pizza_pizzeriaId_fkey" FOREIGN KEY ("pizzeriaId") REFERENCES "public"."Pizzeria"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."User"
    ADD CONSTRAINT "User_pizzeriaId_fkey" FOREIGN KEY ("pizzeriaId") REFERENCES "public"."Pizzeria"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."aziende"
    ADD CONSTRAINT "aziende_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."aziende"
    ADD CONSTRAINT "aziende_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "admin"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categorie_prodotti"
    ADD CONSTRAINT "categorie_prodotti_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "admin"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clienti"
    ADD CONSTRAINT "clienti_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "admin"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordine_ingredienti"
    ADD CONSTRAINT "fk_ordine_ing_ingrediente" FOREIGN KEY ("ingrediente_id") REFERENCES "public"."ingredienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordine_ingredienti"
    ADD CONSTRAINT "fk_ordine_ing_ordine" FOREIGN KEY ("ordine_id") REFERENCES "public"."ordini"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordini_items"
    ADD CONSTRAINT "fk_ordini_items_ordine" FOREIGN KEY ("ordine_id") REFERENCES "public"."ordini"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prodotto_ingredienti"
    ADD CONSTRAINT "fk_prod_ing_ingrediente" FOREIGN KEY ("ingrediente_id") REFERENCES "public"."ingredienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ingredienti"
    ADD CONSTRAINT "ingredienti_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "admin"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."movimenti_magazzino"
    ADD CONSTRAINT "movimenti_magazzino_ingrediente_id_fkey" FOREIGN KEY ("ingrediente_id") REFERENCES "public"."ingredienti"("id");



ALTER TABLE ONLY "public"."movimenti_magazzino"
    ADD CONSTRAINT "movimenti_magazzino_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "admin"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordini"
    ADD CONSTRAINT "ordini_azienda_fkey" FOREIGN KEY ("azienda_id") REFERENCES "public"."aziende"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordini"
    ADD CONSTRAINT "ordini_punto_vendita_id_fkey" FOREIGN KEY ("punto_vendita_id") REFERENCES "public"."punti_vendita"("id");



ALTER TABLE ONLY "public"."ordini"
    ADD CONSTRAINT "ordini_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "admin"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pagamenti"
    ADD CONSTRAINT "pagamenti_ordine_id_fkey" FOREIGN KEY ("ordine_id") REFERENCES "public"."ordini"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pagamenti"
    ADD CONSTRAINT "pagamenti_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "admin"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parametri_pv"
    ADD CONSTRAINT "parametri_pv_punto_vendita_id_fkey" FOREIGN KEY ("punto_vendita_id") REFERENCES "public"."punti_vendita"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prezzi_prodotti"
    ADD CONSTRAINT "prezzi_prodotti_prodotto_id_fkey" FOREIGN KEY ("prodotto_id") REFERENCES "public"."prodotti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prezzi_prodotti"
    ADD CONSTRAINT "prezzi_prodotti_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "admin"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prodotti"
    ADD CONSTRAINT "prodotti_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "admin"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prodotto_ingredienti"
    ADD CONSTRAINT "prodotto_ingredienti_ingrediente_id_fkey" FOREIGN KEY ("ingrediente_id") REFERENCES "public"."ingredienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prodotto_ingredienti"
    ADD CONSTRAINT "prodotto_ingredienti_prodotto_id_fkey" FOREIGN KEY ("prodotto_id") REFERENCES "public"."prodotti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prodotto_ingredienti"
    ADD CONSTRAINT "prodotto_ingredienti_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "admin"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_punto_vendita_id_fkey" FOREIGN KEY ("punto_vendita_id") REFERENCES "public"."punti_vendita"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "admin"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profili"
    ADD CONSTRAINT "profili_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."punti_vendita"
    ADD CONSTRAINT "punti_vendita_azienda_fkey" FOREIGN KEY ("azienda_id") REFERENCES "public"."aziende"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."punti_vendita"
    ADD CONSTRAINT "punti_vendita_azienda_id_fkey" FOREIGN KEY ("azienda_id") REFERENCES "public"."aziende"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."punti_vendita"
    ADD CONSTRAINT "punti_vendita_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "admin"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."righe_ordine"
    ADD CONSTRAINT "righe_ordine_ordine_id_fkey" FOREIGN KEY ("ordine_id") REFERENCES "public"."ordini"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."righe_ordine"
    ADD CONSTRAINT "righe_ordine_prodotto_id_fkey" FOREIGN KEY ("prodotto_id") REFERENCES "public"."prodotti"("id");



ALTER TABLE ONLY "public"."righe_ordine"
    ADD CONSTRAINT "righe_ordine_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "admin"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."righe_ordine"
    ADD CONSTRAINT "righe_ordine_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "public"."varianti"("id");



ALTER TABLE ONLY "public"."ruoli_permessi"
    ADD CONSTRAINT "ruoli_permessi_permesso_id_fkey" FOREIGN KEY ("permesso_id") REFERENCES "public"."permessi"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ruoli_permessi"
    ADD CONSTRAINT "ruoli_permessi_ruolo_id_fkey" FOREIGN KEY ("ruolo_id") REFERENCES "public"."ruoli"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."turni_operatori"
    ADD CONSTRAINT "turni_operatori_azienda_fkey" FOREIGN KEY ("azienda_id") REFERENCES "public"."aziende"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."turni_operatori"
    ADD CONSTRAINT "turni_operatori_punto_vendita_id_fkey" FOREIGN KEY ("punto_vendita_id") REFERENCES "public"."punti_vendita"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."turni_operatori"
    ADD CONSTRAINT "turni_operatori_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."turni_operatori"
    ADD CONSTRAINT "turni_operatori_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_operatives"
    ADD CONSTRAINT "user_operatives_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_tenants"
    ADD CONSTRAINT "user_tenants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."pm_tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_tenants"
    ADD CONSTRAINT "user_tenants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."utenti_ruoli"
    ADD CONSTRAINT "utenti_ruoli_azienda_fkey" FOREIGN KEY ("azienda_id") REFERENCES "public"."aziende"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."utenti_ruoli"
    ADD CONSTRAINT "utenti_ruoli_ruolo_id_fkey" FOREIGN KEY ("ruolo_id") REFERENCES "public"."ruoli"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."utenti_ruoli"
    ADD CONSTRAINT "utenti_ruoli_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."utenti"
    ADD CONSTRAINT "utenti_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."varianti"
    ADD CONSTRAINT "varianti_prodotto_id_fkey" FOREIGN KEY ("prodotto_id") REFERENCES "public"."prodotti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."varianti"
    ADD CONSTRAINT "varianti_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "admin"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE "admin"."licenze" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "admin"."licenze_pagamenti" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "licenze_pagamenti_tenant_policy" ON "admin"."licenze_pagamenti" USING (("tenant_id" = "public"."current_tenant"())) WITH CHECK (("tenant_id" = "public"."current_tenant"()));



CREATE POLICY "licenze_tenant_policy" ON "admin"."licenze" USING (("tenant_id" = "public"."current_tenant"())) WITH CHECK (("tenant_id" = "public"."current_tenant"()));



ALTER TABLE "core"."audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "core"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_delete" ON "core"."categories" FOR DELETE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "categories_insert" ON "core"."categories" FOR INSERT WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "categories_select" ON "core"."categories" FOR SELECT USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "categories_update" ON "core"."categories" FOR UPDATE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"()))) WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



ALTER TABLE "core"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "core"."invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoices_delete" ON "core"."invoices" FOR DELETE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "invoices_insert" ON "core"."invoices" FOR INSERT WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "invoices_select" ON "core"."invoices" FOR SELECT USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "invoices_update" ON "core"."invoices" FOR UPDATE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"()))) WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "no_delete" ON "core"."audit_log" FOR DELETE USING (false);



CREATE POLICY "no_delete" ON "core"."categories" FOR DELETE USING (false);



CREATE POLICY "no_delete" ON "core"."invoices" FOR DELETE USING (false);



CREATE POLICY "no_delete" ON "core"."orders" FOR DELETE USING (false);



CREATE POLICY "no_delete" ON "core"."payments" FOR DELETE USING (false);



CREATE POLICY "no_delete" ON "core"."points_of_sale" FOR DELETE USING (false);



CREATE POLICY "no_delete" ON "core"."products" FOR DELETE USING (false);



CREATE POLICY "no_delete" ON "core"."punti_vendita" FOR DELETE USING (false);



CREATE POLICY "no_delete" ON "core"."roles" FOR DELETE USING (false);



CREATE POLICY "no_delete" ON "core"."subscriptions" FOR DELETE USING (false);



CREATE POLICY "no_delete" ON "core"."user_profiles" FOR DELETE USING (false);



CREATE POLICY "no_delete" ON "core"."user_roles" FOR DELETE USING (false);



CREATE POLICY "no_delete" ON "core"."users" FOR DELETE USING (false);



CREATE POLICY "no_delete" ON "core"."utenti_tenant" FOR DELETE USING (false);



ALTER TABLE "core"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orders_delete" ON "core"."orders" FOR DELETE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "orders_insert" ON "core"."orders" FOR INSERT WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "orders_select" ON "core"."orders" FOR SELECT USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "orders_update" ON "core"."orders" FOR UPDATE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"()))) WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



ALTER TABLE "core"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "core"."points_of_sale" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "points_of_sale_delete" ON "core"."points_of_sale" FOR DELETE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "points_of_sale_insert" ON "core"."points_of_sale" FOR INSERT WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "points_of_sale_select" ON "core"."points_of_sale" FOR SELECT USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "points_of_sale_update" ON "core"."points_of_sale" FOR UPDATE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"()))) WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



ALTER TABLE "core"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_delete" ON "core"."products" FOR DELETE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "products_insert" ON "core"."products" FOR INSERT WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "products_select" ON "core"."products" FOR SELECT USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "products_update" ON "core"."products" FOR UPDATE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"()))) WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



ALTER TABLE "core"."punti_vendita" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "punti_vendita_delete" ON "core"."punti_vendita" FOR DELETE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "punti_vendita_insert" ON "core"."punti_vendita" FOR INSERT WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "punti_vendita_select" ON "core"."punti_vendita" FOR SELECT USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "punti_vendita_update" ON "core"."punti_vendita" FOR UPDATE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"()))) WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



ALTER TABLE "core"."roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roles_delete" ON "core"."roles" FOR DELETE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "roles_insert" ON "core"."roles" FOR INSERT WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "roles_select" ON "core"."roles" FOR SELECT USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "roles_update" ON "core"."roles" FOR UPDATE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"()))) WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



ALTER TABLE "core"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscriptions_delete" ON "core"."subscriptions" FOR DELETE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "subscriptions_insert" ON "core"."subscriptions" FOR INSERT WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "subscriptions_select" ON "core"."subscriptions" FOR SELECT USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "subscriptions_update" ON "core"."subscriptions" FOR UPDATE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"()))) WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "tenant_insert" ON "core"."audit_log" FOR INSERT WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_insert" ON "core"."categories" FOR INSERT WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_insert" ON "core"."invoices" FOR INSERT WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_insert" ON "core"."orders" FOR INSERT WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_insert" ON "core"."payments" FOR INSERT WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_insert" ON "core"."points_of_sale" FOR INSERT WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_insert" ON "core"."products" FOR INSERT WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_insert" ON "core"."punti_vendita" FOR INSERT WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_insert" ON "core"."roles" FOR INSERT WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_insert" ON "core"."subscriptions" FOR INSERT WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_insert" ON "core"."user_profiles" FOR INSERT WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_insert" ON "core"."user_roles" FOR INSERT WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_insert" ON "core"."users" FOR INSERT WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_insert" ON "core"."utenti_tenant" FOR INSERT WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "core"."audit_log" USING ((("tenant_id" = "core"."current_tenant_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "tenant_isolation" ON "core"."categories" USING ((("tenant_id" = "core"."current_tenant_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "tenant_isolation" ON "core"."events" USING (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "core"."invoices" USING ((("tenant_id" = "core"."current_tenant_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "tenant_isolation" ON "core"."orders" USING ((("tenant_id" = "core"."current_tenant_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "tenant_isolation" ON "core"."payments" USING ((("tenant_id" = "core"."current_tenant_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "tenant_isolation" ON "core"."points_of_sale" USING ((("tenant_id" = "core"."current_tenant_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "tenant_isolation" ON "core"."products" USING ((("tenant_id" = "core"."current_tenant_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "tenant_isolation" ON "core"."punti_vendita" USING ((("tenant_id" = "core"."current_tenant_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "tenant_isolation" ON "core"."roles" USING ((("tenant_id" = "core"."current_tenant_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "tenant_isolation" ON "core"."subscriptions" USING ((("tenant_id" = "core"."current_tenant_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "tenant_isolation" ON "core"."user_profiles" USING ((("tenant_id" = "core"."current_tenant_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "tenant_isolation" ON "core"."user_roles" USING ((("tenant_id" = "core"."current_tenant_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "tenant_isolation" ON "core"."users" USING ((("tenant_id" = "core"."current_tenant_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "tenant_isolation" ON "core"."utenti_tenant" USING ((("tenant_id" = "core"."current_tenant_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "tenant_isolation_delete" ON "core"."punti_vendita" FOR DELETE USING (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_isolation_insert" ON "core"."punti_vendita" FOR INSERT WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_isolation_orders" ON "core"."orders" USING (("tenant_id" = "core"."require_tenant"())) WITH CHECK (("tenant_id" = "core"."require_tenant"()));



CREATE POLICY "tenant_isolation_points_of_sale" ON "core"."points_of_sale" USING (("tenant_id" = "core"."require_tenant"())) WITH CHECK (("tenant_id" = "core"."require_tenant"()));



CREATE POLICY "tenant_isolation_policy" ON "core"."user_profiles" USING (("tenant_id" = ("current_setting"('app.tenant_id'::"text"))::"uuid"));



CREATE POLICY "tenant_isolation_roles" ON "core"."roles" USING (("tenant_id" = "core"."require_tenant"())) WITH CHECK (("tenant_id" = "core"."require_tenant"()));



CREATE POLICY "tenant_isolation_select" ON "core"."punti_vendita" FOR SELECT USING (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_isolation_update" ON "core"."punti_vendita" FOR UPDATE USING (("tenant_id" = "core"."current_tenant_id"())) WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_isolation_user_profiles" ON "core"."user_profiles" USING (("tenant_id" = "core"."require_tenant"())) WITH CHECK (("tenant_id" = "core"."require_tenant"()));



CREATE POLICY "tenant_isolation_user_roles" ON "core"."user_roles" USING (("tenant_id" = "core"."require_tenant"())) WITH CHECK (("tenant_id" = "core"."require_tenant"()));



CREATE POLICY "tenant_policy_categories" ON "core"."categories" USING (("tenant_id" = ("current_setting"('app.tenant_id'::"text"))::"uuid")) WITH CHECK (("tenant_id" = ("current_setting"('app.tenant_id'::"text"))::"uuid"));



CREATE POLICY "tenant_policy_invoices" ON "core"."invoices" USING (("tenant_id" = ("current_setting"('app.tenant_id'::"text"))::"uuid")) WITH CHECK (("tenant_id" = ("current_setting"('app.tenant_id'::"text"))::"uuid"));



CREATE POLICY "tenant_policy_orders" ON "core"."orders" USING (("tenant_id" = ("current_setting"('app.tenant_id'::"text"))::"uuid")) WITH CHECK (("tenant_id" = ("current_setting"('app.tenant_id'::"text"))::"uuid"));



CREATE POLICY "tenant_policy_pos" ON "core"."points_of_sale" USING (("tenant_id" = ("current_setting"('app.tenant_id'::"text"))::"uuid")) WITH CHECK (("tenant_id" = ("current_setting"('app.tenant_id'::"text"))::"uuid"));



CREATE POLICY "tenant_policy_products" ON "core"."products" USING (("tenant_id" = ("current_setting"('app.tenant_id'::"text"))::"uuid")) WITH CHECK (("tenant_id" = ("current_setting"('app.tenant_id'::"text"))::"uuid"));



CREATE POLICY "tenant_policy_roles" ON "core"."roles" USING (("tenant_id" = ("current_setting"('app.tenant_id'::"text"))::"uuid")) WITH CHECK (("tenant_id" = ("current_setting"('app.tenant_id'::"text"))::"uuid"));



CREATE POLICY "tenant_policy_user_profiles" ON "core"."user_profiles" USING (("tenant_id" = ("current_setting"('app.tenant_id'::"text"))::"uuid")) WITH CHECK (("tenant_id" = ("current_setting"('app.tenant_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "core"."audit_log" FOR UPDATE USING (("tenant_id" = "core"."current_tenant_id"())) WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_update" ON "core"."categories" FOR UPDATE USING (("tenant_id" = "core"."current_tenant_id"())) WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_update" ON "core"."invoices" FOR UPDATE USING (("tenant_id" = "core"."current_tenant_id"())) WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_update" ON "core"."orders" FOR UPDATE USING (("tenant_id" = "core"."current_tenant_id"())) WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_update" ON "core"."payments" FOR UPDATE USING (("tenant_id" = "core"."current_tenant_id"())) WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_update" ON "core"."points_of_sale" FOR UPDATE USING (("tenant_id" = "core"."current_tenant_id"())) WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_update" ON "core"."products" FOR UPDATE USING (("tenant_id" = "core"."current_tenant_id"())) WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_update" ON "core"."punti_vendita" FOR UPDATE USING (("tenant_id" = "core"."current_tenant_id"())) WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_update" ON "core"."roles" FOR UPDATE USING (("tenant_id" = "core"."current_tenant_id"())) WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_update" ON "core"."subscriptions" FOR UPDATE USING (("tenant_id" = "core"."current_tenant_id"())) WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_update" ON "core"."user_profiles" FOR UPDATE USING (("tenant_id" = "core"."current_tenant_id"())) WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_update" ON "core"."user_roles" FOR UPDATE USING (("tenant_id" = "core"."current_tenant_id"())) WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_update" ON "core"."users" FOR UPDATE USING (("tenant_id" = "core"."current_tenant_id"())) WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



CREATE POLICY "tenant_update" ON "core"."utenti_tenant" FOR UPDATE USING (("tenant_id" = "core"."current_tenant_id"())) WITH CHECK (("tenant_id" = "core"."current_tenant_id"()));



ALTER TABLE "core"."tenants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "core"."user_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_profiles_delete" ON "core"."user_profiles" FOR DELETE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "user_profiles_insert" ON "core"."user_profiles" FOR INSERT WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "user_profiles_select" ON "core"."user_profiles" FOR SELECT USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "user_profiles_update" ON "core"."user_profiles" FOR UPDATE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"()))) WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



ALTER TABLE "core"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_roles_delete" ON "core"."user_roles" FOR DELETE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "user_roles_insert" ON "core"."user_roles" FOR INSERT WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "user_roles_select" ON "core"."user_roles" FOR SELECT USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "user_roles_update" ON "core"."user_roles" FOR UPDATE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"()))) WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



ALTER TABLE "core"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_delete" ON "core"."users" FOR DELETE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "users_insert" ON "core"."users" FOR INSERT WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "users_select" ON "core"."users" FOR SELECT USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "users_update" ON "core"."users" FOR UPDATE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"()))) WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



ALTER TABLE "core"."utenti_tenant" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "utenti_tenant_delete" ON "core"."utenti_tenant" FOR DELETE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "utenti_tenant_insert" ON "core"."utenti_tenant" FOR INSERT WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "utenti_tenant_select" ON "core"."utenti_tenant" FOR SELECT USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "utenti_tenant_update" ON "core"."utenti_tenant" FOR UPDATE USING (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"()))) WITH CHECK (("core"."is_superadmin"() OR ("tenant_id" = "core"."current_tenant_id"())));



CREATE POLICY "Enable insert for authenticated users" ON "public"."aziende" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable select for authenticated users" ON "public"."aziende" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_no_write" ON "public"."audit_log" USING (false) WITH CHECK (false);



CREATE POLICY "audit_select" ON "public"."audit_log" FOR SELECT USING (("azienda_id" = "public"."get_my_azienda_id"()));



ALTER TABLE "public"."aziende" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "aziende_delete_own" ON "public"."aziende" FOR DELETE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "aziende_insert_own" ON "public"."aziende" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "aziende_isolation_policy" ON "public"."aziende" USING (("tenant_id" = "public"."current_tenant"())) WITH CHECK (("tenant_id" = "public"."current_tenant"()));



CREATE POLICY "aziende_select_own" ON "public"."aziende" FOR SELECT USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "aziende_update_own" ON "public"."aziende" FOR UPDATE USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



ALTER TABLE "public"."categorie_prodotti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clienti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ingredienti" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert_ordini" ON "public"."ordini" FOR INSERT WITH CHECK ((("tenant_id" = "public"."get_current_tenant"()) AND "public"."user_has_permission"('ordine.crea'::"text", "punto_vendita_id")));



CREATE POLICY "insert_ruoli_superadmin" ON "public"."ruoli" FOR INSERT WITH CHECK ((("tenant_id" = "public"."get_current_tenant"()) AND "public"."user_has_permission"('tenant.configura'::"text", NULL::"uuid") AND ("is_system" = false) AND ("is_superadmin" = false)));



CREATE POLICY "manage_ruoli_permessi_superadmin" ON "public"."ruoli_permessi" USING ("public"."user_has_permission"('tenant.configura'::"text", NULL::"uuid"));



CREATE POLICY "manage_utenti_ruoli_superadmin" ON "public"."utenti_ruoli" USING ((("tenant_id" = "public"."get_current_tenant"()) AND "public"."user_has_permission"('tenant.configura'::"text", NULL::"uuid")));



ALTER TABLE "public"."movimenti_magazzino" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "no_delete_audit" ON "public"."audit_log" FOR DELETE USING (false);



CREATE POLICY "no_update_audit" ON "public"."audit_log" FOR UPDATE USING (false);



ALTER TABLE "public"."ordine_ingredienti" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ordine_insert_permesso" ON "public"."ordini" FOR INSERT WITH CHECK ((("tenant_id" = "public"."get_current_tenant"()) AND "public"."user_has_permission"('ordine.crea'::"text")));



CREATE POLICY "ordine_update_permesso" ON "public"."ordini" FOR UPDATE USING ((("tenant_id" = "public"."get_current_tenant"()) AND "public"."user_has_permission"('ordine.modifica'::"text")));



ALTER TABLE "public"."ordini" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ordini_delete" ON "public"."ordini" FOR DELETE USING ((("azienda_id" = "public"."get_my_azienda_id"()) AND ("public"."get_my_role"() = ANY (ARRAY['owner'::"public"."ruolo_azienda", 'admin'::"public"."ruolo_azienda"]))));



CREATE POLICY "ordini_insert" ON "public"."ordini" FOR INSERT WITH CHECK ((("azienda_id" = "public"."get_my_azienda_id"()) AND "public"."can_write"()));



ALTER TABLE "public"."ordini_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ordini_select" ON "public"."ordini" FOR SELECT USING (("azienda_id" = "public"."get_my_azienda_id"()));



CREATE POLICY "ordini_update" ON "public"."ordini" FOR UPDATE USING (("azienda_id" = "public"."get_my_azienda_id"())) WITH CHECK ((("azienda_id" = "public"."get_my_azienda_id"()) AND "public"."can_write"()));



ALTER TABLE "public"."pagamenti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parametri" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pm_tenants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prezzi_prodotti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prodotti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prodotto_ingredienti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profili" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public read ordini" ON "public"."ordini" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."punti_vendita" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pv_all_by_azienda" ON "public"."punti_vendita" USING (("azienda_id" IN ( SELECT "aziende"."id"
   FROM "public"."aziende"
  WHERE ("aziende"."owner_id" = "auth"."uid"())))) WITH CHECK (("azienda_id" IN ( SELECT "aziende"."id"
   FROM "public"."aziende"
  WHERE ("aziende"."owner_id" = "auth"."uid"()))));



ALTER TABLE "public"."righe_ordine" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ruoli" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ruoli_permessi" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select_audit_tenant" ON "public"."audit_log" FOR SELECT USING ((("tenant_id" = "public"."get_current_tenant"()) AND "public"."user_has_permission"('dashboard.analytics'::"text", NULL::"uuid")));



CREATE POLICY "select_ordini" ON "public"."ordini" FOR SELECT USING (("tenant_id" = "public"."get_current_tenant"()));



CREATE POLICY "select_ruoli_tenant" ON "public"."ruoli" FOR SELECT USING (("tenant_id" = "public"."get_current_tenant"()));



CREATE POLICY "superadmin_aziende" ON "public"."aziende" USING ("public"."is_superadmin"());



CREATE POLICY "superadmin_categorie_prodotti" ON "public"."categorie_prodotti" USING ("public"."is_superadmin"());



CREATE POLICY "superadmin_clienti" ON "public"."clienti" USING ("public"."is_superadmin"());



CREATE POLICY "superadmin_ingredienti" ON "public"."ingredienti" USING ("public"."is_superadmin"());



CREATE POLICY "superadmin_movimenti_magazzino" ON "public"."movimenti_magazzino" USING ("public"."is_superadmin"());



CREATE POLICY "superadmin_ordini" ON "public"."ordini" USING ("public"."is_superadmin"());



CREATE POLICY "superadmin_pagamenti" ON "public"."pagamenti" USING ("public"."is_superadmin"());



CREATE POLICY "superadmin_prezzi_prodotti" ON "public"."prezzi_prodotti" USING ("public"."is_superadmin"());



CREATE POLICY "superadmin_prodotti" ON "public"."prodotti" USING ("public"."is_superadmin"());



CREATE POLICY "superadmin_prodotto_ingredienti" ON "public"."prodotto_ingredienti" USING ("public"."is_superadmin"());



CREATE POLICY "superadmin_profiles" ON "public"."profiles" USING ("public"."is_superadmin"());



CREATE POLICY "superadmin_punti_vendita" ON "public"."punti_vendita" USING ("public"."is_superadmin"());



CREATE POLICY "superadmin_righe_ordine" ON "public"."righe_ordine" USING ("public"."is_superadmin"());



CREATE POLICY "superadmin_varianti" ON "public"."varianti" USING ("public"."is_superadmin"());



CREATE POLICY "tenant_aziende" ON "public"."aziende" USING ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"())) WITH CHECK ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"()));



CREATE POLICY "tenant_categorie_prodotti" ON "public"."categorie_prodotti" USING ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"())) WITH CHECK ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"()));



CREATE POLICY "tenant_clienti" ON "public"."clienti" USING ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"())) WITH CHECK ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"()));



CREATE POLICY "tenant_ingredienti" ON "public"."ingredienti" USING ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"())) WITH CHECK ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"()));



CREATE POLICY "tenant_isolation_delete" ON "public"."ordini" FOR DELETE USING (("tenant_id" = "public"."get_current_tenant"()));



CREATE POLICY "tenant_isolation_insert" ON "public"."ordini" FOR INSERT WITH CHECK (("tenant_id" = "public"."get_current_tenant"()));



CREATE POLICY "tenant_isolation_select" ON "public"."ordini" FOR SELECT USING (("tenant_id" = "public"."get_current_tenant"()));



CREATE POLICY "tenant_isolation_turni_operatori" ON "public"."turni_operatori" USING (("tenant_id" = (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid"));



CREATE POLICY "tenant_isolation_update" ON "public"."ordini" FOR UPDATE USING (("tenant_id" = "public"."get_current_tenant"()));



CREATE POLICY "tenant_movimenti_magazzino" ON "public"."movimenti_magazzino" USING ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"())) WITH CHECK ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"()));



CREATE POLICY "tenant_ordini" ON "public"."ordini" USING ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"())) WITH CHECK ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"()));



CREATE POLICY "tenant_pagamenti" ON "public"."pagamenti" USING ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"())) WITH CHECK ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"()));



CREATE POLICY "tenant_policy_aziende" ON "public"."aziende" USING (("tenant_id" = "public"."current_tenant"())) WITH CHECK (("tenant_id" = "public"."current_tenant"()));



CREATE POLICY "tenant_policy_ordini" ON "public"."ordini" USING (("tenant_id" = "public"."current_tenant"())) WITH CHECK (("tenant_id" = "public"."current_tenant"()));



CREATE POLICY "tenant_policy_prezzi_prodotti" ON "public"."prezzi_prodotti" USING (("tenant_id" = "public"."current_tenant"())) WITH CHECK (("tenant_id" = "public"."current_tenant"()));



CREATE POLICY "tenant_policy_prodotti" ON "public"."prodotti" USING (("tenant_id" = "public"."current_tenant"())) WITH CHECK (("tenant_id" = "public"."current_tenant"()));



CREATE POLICY "tenant_policy_profiles" ON "public"."profiles" USING (("tenant_id" = "public"."current_tenant"())) WITH CHECK (("tenant_id" = "public"."current_tenant"()));



CREATE POLICY "tenant_policy_punti_vendita" ON "public"."punti_vendita" USING (("tenant_id" = "public"."current_tenant"())) WITH CHECK (("tenant_id" = "public"."current_tenant"()));



CREATE POLICY "tenant_prezzi_prodotti" ON "public"."prezzi_prodotti" USING ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"())) WITH CHECK ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"()));



CREATE POLICY "tenant_prodotti" ON "public"."prodotti" USING ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"())) WITH CHECK ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"()));



CREATE POLICY "tenant_prodotto_ingredienti" ON "public"."prodotto_ingredienti" USING ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"())) WITH CHECK ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"()));



CREATE POLICY "tenant_profiles" ON "public"."profiles" USING ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"())) WITH CHECK ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"()));



CREATE POLICY "tenant_punti_vendita" ON "public"."punti_vendita" USING ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"())) WITH CHECK ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"()));



CREATE POLICY "tenant_righe_ordine" ON "public"."righe_ordine" USING ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"())) WITH CHECK ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"()));



CREATE POLICY "tenant_varianti" ON "public"."varianti" USING ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"())) WITH CHECK ((("tenant_id" = "public"."current_tenant"()) AND "public"."license_is_active"()));



ALTER TABLE "public"."turni_operatori" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "turni_operatori_all_by_azienda" ON "public"."turni_operatori" USING (("azienda_id" IN ( SELECT "aziende"."id"
   FROM "public"."aziende"
  WHERE ("aziende"."owner_id" = "auth"."uid"())))) WITH CHECK (("azienda_id" IN ( SELECT "aziende"."id"
   FROM "public"."aziende"
  WHERE ("aziende"."owner_id" = "auth"."uid"()))));



CREATE POLICY "update_ordini" ON "public"."ordini" FOR UPDATE USING ((("tenant_id" = "public"."get_current_tenant"()) AND "public"."user_has_permission"('ordine.modifica'::"text", "punto_vendita_id")));



CREATE POLICY "update_ruoli_superadmin" ON "public"."ruoli" FOR UPDATE USING ((("tenant_id" = "public"."get_current_tenant"()) AND "public"."user_has_permission"('tenant.configura'::"text", NULL::"uuid") AND ("is_system" = false)));



ALTER TABLE "public"."user_operatives" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_tenants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."utenti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."utenti_ruoli" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "utenti_ruoli_all_by_azienda" ON "public"."utenti_ruoli" USING (("azienda_id" IN ( SELECT "aziende"."id"
   FROM "public"."aziende"
  WHERE ("aziende"."owner_id" = "auth"."uid"())))) WITH CHECK (("azienda_id" IN ( SELECT "aziende"."id"
   FROM "public"."aziende"
  WHERE ("aziende"."owner_id" = "auth"."uid"()))));



ALTER TABLE "public"."varianti" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."ingredienti";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."ordine_ingredienti";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."ordini";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."righe_ordine";



GRANT USAGE ON SCHEMA "core" TO "authenticated";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "core"."audit_trigger"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "core"."compute_audit_hash"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "core"."create_tenant"("p_tenant_name" "text", "p_domain" "text", "p_plan" "text", "p_owner_user_id" "uuid", "p_owner_email" "text", "p_owner_full_name" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "core"."current_punto_vendita_id"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "core"."current_tenant_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "core"."current_tenant_id"() TO "authenticated";



REVOKE ALL ON FUNCTION "core"."decrypt_data"("data" "bytea") FROM PUBLIC;



REVOKE ALL ON FUNCTION "core"."enable_audit_on_all_tables"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "core"."enable_rls_for_table"("p_table_name" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "core"."enable_rls_on_all_tables"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "core"."encrypt_data"("data" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "core"."has_permission"("p_code" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "core"."is_superadmin"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "core"."require_tenant"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "core"."resolve_tenant_from_domain"("p_host" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "core"."set_app_context"("tenant" "uuid", "punto_vendita" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "core"."set_current_tenant_from_host"("p_host" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_annulla"("p_ordine_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_annulla"("p_ordine_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_annulla"("p_ordine_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_annulla_ordine"("ordine_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_annulla_ordine"("ordine_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_annulla_ordine"("ordine_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."annulla_ordine"("p_ordine_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."annulla_ordine"("p_ordine_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."annulla_ordine"("p_ordine_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."attach_audit_to_all_tables"() TO "anon";
GRANT ALL ON FUNCTION "public"."attach_audit_to_all_tables"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."attach_audit_to_all_tables"() TO "service_role";



GRANT ALL ON FUNCTION "public"."attach_audit_trigger_safe"("p_table" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."attach_audit_trigger_safe"("p_table" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."attach_audit_trigger_safe"("p_table" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_all"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_all"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_all"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."audit_trigger"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."audit_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_trigger_fn"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_trigger_fn"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_trigger_fn"() TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_trigger_function"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_trigger_function"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_trigger_function"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_attach_audit"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_attach_audit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_attach_audit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bancone_consegna"("p_ordine_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."bancone_consegna"("p_ordine_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."bancone_consegna"("p_ordine_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."bancone_consegna_ordine"("ordine_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."bancone_consegna_ordine"("ordine_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bancone_consegna_ordine"("ordine_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."blocca_update_stato_override"() TO "anon";
GRANT ALL ON FUNCTION "public"."blocca_update_stato_override"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."blocca_update_stato_override"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calcola_totale_ordine"("p_ordine_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calcola_totale_ordine"("p_ordine_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calcola_totale_ordine"("p_ordine_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_punto_vendita"("pv_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_punto_vendita"("pv_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_punto_vendita"("pv_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_pv"("pv_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_pv"("pv_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_pv"("pv_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_write"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."can_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_write"() TO "service_role";



GRANT ALL ON FUNCTION "public"."checkout_ordine"("p_ordine_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."checkout_ordine"("p_ordine_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkout_ordine"("p_ordine_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_roles"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_roles"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_roles"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_tenant"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_tenant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_tenant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_tenant"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_tenant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_tenant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."genera_delivery_token"("p_ordine_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."genera_delivery_token"("p_ordine_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."genera_delivery_token"("p_ordine_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."genera_numero_ordine"("pv_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."genera_numero_ordine"("pv_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."genera_numero_ordine"("pv_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_tenant"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_tenant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_tenant"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_azienda_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_azienda_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_azienda_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_azienda_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_punto_vendita"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_punto_vendita"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_punto_vendita"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_ruolo_corrente"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_ruolo_corrente"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_ruolo_corrente"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."inserisci_ordine"("p_utente_id" "uuid", "p_ruolo" "text", "p_stato" "text", "p_totale" numeric, "p_carrello" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."inserisci_ordine"("p_utente_id" "uuid", "p_ruolo" "text", "p_stato" "text", "p_totale" numeric, "p_carrello" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inserisci_ordine"("p_utente_id" "uuid", "p_ruolo" "text", "p_stato" "text", "p_totale" numeric, "p_carrello" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_superadmin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_superadmin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_superadmin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."license_is_active"() TO "anon";
GRANT ALL ON FUNCTION "public"."license_is_active"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."license_is_active"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_admin_action"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_admin_action"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_admin_action"() TO "service_role";



GRANT ALL ON FUNCTION "public"."pony_avvia_consegna"("p_ordine_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."pony_avvia_consegna"("p_ordine_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pony_avvia_consegna"("p_ordine_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."pony_avvia_consegna"("ordine_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."pony_avvia_consegna"("ordine_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pony_avvia_consegna"("ordine_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."pony_consegna_completata"("p_ordine_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."pony_consegna_completata"("p_ordine_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pony_consegna_completata"("p_ordine_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."pony_consegna_completata"("ordine_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."pony_consegna_completata"("ordine_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pony_consegna_completata"("ordine_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."pony_consegna_con_token"("p_token" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."pony_consegna_con_token"("p_token" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pony_consegna_con_token"("p_token" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."pony_scan_qr"("p_token" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."pony_scan_qr"("p_token" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pony_scan_qr"("p_token" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_azienda_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_azienda_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_azienda_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_numero_ordine"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_numero_ordine"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_numero_ordine"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_tenant_id"() TO "service_role";

GRANT ALL ON FUNCTION "public"."user_has_permission"("p_permesso" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_permission"("p_permesso" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_permission"("p_permesso" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_has_permission"("p_permesso" "text", "p_punto_vendita_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_permission"("p_permesso" "text", "p_punto_vendita_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_permission"("p_permesso" "text", "p_punto_vendita_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."verify_audit_chain"("p_azienda" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_audit_chain"("p_azienda" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_audit_chain"("p_azienda" "uuid") TO "service_role";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "core"."audit_log" TO "authenticated";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "core"."categories" TO "authenticated";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "core"."invoices" TO "authenticated";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "core"."order_items" TO "authenticated";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "core"."orders" TO "authenticated";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "core"."payments" TO "authenticated";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "core"."permissions" TO "authenticated";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "core"."points_of_sale" TO "authenticated";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "core"."products" TO "authenticated";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "core"."role_permissions" TO "authenticated";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "core"."roles" TO "authenticated";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "core"."subscriptions" TO "authenticated";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "core"."tenants" TO "authenticated";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "core"."user_profiles" TO "authenticated";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "core"."user_roles" TO "authenticated";

GRANT ALL ON TABLE "public"."Ingredient" TO "anon";
GRANT ALL ON TABLE "public"."Ingredient" TO "authenticated";
GRANT ALL ON TABLE "public"."Ingredient" TO "service_role";

GRANT ALL ON TABLE "public"."Order" TO "anon";
GRANT ALL ON TABLE "public"."Order" TO "authenticated";
GRANT ALL ON TABLE "public"."Order" TO "service_role";

GRANT ALL ON TABLE "public"."OrderItem" TO "anon";
GRANT ALL ON TABLE "public"."OrderItem" TO "authenticated";
GRANT ALL ON TABLE "public"."OrderItem" TO "service_role";

GRANT ALL ON TABLE "public"."Pizza" TO "anon";
GRANT ALL ON TABLE "public"."Pizza" TO "authenticated";
GRANT ALL ON TABLE "public"."Pizza" TO "service_role";

GRANT ALL ON TABLE "public"."PizzaIngredient" TO "anon";
GRANT ALL ON TABLE "public"."PizzaIngredient" TO "authenticated";
GRANT ALL ON TABLE "public"."PizzaIngredient" TO "service_role";

GRANT ALL ON TABLE "public"."Pizzeria" TO "anon";
GRANT ALL ON TABLE "public"."Pizzeria" TO "authenticated";
GRANT ALL ON TABLE "public"."Pizzeria" TO "service_role";

GRANT ALL ON TABLE "public"."User" TO "anon";
GRANT ALL ON TABLE "public"."User" TO "authenticated";
GRANT ALL ON TABLE "public"."User" TO "service_role";

GRANT ALL ON TABLE "public"."audit_log" TO "service_role";

GRANT ALL ON TABLE "public"."aziende" TO "service_role";

GRANT ALL ON TABLE "public"."categorie_prodotti" TO "service_role";

GRANT ALL ON TABLE "public"."clienti" TO "service_role";

GRANT ALL ON TABLE "public"."ingredienti" TO "service_role";

GRANT ALL ON TABLE "public"."movimenti_magazzino" TO "service_role";

GRANT ALL ON TABLE "public"."ordine_ingredienti" TO "service_role";

GRANT ALL ON TABLE "public"."ordini" TO "service_role";

GRANT ALL ON TABLE "public"."ordini_items" TO "service_role";

GRANT ALL ON TABLE "public"."pagamenti" TO "service_role";

GRANT ALL ON TABLE "public"."parametri" TO "service_role";

GRANT ALL ON TABLE "public"."parametri_pv" TO "service_role";

GRANT ALL ON SEQUENCE "public"."parametri_pv_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."permessi" TO "service_role";

GRANT ALL ON TABLE "public"."pm_tenants" TO "anon";
GRANT ALL ON TABLE "public"."pm_tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."pm_tenants" TO "service_role";

GRANT ALL ON TABLE "public"."prezzi_prodotti" TO "service_role";

GRANT ALL ON TABLE "public"."prodotti" TO "service_role";

GRANT ALL ON TABLE "public"."prodotto_ingredienti" TO "service_role";

GRANT ALL ON TABLE "public"."profiles" TO "service_role";

GRANT ALL ON TABLE "public"."profili" TO "service_role";

GRANT ALL ON TABLE "public"."punti_vendita" TO "service_role";

GRANT ALL ON TABLE "public"."righe_ordine" TO "service_role";

GRANT ALL ON TABLE "public"."roles" TO "service_role";

GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."ruoli" TO "service_role";

GRANT ALL ON TABLE "public"."ruoli_permessi" TO "service_role";

GRANT ALL ON TABLE "public"."tenant" TO "service_role";

GRANT ALL ON TABLE "public"."tenants" TO "service_role";

GRANT ALL ON TABLE "public"."turni_operatori" TO "service_role";

GRANT ALL ON SEQUENCE "public"."turni_operatori_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."user_operatives" TO "service_role";

GRANT ALL ON SEQUENCE "public"."user_operatives_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."user_tenants" TO "anon";
GRANT ALL ON TABLE "public"."user_tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."user_tenants" TO "service_role";

GRANT ALL ON TABLE "public"."utenti" TO "service_role";

GRANT ALL ON TABLE "public"."utenti_ruoli" TO "service_role";

GRANT ALL ON TABLE "public"."varianti" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
-- ---------- END: supabase/migrations/20260220171734_remote_schema.sql ----------

-- ---------- BEGIN: supabase/migrations/20260405120000_superadmin_registratore_state.sql ----------
-- Registratore cassa Super Admin — stato persistente (JSON) per utente, RLS solo superadmin.
-- Esegui dopo public.utenti_ruoli (ruolo superadmin).

CREATE TABLE IF NOT EXISTS public.superadmin_registratore_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_superadmin_registratore_state_user
  ON public.superadmin_registratore_state (user_id);

COMMENT ON TABLE public.superadmin_registratore_state IS
  'Stato registratore cassa standalone (Super Admin). Un blob JSON per utente; nessun tenant_id.';

ALTER TABLE public.superadmin_registratore_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_registratore_state_superadmin_all" ON public.superadmin_registratore_state;

CREATE POLICY "superadmin_registratore_state_superadmin_all"
  ON public.superadmin_registratore_state
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND lower(trim(ur.ruolo)) = 'superadmin'
        AND (ur.attivo IS DISTINCT FROM false)
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND lower(trim(ur.ruolo)) = 'superadmin'
        AND (ur.attivo IS DISTINCT FROM false)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.superadmin_registratore_state TO authenticated;
-- ---------- END: supabase/migrations/20260405120000_superadmin_registratore_state.sql ----------

-- ---------- BEGIN: supabase/migrations/20260405140000_superadmin_registratore_audit_revision.sql ----------
-- Registratore Super Admin: revisione monotona (multi-scheda, ultima scrittura vince al save)
-- + audit append-only (nessun UPDATE/DELETE da client).

-- 1) Colonna revision (idempotente su DB già migrati senza colonna)
ALTER TABLE public.superadmin_registratore_state
  ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1;

-- 2) Trigger: updated_at + revision gestiti solo lato server (ignora valori client)
CREATE OR REPLACE FUNCTION public.tg_superadmin_registratore_state_biu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.revision := 1;
    RETURN NEW;
  END IF;
  IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'superadmin_registratore_state: user_id immutabile';
  END IF;
  NEW.revision := OLD.revision + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_superadmin_registratore_state_biu ON public.superadmin_registratore_state;
CREATE TRIGGER tr_superadmin_registratore_state_biu
  BEFORE INSERT OR UPDATE ON public.superadmin_registratore_state
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_superadmin_registratore_state_biu();

-- 3) Audit append-only
CREATE TABLE IF NOT EXISTS public.superadmin_registratore_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  op text NOT NULL CHECK (op IN ('insert', 'update')),
  revision bigint NOT NULL,
  payload_before jsonb,
  payload_after jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_superadmin_registratore_audit_user_created
  ON public.superadmin_registratore_audit (user_id, created_at DESC);

COMMENT ON TABLE public.superadmin_registratore_audit IS
  'Append-only: ogni salvataggio stato registratore. Nessun UPDATE/DELETE da ruolo authenticated.';

ALTER TABLE public.superadmin_registratore_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_registratore_audit_select_own" ON public.superadmin_registratore_audit;

CREATE POLICY "superadmin_registratore_audit_select_own"
  ON public.superadmin_registratore_audit
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND lower(trim(ur.ruolo)) = 'superadmin'
        AND (ur.attivo IS DISTINCT FROM false)
    )
  );

-- Nessuna policy INSERT/UPDATE/DELETE per authenticated: solo trigger (SECURITY DEFINER).

GRANT SELECT ON public.superadmin_registratore_audit TO authenticated;

-- 4) Trigger audit (dopo commit logica stato)
CREATE OR REPLACE FUNCTION public.tg_superadmin_registratore_audit_aiu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.superadmin_registratore_audit (user_id, op, revision, payload_before, payload_after)
    VALUES (NEW.user_id, 'insert', NEW.revision, NULL, NEW.payload);
    RETURN NEW;
  END IF;
  INSERT INTO public.superadmin_registratore_audit (user_id, op, revision, payload_before, payload_after)
  VALUES (NEW.user_id, 'update', NEW.revision, OLD.payload, NEW.payload);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_superadmin_registratore_audit_aiu ON public.superadmin_registratore_state;
CREATE TRIGGER tr_superadmin_registratore_audit_aiu
  AFTER INSERT OR UPDATE ON public.superadmin_registratore_state
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_superadmin_registratore_audit_aiu();
-- ---------- END: supabase/migrations/20260405140000_superadmin_registratore_audit_revision.sql ----------

-- ---------- BEGIN: supabase/migrations/20260406100000_post_remote_schema_unified.sql ----------
-- Incrementale post-baseline (unica migration consolidata). Delta manuale corrente: sql/sql_upgrade.sql
-- =============================================================================
-- PizzaManager — Tutte le migration incrementali unificate (post remote_schema)
-- Copia speculare: supabase/migrations/20260406100000_post_remote_schema_unified.sql
-- Fonte unica per: SQL Editor manuale + supabase db push (dopo il baseline).
--
-- Ordine:
--   1) pizzamanager_unified_incremental (schema/viste/RLS base)
--   2) staff_password_note (tenant admin)
--   3) clienti auth trigger + colonne
--   4) superadmin ruoli_pizzeria + RLS staff_password
--   5) PM_LATEST: subscriptions ciclo, colonne ordini/righe, RPC create_order_with_items
--   6) Fidelity Card + parametri consegna/domicilio
--
-- Prerequisito: eseguire prima supabase/migrations/20260220171734_remote_schema.sql
--   (o DB già allineato a quello snapshot).
--
-- I marcatori -- >>> BEGIN / <<< END indicano la provenienza storica dei blocchi
-- (file migration originali rimossi; non rieseguire quei path come file separati).
-- =============================================================================

-- >>> BEGIN: supabase/migrations/20260402100000_pizzamanager_unified_incremental.sql
-- =============================================================================
-- PizzaManager — SQL UNIFICATO incrementale (idempotente)
-- Generato: consolidamento migrazioni 202502–202603 (storico); nuovi delta: sql/sql_upgrade.sql
--
-- Ordine: dopo il dump Supabase (supabase/migrations/20260220171734_remote_schema.sql)
--         oppure su DB già allineato. Sicuro da rieseguire (IF NOT EXISTS / blocchi DO).
--
-- Non include il dump remoto completo: resta il file separato remote_schema.
-- =============================================================================
-- ============================================
-- PIZZAMANAGER – RLS e indici enterprise
-- Eseguire su Supabase (schema public o core)
-- ============================================

-- Indici consigliati (adatta i nomi schema/tabella se usi "core")
-- Assumendo tabelle in schema public; se usi core.tenants ecc. sostituisci.

-- Tenants
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_attivo ON tenants(attivo);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;

-- Subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stato ON subscriptions(stato);

-- Audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entita_entita_id ON audit_logs(entita, entita_id);

-- Ordini (performance)
CREATE INDEX IF NOT EXISTS idx_ordini_tenant_id ON ordini(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ordini_stato ON ordini(stato);
CREATE INDEX IF NOT EXISTS idx_ordini_created_at ON ordini(created_at);

-- Prodotti / Ingredienti
CREATE INDEX IF NOT EXISTS idx_prodotti_tenant_id ON prodotti(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ingredienti_tenant_id ON ingredienti(tenant_id);

-- ============================================
-- RLS (Row Level Security) – esempio
-- Sblocca RLS sulle tabelle e crea policy per tenant
-- ============================================

-- Abilita RLS (esempio su ordini)
-- ALTER TABLE ordini ENABLE ROW LEVEL SECURITY;

-- Policy: utenti vedono solo i dati del proprio tenant
-- (Supabase usa auth.uid(); il tuo backend inietta tenant_id dal JWT)
-- CREATE POLICY "Isolate by tenant" ON ordini
--   FOR ALL
--   USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Nota: con backend Node/Nest che fa le query, spesso RLS non è usato e l’isolamento
-- è garantito dal middleware che inietta sempre tenantId nelle query.
-- Se usi Supabase Client dal frontend, abilita RLS e imposta app.current_tenant_id.


-- ============================================================
-- PIZZAMANAGER – FULL DATABASE ENTERPRISE
-- Multi-tenant SaaS – Schema: core
-- Idempotente – Sicuro da rieseguire
-- ============================================================

-- ============================================================
-- SCHEMA
-- ============================================================

CREATE SCHEMA IF NOT EXISTS core;
SET search_path TO core;

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
    CREATE TYPE core.ruolo AS ENUM ('OWNER','ADMIN','OPERATORE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE core.piano_saas AS ENUM ('FREE','PRO','ENTERPRISE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE core.stato_ordine AS ENUM ('IN_ATTESA','IN_PREPARAZIONE','PRONTO','CONSEGNATO','ANNULLATO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE core.stato_subscription AS ENUM ('ATTIVA','SCADUTA','SOSPESA','CANCELLATA');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- TENANTS
-- ============================================================

CREATE TABLE IF NOT EXISTS core.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    piano core.piano_saas DEFAULT 'FREE',
    attivo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    deleted_at TIMESTAMP
);

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS core.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nome TEXT NOT NULL,
    ruolo core.ruolo NOT NULL,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    attivo BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    deleted_at TIMESTAMP
);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS core.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    piano core.piano_saas DEFAULT 'FREE',
    stato core.stato_subscription DEFAULT 'ATTIVA',
    rinnovo_il TIMESTAMP,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS core.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES core.users(id) ON DELETE SET NULL,
    azione TEXT NOT NULL,
    entita TEXT NOT NULL,
    entita_id TEXT,
    meta JSONB,
    created_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- CONFIGURAZIONE COSTI
-- ============================================================

CREATE TABLE IF NOT EXISTS core.configurazione_costi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    costo_impasto NUMERIC NOT NULL,
    costo_energia NUMERIC NOT NULL,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    deleted_at TIMESTAMP
);

-- ============================================================
-- INGREDIENTI
-- ============================================================

CREATE TABLE IF NOT EXISTS core.ingredienti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    costo NUMERIC NOT NULL,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    deleted_at TIMESTAMP
);

-- ============================================================
-- PRODOTTI
-- ============================================================

CREATE TABLE IF NOT EXISTS core.prodotti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    prezzo NUMERIC NOT NULL,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    attivo BOOLEAN DEFAULT true,
    costo_calcolato NUMERIC,
    margine NUMERIC,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    deleted_at TIMESTAMP
);

-- ============================================================
-- PRODOTTO ↔ INGREDIENTE
-- ============================================================

CREATE TABLE IF NOT EXISTS core.prodotto_ingrediente (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    prodotto_id UUID NOT NULL REFERENCES core.prodotti(id) ON DELETE CASCADE,
    ingrediente_id UUID NOT NULL REFERENCES core.ingredienti(id) ON DELETE CASCADE,
    quantita NUMERIC NOT NULL,
    UNIQUE (prodotto_id, ingrediente_id)
);

ALTER TABLE core.prodotto_ingrediente ADD COLUMN IF NOT EXISTS posizione_cottura TEXT NOT NULL DEFAULT 'in_cottura';

-- ============================================================
-- ORDINI
-- ============================================================

CREATE TABLE IF NOT EXISTS core.ordini (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero INTEGER NOT NULL,
    stato core.stato_ordine DEFAULT 'IN_ATTESA',
    totale NUMERIC NOT NULL,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    deleted_at TIMESTAMP,
    UNIQUE (tenant_id, numero)
);

-- ============================================================
-- RIGHE ORDINE
-- ============================================================

CREATE TABLE IF NOT EXISTS core.riga_ordine (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    ordine_id UUID NOT NULL REFERENCES core.ordini(id) ON DELETE CASCADE,
    prodotto_id UUID NOT NULL REFERENCES core.prodotti(id) ON DELETE RESTRICT,
    quantita INTEGER NOT NULL,
    prezzo NUMERIC NOT NULL
);

-- ============================================================
-- AGGIUNGI deleted_at SE MANCA (DB già esistenti / vecchie run)
-- Così gli indici parziali WHERE deleted_at IS NULL funzionano.
-- ============================================================

ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE core.users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE core.configurazione_costi ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE core.ingredienti ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE core.prodotti ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- ============================================================
-- INDICI ENTERPRISE OTTIMIZZATI
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_tenant ON core.users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON core.users(tenant_id, attivo) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ordini_tenant_stato ON core.ordini(tenant_id, stato);
CREATE INDEX IF NOT EXISTS idx_ordini_tenant_created ON core.ordini(tenant_id, created_at);

CREATE INDEX IF NOT EXISTS idx_prodotti_tenant_attivo ON core.prodotti(tenant_id, attivo) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ingredienti_tenant ON core.ingredienti(tenant_id);

CREATE INDEX IF NOT EXISTS idx_riga_ordine_tenant ON core.riga_ordine(tenant_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON core.audit_logs(tenant_id, created_at);

-- ============================================================
-- RLS – ISOLAMENTO MULTI-TENANT
-- ============================================================

ALTER TABLE core.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.prodotti ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.ingredienti ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.ordini ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.riga_ordine ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy generica multi-tenant (esempio su ordini)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'core' AND tablename = 'ordini' AND policyname = 'isolate_by_tenant'
    ) THEN
        CREATE POLICY isolate_by_tenant
        ON core.ordini
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    END IF;
END $$;

-- =============================================================================
-- Archivio dipendenti (HR base multi-tenant)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.staff_archivio_dipendenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo TEXT,
  codice_fiscale TEXT,
  data_nascita DATE,
  luogo_nascita TEXT,
  indirizzo_residenza TEXT,
  telefono_personale TEXT,
  email_personale TEXT,
  mansione TEXT,
  tipo_contratto TEXT,
  data_assunzione DATE,
  iban TEXT,
  foto_url TEXT,
  corsi_formazione JSONB NOT NULL DEFAULT '[]'::jsonb,
  documenti_lavoro JSONB NOT NULL DEFAULT '[]'::jsonb,
  allegati_hr JSONB NOT NULL DEFAULT '[]'::jsonb,
  buste_paga JSONB NOT NULL DEFAULT '[]'::jsonb,
  note_hr TEXT,
  data_cessazione DATE,
  scheda_disabilitata BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT staff_archivio_dipendenti_tenant_user_unique UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_archivio_dipendenti_tenant
  ON public.staff_archivio_dipendenti(tenant_id);

ALTER TABLE public.staff_archivio_dipendenti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_archivio_dipendenti_tenant_all ON public.staff_archivio_dipendenti;
CREATE POLICY staff_archivio_dipendenti_tenant_all ON public.staff_archivio_dipendenti
  FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_archivio_dipendenti TO authenticated;

COMMENT ON TABLE public.staff_archivio_dipendenti IS
  'Archivio dipendenti per tenant: dati anagrafici, contrattuali, corsi e note HR.';

-- Users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'core' AND tablename = 'users' AND policyname = 'isolate_by_tenant'
    ) THEN
        CREATE POLICY isolate_by_tenant
        ON core.users
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    END IF;
END $$;

-- Prodotti
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'core' AND tablename = 'prodotti' AND policyname = 'isolate_by_tenant'
    ) THEN
        CREATE POLICY isolate_by_tenant
        ON core.prodotti
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    END IF;
END $$;

-- Ingredienti
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'core' AND tablename = 'ingredienti' AND policyname = 'isolate_by_tenant'
    ) THEN
        CREATE POLICY isolate_by_tenant
        ON core.ingredienti
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    END IF;
END $$;

-- Riga ordine
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'core' AND tablename = 'riga_ordine' AND policyname = 'isolate_by_tenant'
    ) THEN
        CREATE POLICY isolate_by_tenant
        ON core.riga_ordine
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    END IF;
END $$;

-- Audit logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'core' AND tablename = 'audit_logs' AND policyname = 'isolate_by_tenant'
    ) THEN
        CREATE POLICY isolate_by_tenant
        ON core.audit_logs
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    END IF;
END $$;

-- ============================================================
-- FINE DATABASE
-- ============================================================


-- ============================================================
-- Tabelle per auth frontend: utenti_ruoli (staff) e clienti
-- Collegano auth.users (Supabase Auth) a core.tenants
-- ============================================================

-- Staff: ruoli operativi (superadmin, admin, cassa, bancone, cucina, pizzaiolo, delivery)
CREATE TABLE IF NOT EXISTS public.utenti_ruoli (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    ruolo TEXT NOT NULL,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Clienti: profilo cliente collegato a auth.users
CREATE TABLE IF NOT EXISTS public.clienti (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_utenti_ruoli_tenant ON public.utenti_ruoli(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clienti_tenant ON public.clienti(tenant_id);

-- RLS: utenti possono leggere solo il proprio profilo
ALTER TABLE public.utenti_ruoli ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clienti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "utenti_ruoli_select_own" ON public.utenti_ruoli;
CREATE POLICY "utenti_ruoli_select_own"
    ON public.utenti_ruoli FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "clienti_select_own" ON public.clienti;
CREATE POLICY "clienti_select_own"
    ON public.clienti FOR SELECT
    USING (auth.uid() = id);

-- GRANT: ruolo authenticated deve poter fare SELECT (RLS filtra le righe)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.utenti_ruoli TO authenticated;
GRANT SELECT ON public.clienti TO authenticated;


-- Dati fiscali, pagamento mensile automatico e sconto su core.tenants (idempotente)

DO $$
BEGIN
  IF to_regclass('core.tenants') IS NULL THEN
    RAISE NOTICE 'core.tenants non presente: salta estensione colonne (ambiente diverso).';
    RETURN;
  END IF;

  ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS partita_iva text;
  ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS email_fatturazione text;
  ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS pec text;
  ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS codice_univoco_sdi text;
  ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS addebito_automatico_mensile boolean DEFAULT false;
  ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS data_attivazione_abbonamento date;
  ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS sconto_percentuale numeric(5, 2) DEFAULT 0;

  COMMENT ON COLUMN core.tenants.partita_iva IS 'Partita IVA esercente';
  COMMENT ON COLUMN core.tenants.email_fatturazione IS 'Email aziendale / fatturazione';
  COMMENT ON COLUMN core.tenants.pec IS 'PEC';
  COMMENT ON COLUMN core.tenants.codice_univoco_sdi IS 'Codice destinatario / SDI (fatturazione elettronica)';
  COMMENT ON COLUMN core.tenants.addebito_automatico_mensile IS 'Se true: addebito online automatico a cadenza mensile (es. primo del mese da data attivazione)';
  COMMENT ON COLUMN core.tenants.data_attivazione_abbonamento IS 'Data di riferimento per il ciclo di addebito mensile';
  COMMENT ON COLUMN core.tenants.sconto_percentuale IS 'Sconto concordato sul canone (0–100)';
END $$;


-- Super Admin usa `public.tenants`, che nel dump remoto è una VISTA su `admin.tenants`.
-- La migrazione 20260322120000 aggiungeva le colonne solo su `core.tenants`: PostgREST
-- non le vedeva su `public.tenants` → errore schema cache (es. addebito_automatico_mensile).

DO $$
DECLARE
  relkind "char";
BEGIN
  IF to_regclass('admin.tenants') IS NULL THEN
    RAISE NOTICE 'admin.tenants assente: salta sincronizzazione fatturazione / vista public.tenants.';
    RETURN;
  END IF;

  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS slug text;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS partita_iva text;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS email_fatturazione text;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS pec text;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS codice_univoco_sdi text;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS addebito_automatico_mensile boolean DEFAULT false;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS data_attivazione_abbonamento date;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS sconto_percentuale numeric(5, 2) DEFAULT 0;

  UPDATE admin.tenants t
  SET slug = 'tenant-' || replace(t.id::text, '-', '')
  WHERE t.slug IS NULL OR btrim(t.slug) = '';

  -- Stesso slug su più righe: suffisso deterministico da id (senza alterare la prima riga del gruppo).
  UPDATE admin.tenants t
  SET slug = t.slug || '-' || substr(replace(t.id::text, '-', ''), 1, 8)
  WHERE t.id IN (
    SELECT id FROM (
      SELECT id, row_number() OVER (PARTITION BY slug ORDER BY created_at NULLS LAST, id) AS rn
      FROM admin.tenants
    ) x WHERE rn > 1
  );

  ALTER TABLE admin.tenants ALTER COLUMN slug SET NOT NULL;

  CREATE UNIQUE INDEX IF NOT EXISTS admin_tenants_slug_key ON admin.tenants (slug);

  COMMENT ON COLUMN admin.tenants.partita_iva IS 'Partita IVA esercente';
  COMMENT ON COLUMN admin.tenants.email_fatturazione IS 'Email aziendale / fatturazione';
  COMMENT ON COLUMN admin.tenants.pec IS 'PEC';
  COMMENT ON COLUMN admin.tenants.codice_univoco_sdi IS 'Codice destinatario / SDI (fatturazione elettronica)';
  COMMENT ON COLUMN admin.tenants.addebito_automatico_mensile IS 'Se true: addebito online automatico a cadenza mensile';
  COMMENT ON COLUMN admin.tenants.data_attivazione_abbonamento IS 'Data di riferimento per il ciclo di addebito mensile';
  COMMENT ON COLUMN admin.tenants.sconto_percentuale IS 'Sconto concordato sul canone (0–100)';

  SELECT c.relkind INTO relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'tenants';

  -- CREATE OR REPLACE VIEW non può riallineare colonne se la vista esistente ha ordine/nomi diversi
  -- (es. slug già in posizione 3 in produzione vs dump con solo piano) → 42P16.
  -- Ricreazione completa: DROP + CREATE. CASCADE solo se dipendenze da altre viste (raro su tenants).
  IF relkind = 'r' THEN
    RAISE NOTICE 'public.tenants è una tabella (relkind=r): non ricreare vista; verifica PostgREST.';
  ELSIF relkind = 'v' OR relkind IS NULL THEN
    DROP VIEW IF EXISTS public.tenants CASCADE;

    IF to_regtype('core.piano_saas') IS NOT NULL THEN
      CREATE VIEW public.tenants AS
      SELECT
        id,
        nome,
        slug,
        (
          CASE upper(trim(coalesce(piano::text, '')))
            WHEN 'PRO' THEN 'PRO'::core.piano_saas
            WHEN 'ENTERPRISE' THEN 'ENTERPRISE'::core.piano_saas
            WHEN 'TRIAL' THEN 'FREE'::core.piano_saas
            ELSE 'FREE'::core.piano_saas
          END
        ) AS piano,
        stripe_customer_id,
        stripe_subscription_id,
        attivo,
        created_at,
        updated_at,
        deleted_at,
        partita_iva,
        email_fatturazione,
        pec,
        codice_univoco_sdi,
        addebito_automatico_mensile,
        data_attivazione_abbonamento,
        sconto_percentuale
      FROM admin.tenants;
    ELSE
      CREATE VIEW public.tenants AS
      SELECT
        id,
        nome,
        slug,
        piano,
        stripe_customer_id,
        stripe_subscription_id,
        attivo,
        created_at,
        updated_at,
        deleted_at,
        partita_iva,
        email_fatturazione,
        pec,
        codice_univoco_sdi,
        addebito_automatico_mensile,
        data_attivazione_abbonamento,
        sconto_percentuale
      FROM admin.tenants;
    END IF;

    ALTER VIEW public.tenants OWNER TO postgres;
    GRANT ALL ON TABLE public.tenants TO service_role;
  ELSE
    RAISE NOTICE 'public.tenants relkind=%: salta vista; aggiorna manualmente se necessario.', relkind;
  END IF;
END $$;


-- Colonne usate da Admin (Dati pizzeria, tema menu) e da TenantContext: la vista public.tenants deve esporle.

DO $$
DECLARE
  relkind "char";
BEGIN
  IF to_regclass('admin.tenants') IS NULL THEN
    RAISE NOTICE 'admin.tenants assente: salta colonne operative.';
    RETURN;
  END IF;

  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS logo_url text;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS email text;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS telefono text;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS indirizzo text;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS lat double precision;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS lng double precision;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS parametri_operativi jsonb;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS orari_settimana jsonb;

  SELECT c.relkind INTO relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'tenants';

  IF relkind = 'r' THEN
    RAISE NOTICE 'public.tenants è una tabella: salta ricreazione vista.';
    RETURN;
  END IF;

  IF relkind = 'v' OR relkind IS NULL THEN
    DROP VIEW IF EXISTS public.tenants CASCADE;

    IF to_regtype('core.piano_saas') IS NOT NULL THEN
      CREATE VIEW public.tenants AS
      SELECT
        id,
        nome,
        slug,
        (
          CASE upper(trim(coalesce(piano::text, '')))
            WHEN 'PRO' THEN 'PRO'::core.piano_saas
            WHEN 'ENTERPRISE' THEN 'ENTERPRISE'::core.piano_saas
            WHEN 'TRIAL' THEN 'FREE'::core.piano_saas
            ELSE 'FREE'::core.piano_saas
          END
        ) AS piano,
        stripe_customer_id,
        stripe_subscription_id,
        attivo,
        created_at,
        updated_at,
        deleted_at,
        partita_iva,
        email_fatturazione,
        pec,
        codice_univoco_sdi,
        addebito_automatico_mensile,
        data_attivazione_abbonamento,
        sconto_percentuale,
        logo_url,
        email,
        telefono,
        indirizzo,
        lat,
        lng,
        parametri_operativi,
        orari_settimana
      FROM admin.tenants;
    ELSE
      CREATE VIEW public.tenants AS
      SELECT
        id,
        nome,
        slug,
        piano,
        stripe_customer_id,
        stripe_subscription_id,
        attivo,
        created_at,
        updated_at,
        deleted_at,
        partita_iva,
        email_fatturazione,
        pec,
        codice_univoco_sdi,
        addebito_automatico_mensile,
        data_attivazione_abbonamento,
        sconto_percentuale,
        logo_url,
        email,
        telefono,
        indirizzo,
        lat,
        lng,
        parametri_operativi,
        orari_settimana
      FROM admin.tenants;
    END IF;

    ALTER VIEW public.tenants OWNER TO postgres;
    GRANT ALL ON TABLE public.tenants TO service_role;
  END IF;
END $$;


-- Dopo DROP/CREATE di public.tenants le migrazioni 20260322140000 / 20260322180000
-- concedevano solo a service_role → PostgREST (anon/authenticated) riceve
-- "permission denied for view tenants".
-- Con vista SECURITY INVOKER servono privilegi su public.tenants e sulla base admin.tenants,
-- più USAGE sullo schema admin.

DO $$
BEGIN
  IF to_regclass('admin.tenants') IS NOT NULL THEN
    GRANT USAGE ON SCHEMA admin TO authenticated;
    GRANT USAGE ON SCHEMA admin TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE admin.tenants TO authenticated;
    -- Lettura pubblica limitata in app (es. getPublicTenantInfo): in progetti multi-tenant
    -- valutare RLS su admin.tenants o una vista/rpc dedicata.
    GRANT SELECT ON TABLE admin.tenants TO anon;
  END IF;

  IF to_regclass('public.tenants') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenants TO authenticated;
    GRANT SELECT ON TABLE public.tenants TO anon;
    GRANT ALL ON TABLE public.tenants TO service_role;
  END IF;
END $$;


-- Data di fine periodo di prova (superadmin: gestione clienti TRIAL).

DO $$
DECLARE
  relkind "char";
BEGIN
  IF to_regclass('admin.tenants') IS NULL THEN
    RAISE NOTICE 'admin.tenants assente: salta prova_valida_fino.';
    RETURN;
  END IF;

  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS prova_valida_fino date;
  COMMENT ON COLUMN admin.tenants.prova_valida_fino IS 'Ultimo giorno incluso del periodo di prova; null = non impostato';

  SELECT c.relkind INTO relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'tenants';

  IF relkind = 'r' THEN
    RAISE NOTICE 'public.tenants è una tabella: salta ricreazione vista.';
    RETURN;
  END IF;

  IF relkind = 'v' OR relkind IS NULL THEN
    DROP VIEW IF EXISTS public.tenants CASCADE;

    IF to_regtype('core.piano_saas') IS NOT NULL THEN
      CREATE VIEW public.tenants AS
      SELECT
        id,
        nome,
        slug,
        (
          CASE upper(trim(coalesce(piano::text, '')))
            WHEN 'PRO' THEN 'PRO'::core.piano_saas
            WHEN 'ENTERPRISE' THEN 'ENTERPRISE'::core.piano_saas
            WHEN 'TRIAL' THEN 'FREE'::core.piano_saas
            ELSE 'FREE'::core.piano_saas
          END
        ) AS piano,
        stripe_customer_id,
        stripe_subscription_id,
        attivo,
        created_at,
        updated_at,
        deleted_at,
        partita_iva,
        email_fatturazione,
        pec,
        codice_univoco_sdi,
        addebito_automatico_mensile,
        data_attivazione_abbonamento,
        sconto_percentuale,
        logo_url,
        email,
        telefono,
        indirizzo,
        lat,
        lng,
        parametri_operativi,
        orari_settimana,
        prova_valida_fino
      FROM admin.tenants;
    ELSE
      CREATE VIEW public.tenants AS
      SELECT
        id,
        nome,
        slug,
        piano,
        stripe_customer_id,
        stripe_subscription_id,
        attivo,
        created_at,
        updated_at,
        deleted_at,
        partita_iva,
        email_fatturazione,
        pec,
        codice_univoco_sdi,
        addebito_automatico_mensile,
        data_attivazione_abbonamento,
        sconto_percentuale,
        logo_url,
        email,
        telefono,
        indirizzo,
        lat,
        lng,
        parametri_operativi,
        orari_settimana,
        prova_valida_fino
      FROM admin.tenants;
    END IF;

    ALTER VIEW public.tenants OWNER TO postgres;
    GRANT ALL ON TABLE public.tenants TO service_role;
  END IF;
END $$;

-- Ripristina privilegi PostgREST (DROP VIEW rimuove la vista precedente).
DO $$
BEGIN
  IF to_regclass('admin.tenants') IS NOT NULL THEN
    GRANT USAGE ON SCHEMA admin TO authenticated;
    GRANT USAGE ON SCHEMA admin TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE admin.tenants TO authenticated;
    GRANT SELECT ON TABLE admin.tenants TO anon;
  END IF;

  IF to_regclass('public.tenants') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenants TO authenticated;
    GRANT SELECT ON TABLE public.tenants TO anon;
    GRANT ALL ON TABLE public.tenants TO service_role;
  END IF;
END $$;


-- La vista public.tenants con CASE su `piano` (→ core.piano_saas) NON è aggiornabile automaticamente:
-- UPDATE da app/PostgREST su colonne operative (logo_url, orari, ecc.) falliscono.
-- Vista semplice su admin.tenants (solo riferimenti a colonne) → UPDATE/INSERT consentiti al ruolo con GRANT.

DO $$
DECLARE
  relkind "char";
BEGIN
  IF to_regclass('admin.tenants') IS NULL THEN
    RAISE NOTICE 'admin.tenants assente: salta vista updatable.';
    RETURN;
  END IF;

  SELECT c.relkind INTO relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'tenants';

  IF relkind = 'r' THEN
    RAISE NOTICE 'public.tenants è una tabella: salta.';
    RETURN;
  END IF;

  DROP VIEW IF EXISTS public.tenants CASCADE;

  CREATE VIEW public.tenants AS
  SELECT * FROM admin.tenants;

  ALTER VIEW public.tenants OWNER TO postgres;
  GRANT ALL ON TABLE public.tenants TO service_role;
END $$;

DO $$
BEGIN
  IF to_regclass('admin.tenants') IS NOT NULL THEN
    GRANT USAGE ON SCHEMA admin TO authenticated;
    GRANT USAGE ON SCHEMA admin TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE admin.tenants TO authenticated;
    GRANT SELECT ON TABLE admin.tenants TO anon;
  END IF;

  IF to_regclass('public.tenants') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenants TO authenticated;
    GRANT SELECT ON TABLE public.tenants TO anon;
    GRANT ALL ON TABLE public.tenants TO service_role;
  END IF;
END $$;


-- Dominio pubblico cliente + funzioni per vetrina su hostname dedicato (Firebase + DNS).

DO $$
BEGIN
  IF to_regclass('admin.tenants') IS NULL THEN
    RAISE NOTICE 'admin.tenants assente: salta public_domain.';
    RETURN;
  END IF;

  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS public_domain text;
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS public_domain_status text DEFAULT 'none';
  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS public_domain_requested_at timestamptz;

  COMMENT ON COLUMN admin.tenants.public_domain IS 'Hostname pubblico (es. menu.esempio.it) senza schema; match con window.location.hostname';
  COMMENT ON COLUMN admin.tenants.public_domain_status IS 'none | requested | dns_pending | live (workflow in app)';
  COMMENT ON COLUMN admin.tenants.public_domain_requested_at IS 'Ultima richiesta pubblicazione dominio da admin';

  DROP INDEX IF EXISTS admin_tenants_public_domain_lower_key;
  CREATE UNIQUE INDEX admin_tenants_public_domain_lower_key
    ON admin.tenants (lower(btrim(public_domain)))
    WHERE public_domain IS NOT NULL AND btrim(public_domain) <> '';
END $$;

-- Ricrea vista (SELECT * espone le nuove colonne)
DO $$
DECLARE
  relkind "char";
BEGIN
  IF to_regclass('admin.tenants') IS NULL THEN
    RETURN;
  END IF;

  SELECT c.relkind INTO relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'tenants';

  IF relkind = 'r' THEN
    RAISE NOTICE 'public.tenants è una tabella: salta ricreazione vista.';
    RETURN;
  END IF;

  DROP VIEW IF EXISTS public.tenants CASCADE;

  CREATE VIEW public.tenants AS
  SELECT * FROM admin.tenants;

  ALTER VIEW public.tenants OWNER TO postgres;
  GRANT ALL ON TABLE public.tenants TO service_role;
END $$;

DO $$
BEGIN
  IF to_regclass('admin.tenants') IS NOT NULL THEN
    GRANT USAGE ON SCHEMA admin TO authenticated;
    GRANT USAGE ON SCHEMA admin TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE admin.tenants TO authenticated;
    GRANT SELECT ON TABLE admin.tenants TO anon;
  END IF;

  IF to_regclass('public.tenants') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenants TO authenticated;
    GRANT SELECT ON TABLE public.tenants TO anon;
    GRANT ALL ON TABLE public.tenants TO service_role;
  END IF;
END $$;

-- Risolve tenant pubblico in base all'hostname (nessun JWT richiesto)
CREATE OR REPLACE FUNCTION public.resolve_public_tenant_by_domain(p_host text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, admin
AS $$
  SELECT to_jsonb(t)
  FROM (
    SELECT
      id,
      nome,
      logo_url,
      indirizzo,
      email,
      telefono,
      orari_settimana,
      parametri_operativi
    FROM admin.tenants
    WHERE deleted_at IS NULL
      AND (attivo IS NULL OR attivo = true)
      AND (
        (
          public_domain IS NOT NULL
          AND btrim(public_domain) <> ''
          AND lower(btrim(public_domain)) = lower(btrim(p_host))
        )
        OR (
          lower(btrim(p_host)) LIKE '%.pizzamanager.it'
          AND lower(btrim(slug)) = lower(split_part(btrim(p_host), '.', 1))
        )
      )
    LIMIT 1
  ) t;
$$;

COMMENT ON FUNCTION public.resolve_public_tenant_by_domain(text) IS 'Menu pubblico: risolve tenant da hostname (dominio cliente collegato in admin.tenants.public_domain).';

GRANT EXECUTE ON FUNCTION public.resolve_public_tenant_by_domain(text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_public_tenant_by_domain(text) TO authenticated;

-- Menu filtrato per tenant risolto dal dominio (stesso schema della vista prodotti_menu_pubblico)
CREATE OR REPLACE FUNCTION public.get_public_menu_for_domain(p_host text)
RETURNS SETOF public.prodotti_menu_pubblico
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, admin, core
AS $$
  SELECT v.*
  FROM public.prodotti_menu_pubblico v
  WHERE v.tenant_id = (
    SELECT t.id
    FROM admin.tenants t
    WHERE t.deleted_at IS NULL
      AND (t.attivo IS NULL OR t.attivo = true)
      AND (
        (
          t.public_domain IS NOT NULL
          AND btrim(t.public_domain) <> ''
          AND lower(btrim(t.public_domain)) = lower(btrim(p_host))
        )
        OR (
          lower(btrim(p_host)) LIKE '%.pizzamanager.it'
          AND lower(btrim(t.slug)) = lower(split_part(btrim(p_host), '.', 1))
        )
      )
    LIMIT 1
  );
$$;

COMMENT ON FUNCTION public.get_public_menu_for_domain(text) IS 'Menu pubblico filtrato per tenant associato a public_domain (hostname).';

GRANT EXECUTE ON FUNCTION public.get_public_menu_for_domain(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_menu_for_domain(text) TO authenticated;

-- Menu per tenant su piattaforma SaaS (stessa riga-set della vista; anon usa EXECUTE invece di SELECT sulla vista)
CREATE OR REPLACE FUNCTION public.get_public_menu_for_tenant(p_tenant_id UUID)
RETURNS SETOF public.prodotti_menu_pubblico
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, core
AS $$
  SELECT v.*
  FROM public.prodotti_menu_pubblico v
  WHERE p_tenant_id IS NOT NULL
    AND v.tenant_id = p_tenant_id;
$$;

COMMENT ON FUNCTION public.get_public_menu_for_tenant(UUID) IS
  'Menu pubblico filtrato per tenant (anteprima /negozio /preview, ?tenant=). SECURITY DEFINER: necessario dopo REVOKE SELECT anon su public.prodotti_menu_pubblico.';

GRANT EXECUTE ON FUNCTION public.get_public_menu_for_tenant(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_menu_for_tenant(UUID) TO authenticated;

-- Categorie catalogo admin (core.categorie) per vetrina: allinea tab al nome/ordine reali anche se categoria_nome nel menu è assente
CREATE OR REPLACE FUNCTION public.get_public_categories_for_tenant(p_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  nome TEXT,
  ordine INT,
  slug TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, core
AS $$
  SELECT c.id, c.nome, c.ordine, c.slug
  FROM core.categorie c
  WHERE p_tenant_id IS NOT NULL
    AND c.tenant_id = p_tenant_id
    AND (c.attivo IS NULL OR c.attivo = true)
  ORDER BY c.ordine ASC NULLS LAST, lower(c.nome) ASC;
$$;

COMMENT ON FUNCTION public.get_public_categories_for_tenant(UUID) IS
  'Vetrina: categorie tenant da core.categorie (come admin). SECURITY DEFINER; anon non legge la view categorie.';

GRANT EXECUTE ON FUNCTION public.get_public_categories_for_tenant(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_categories_for_tenant(UUID) TO authenticated;

-- Ingredienti ricetta per ricerca menu vetrina (anon); solo prodotti coerenti con prodotti_menu_pubblico
CREATE OR REPLACE FUNCTION public.get_public_menu_ingredient_names(
  p_tenant_id UUID,
  p_product_ids UUID[]
)
RETURNS TABLE (
  prodotto_id UUID,
  nomi TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, core
AS $$
  SELECT
    pi.prodotto_id,
    coalesce(
      array_agg(btrim(i.nome) ORDER BY lower(btrim(i.nome)))
        FILTER (WHERE i.nome IS NOT NULL AND btrim(i.nome) <> ''),
      '{}'::text[]
    ) AS nomi
  FROM core.prodotto_ingrediente pi
  INNER JOIN core.ingredienti i
    ON i.id = pi.ingrediente_id
   AND i.tenant_id = pi.tenant_id
  INNER JOIN core.prodotti p
    ON p.id = pi.prodotto_id
   AND p.tenant_id = pi.tenant_id
  WHERE pi.tenant_id = p_tenant_id
    AND p_product_ids IS NOT NULL
    AND cardinality(p_product_ids) >= 1
    AND pi.prodotto_id = ANY(p_product_ids)
    AND p.deleted_at IS NULL
    AND (p.attivo = true OR p.attivo IS NULL)
    AND (p.visibile_online = true OR p.visibile_online IS NULL)
    AND i.deleted_at IS NULL
  GROUP BY pi.prodotto_id;
$$;

COMMENT ON FUNCTION public.get_public_menu_ingredient_names(UUID, UUID[]) IS
  'Vetrina pubblica: elenco nomi ingredienti per prodotti del menu online del tenant. SECURITY DEFINER; allineato ai filtri di public.prodotti_menu_pubblico.';

GRANT EXECUTE ON FUNCTION public.get_public_menu_ingredient_names(UUID, UUID[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_menu_ingredient_names(UUID, UUID[]) TO authenticated;

-- URL del sito vetrina del cliente (es. Google Sites, sito istituzionale) — separato dal dominio PizzaManager.

DO $$
BEGIN
  IF to_regclass('admin.tenants') IS NULL THEN
    RAISE NOTICE 'admin.tenants assente: salta sito_web_cliente.';
    RETURN;
  END IF;

  ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS sito_web_cliente text;
  COMMENT ON COLUMN admin.tenants.sito_web_cliente IS 'URL completo del sito web del cliente (marketing, Google Sites, ecc.); non è usato per la risoluzione tenant';
END $$;

DO $$
DECLARE
  relkind "char";
BEGIN
  IF to_regclass('admin.tenants') IS NULL THEN
    RETURN;
  END IF;

  SELECT c.relkind INTO relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'tenants';

  IF relkind = 'r' THEN
    RAISE NOTICE 'public.tenants è una tabella: salta ricreazione vista.';
    RETURN;
  END IF;

  DROP VIEW IF EXISTS public.tenants CASCADE;

  CREATE VIEW public.tenants AS
  SELECT * FROM admin.tenants;

  ALTER VIEW public.tenants OWNER TO postgres;
  GRANT ALL ON TABLE public.tenants TO service_role;
END $$;

DO $$
BEGIN
  IF to_regclass('admin.tenants') IS NOT NULL THEN
    GRANT USAGE ON SCHEMA admin TO authenticated;
    GRANT USAGE ON SCHEMA admin TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE admin.tenants TO authenticated;
    GRANT SELECT ON TABLE admin.tenants TO anon;
  END IF;

  IF to_regclass('public.tenants') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenants TO authenticated;
    GRANT SELECT ON TABLE public.tenants TO anon;
    GRANT ALL ON TABLE public.tenants TO service_role;
  END IF;
END $$;


-- =============================================================================
-- PizzaManager — SQL incrementale unificato (idempotente)
--
-- PM-SQL-REF: UNIFIED-INCR-v1-2026-03-22
-- PM-SQL-FP:   E7A4C91B2D804E6F9A1C5E8B3F0D2A74
--
-- Uso: database già inizializzato (es. dopo schema bootstrap). Esegui in
-- Supabase → SQL Editor. Non sostituisce sql/schema_completo_pizzamanager.sql.
--
-- Contiene: visibile_online, viste public, colonne accesso aree, GRANT anon,
--           pattern RLS/policy idempotenti dove applicabile.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1) core.prodotti — visibilità menu online
-- -----------------------------------------------------------------------------
ALTER TABLE core.prodotti ADD COLUMN IF NOT EXISTS visibile_online BOOLEAN DEFAULT true;
ALTER TABLE core.prodotti ADD COLUMN IF NOT EXISTS prep_cucina BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN core.prodotti.prep_cucina IS
  'Se true, la schermata Cucina mostra un task di preparazione per ogni riga ordine (fritti, bibite, dolci, ecc.).';


-- -----------------------------------------------------------------------------
-- 2) Vista public."Prodotto" (client app / autenticati)
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public."Prodotto" CASCADE;
CREATE VIEW public."Prodotto" AS
  SELECT
    id,
    nome,
    descrizione,
    prezzo,
    attivo,
    ordine,
    immagine_url,
    visibile_online,
    prep_cucina,
    tenant_id,
    categoria_id,
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    deleted_at AS "deletedAt"
  FROM core.prodotti
  WHERE tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
    UNION
    SELECT rr.tenant_id FROM core.rider rr
    WHERE rr.auth_user_id = auth.uid()
      AND COALESCE(rr.attivo, true) IS NOT FALSE
      AND rr.deleted_at IS NULL
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public."Prodotto" TO authenticated;


-- -----------------------------------------------------------------------------
-- 3) Vista prodotti_menu_pubblico (anon + nome categoria)
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.prodotti_menu_pubblico CASCADE;
CREATE VIEW public.prodotti_menu_pubblico AS
  SELECT
    p.id,
    p.nome,
    p.descrizione,
    p.prezzo,
    p.attivo,
    p.ordine,
    p.immagine_url,
    p.visibile_online,
    p.tenant_id,
    p.categoria_id,
    cat.nome AS categoria_nome,
    p.created_at AS "createdAt",
    p.updated_at AS "updatedAt",
    p.deleted_at AS "deletedAt"
  FROM core.prodotti p
  LEFT JOIN core.categorie cat
    ON cat.id = p.categoria_id
   AND cat.tenant_id = p.tenant_id
  WHERE p.deleted_at IS NULL
    AND (p.attivo = true OR p.attivo IS NULL)
    AND (p.visibile_online = true OR p.visibile_online IS NULL);

REVOKE SELECT ON public.prodotti_menu_pubblico FROM anon;
GRANT SELECT ON public.prodotti_menu_pubblico TO authenticated;


-- -----------------------------------------------------------------------------
-- 4) public.utenti_ruoli — permessi aree operative (Admin → Ruoli)
-- -----------------------------------------------------------------------------
ALTER TABLE public.utenti_ruoli
  ADD COLUMN IF NOT EXISTS accesso_riepilogo BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS accesso_cassa BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS accesso_cucina BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS accesso_bancone BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS accesso_pizzaiolo BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS accesso_delivery BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS accesso_pony BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.utenti_ruoli.accesso_riepilogo IS 'Area operativa Riepilogo';
COMMENT ON COLUMN public.utenti_ruoli.accesso_cassa IS 'Area Cassa';
COMMENT ON COLUMN public.utenti_ruoli.accesso_cucina IS 'Area Cucina';
COMMENT ON COLUMN public.utenti_ruoli.accesso_bancone IS 'Area Bancone';
COMMENT ON COLUMN public.utenti_ruoli.accesso_pizzaiolo IS 'Area Pizzaioli';
COMMENT ON COLUMN public.utenti_ruoli.accesso_delivery IS 'Area Delivery';
COMMENT ON COLUMN public.utenti_ruoli.accesso_pony IS 'Area Pony (stesso reparto Delivery)';

ALTER TABLE public.utenti_ruoli
  ADD COLUMN IF NOT EXISTS nome_visualizzato TEXT;

COMMENT ON COLUMN public.utenti_ruoli.nome_visualizzato IS
  'Nome o etichetta del dipendente in sede (es. Anna), distinto dall’account email; usabile per turni e report.';

-- -----------------------------------------------------------------------------
-- 5) Vista ruoli_pizzeria
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.ruoli_pizzeria CASCADE;

CREATE VIEW public.ruoli_pizzeria AS
SELECT
  ur.user_id,
  ur.ruolo,
  ur.tenant_id,
  ur.puo_modificare_parametri,
  ur.attivo,
  ur.accesso_riepilogo,
  ur.accesso_cassa,
  ur.accesso_cucina,
  ur.accesso_bancone,
  ur.accesso_pizzaiolo,
  ur.accesso_delivery,
  ur.accesso_pony,
  ur.nome_visualizzato,
  u.email
FROM public.utenti_ruoli ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.tenant_id IN (
  SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
);

GRANT SELECT ON public.ruoli_pizzeria TO authenticated;
GRANT UPDATE ON public.utenti_ruoli TO authenticated;


-- -----------------------------------------------------------------------------
-- 6) GRANT schema public / letture anon minime (menu via RPC tenant-aware)
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.tenants TO anon;
GRANT SELECT ON public."Prodotto" TO anon;
GRANT SELECT ON public.punti_vendita TO anon;
REVOKE SELECT ON public.prodotti_menu_pubblico FROM anon;
GRANT SELECT ON public.prodotti_menu_pubblico TO authenticated;


-- -----------------------------------------------------------------------------
-- 7) RLS — attivazione idempotente (senza sovrascrivere policy esistenti)
-- -----------------------------------------------------------------------------
ALTER TABLE public.utenti_ruoli ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clienti ENABLE ROW LEVEL SECURITY;

-- Pattern per nuove policy (idempotente): sempre DROP POLICY IF EXISTS + CREATE POLICY.
-- Esempio:
--   DROP POLICY IF EXISTS "nome_policy" ON public.utenti_ruoli;
--   CREATE POLICY "nome_policy" ON public.utenti_ruoli FOR ... TO authenticated USING (...);
--
-- Le policy complete (anche con public.tenant_admins) sono in
-- sql/schema_completo_pizzamanager.sql — non duplicarle qui se il DB è già allineato.


-- -----------------------------------------------------------------------------
-- 8) OPZIONALE — superadmin in utenti_ruoli (sostituisci UUID e tenant)
-- -----------------------------------------------------------------------------
-- INSERT INTO public.utenti_ruoli (user_id, ruolo, tenant_id, attivo)
-- VALUES (
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   'superadmin',
--   (SELECT id FROM core.tenants ORDER BY created_at NULLS LAST LIMIT 1),
--   true
-- )
-- ON CONFLICT (user_id) DO UPDATE SET
--   ruolo = EXCLUDED.ruolo,
--   tenant_id = EXCLUDED.tenant_id,
--   attivo = true;

-- =============================================================================
-- Fine PM-SQL-REF: UNIFIED-INCR-v1-2026-03-22
-- =============================================================================

-- <<< END: supabase/migrations/20260402100000_pizzamanager_unified_incremental.sql

-- >>> BEGIN: supabase/migrations/20260403130000_staff_password_note_tenant_admin.sql
-- Nota password accesso dipendenti: solo tenant admin (tenant_admins), non leggibile dagli altri utenti.
-- Non è la password reale in auth.users: è un archivio opzionale che il titolare aggiorna quando crea/resetta l’accesso.

CREATE TABLE IF NOT EXISTS public.staff_password_note (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES core.tenants (id) ON DELETE CASCADE,
  password_nota TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_password_note_tenant ON public.staff_password_note (tenant_id);

ALTER TABLE public.staff_password_note ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_password_note_tenant_admin_all" ON public.staff_password_note;

CREATE POLICY "staff_password_note_tenant_admin_all" ON public.staff_password_note
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tenant_admins ta
      WHERE ta.user_id = auth.uid()
        AND ta.tenant_id = staff_password_note.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tenant_admins ta
      WHERE ta.user_id = auth.uid()
        AND ta.tenant_id = staff_password_note.tenant_id
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_password_note TO authenticated;

COMMENT ON TABLE public.staff_password_note IS 'Nota password accesso staff (solo admin tenant). Non sincronizzata con GoTrue; RLS: solo tenant_admins.';

-- <<< END: supabase/migrations/20260403130000_staff_password_note_tenant_admin.sql

-- >>> BEGIN: supabase/migrations/20260403150000_clienti_auth_trigger_and_columns.sql
-- Colonne profilo su public.clienti + trigger dopo INSERT su auth.users
-- (registrazione cliente da sito pizzeria con user_metadata.tenant_id).

ALTER TABLE public.clienti
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS indirizzo TEXT,
  ADD COLUMN IF NOT EXISTS telefono TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_meta JSONB;
  v_nome TEXT;
  v_indirizzo TEXT;
  v_telefono TEXT;
  v_email TEXT;
BEGIN
  v_meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_nome := NULLIF(trim(COALESCE(v_meta->>'nome', v_meta->>'full_name', '')), '');
  v_indirizzo := NULLIF(trim(COALESCE(v_meta->>'indirizzo', '')), '');
  v_telefono := NULLIF(trim(COALESCE(v_meta->>'telefono', v_meta->>'phone', '')), '');
  v_email := NULLIF(trim(COALESCE(NEW.email, '')), '');

  BEGIN
    v_tenant_id := (v_meta->>'tenant_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_tenant_id := NULL;
  END;

  IF v_tenant_id IS NULL AND to_regclass('public.anagrafica_clienti') IS NOT NULL AND v_nome IS NOT NULL THEN
    SELECT ac.tenant_id INTO v_tenant_id
    FROM public.anagrafica_clienti ac
    WHERE trim(lower(ac.nome)) = trim(lower(v_nome))
      AND trim(lower(COALESCE(ac.indirizzo, ''))) = trim(lower(COALESCE(v_indirizzo, '')))
      AND trim(COALESCE(ac.telefono, '')) = trim(COALESCE(v_telefono, ''))
    LIMIT 1;
  END IF;

  IF v_tenant_id IS NOT NULL THEN
    INSERT INTO public.clienti (id, tenant_id, nome, indirizzo, telefono, email)
    VALUES (NEW.id, v_tenant_id, v_nome, v_indirizzo, v_telefono, v_email)
    ON CONFLICT (id) DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      nome = COALESCE(EXCLUDED.nome, clienti.nome),
      indirizzo = COALESCE(EXCLUDED.indirizzo, clienti.indirizzo),
      telefono = COALESCE(EXCLUDED.telefono, clienti.telefono),
      email = COALESCE(EXCLUDED.email, clienti.email);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

COMMENT ON FUNCTION public.handle_new_auth_user() IS 'Crea/aggiorna public.clienti da raw_user_meta_data (tenant_id, nome, …) o match anagrafica_clienti se esiste.';

-- <<< END: supabase/migrations/20260403150000_clienti_auth_trigger_and_columns.sql

-- >>> BEGIN: supabase/migrations/20260404120000_staff_password_superadmin_ruoli_pizzeria.sql
-- Super Admin: lettura ruoli di qualsiasi tenant (vista ruoli_pizzeria) e gestione staff_password_note.
-- Il Super Admin è identificato da public.utenti_ruoli (ruolo = 'superadmin', attivo).

-- -----------------------------------------------------------------------------
-- 1) Vista ruoli_pizzeria: include tutte le righe se l'utente corrente è superadmin
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.ruoli_pizzeria CASCADE;

CREATE VIEW public.ruoli_pizzeria AS
SELECT
  ur.user_id,
  ur.ruolo,
  ur.tenant_id,
  ur.puo_modificare_parametri,
  ur.attivo,
  ur.accesso_riepilogo,
  ur.accesso_cassa,
  ur.accesso_cucina,
  ur.accesso_bancone,
  ur.accesso_pizzaiolo,
  ur.accesso_delivery,
  ur.accesso_pony,
  ur.nome_visualizzato,
  u.email
FROM public.utenti_ruoli ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.tenant_id IN (
  SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
)
OR EXISTS (
  SELECT 1
  FROM public.utenti_ruoli ur_sa
  WHERE ur_sa.user_id = auth.uid()
    AND COALESCE(ur_sa.attivo, true) IS DISTINCT FROM false
    AND lower(trim(ur_sa.ruolo)) = 'superadmin'
);

GRANT SELECT ON public.ruoli_pizzeria TO authenticated;

-- -----------------------------------------------------------------------------
-- 2) staff_password_note: tenant_admins oppure superadmin (qualsiasi tenant)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "staff_password_note_tenant_admin_all" ON public.staff_password_note;

CREATE POLICY "staff_password_note_tenant_admin_all" ON public.staff_password_note
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tenant_admins ta
      WHERE ta.user_id = auth.uid()
        AND ta.tenant_id = staff_password_note.tenant_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur_sa
      WHERE ur_sa.user_id = auth.uid()
        AND COALESCE(ur_sa.attivo, true) IS DISTINCT FROM false
        AND lower(trim(ur_sa.ruolo)) = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tenant_admins ta
      WHERE ta.user_id = auth.uid()
        AND ta.tenant_id = staff_password_note.tenant_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur_sa
      WHERE ur_sa.user_id = auth.uid()
        AND COALESCE(ur_sa.attivo, true) IS DISTINCT FROM false
        AND lower(trim(ur_sa.ruolo)) = 'superadmin'
    )
  );

COMMENT ON TABLE public.staff_password_note IS 'Nota password accesso staff (archivio titolare). RLS: tenant_admins del tenant o utente con ruolo superadmin in utenti_ruoli.';

-- <<< END: supabase/migrations/20260404120000_staff_password_superadmin_ruoli_pizzeria.sql

-- >>> BEGIN: sql/PM_LATEST_IMPLEMENTATIONS.sql
-- =============================================================================
-- PizzaManager — Ultime implementazioni SQL (consolidato)
-- Data riferimento: 2026-04 (agg. replace_order_items + note dipendenti 2026-04-11)
--
-- Contenuto (idempotente dove possibile):
--   1) public.staff_password_note — archivio note password staff (Admin Ruoli)
--   2) RLS staff_password_note — tenant_admins OPPURE superadmin (utenti_ruoli)
--   3) Vista public.ruoli_pizzeria — superadmin vede tutti i tenant
--   4) subscriptions — ciclo_fatturazione_giorni + sconto_annuale_percent (public e/o core)
--   5) core.ordini — colonne cassa / ordine cliente (note, pagamento, tipo, ritiro…)
--   6) core.riga_ordine — formato_nome, ingredienti_cottura_summary (comanda / cassa)
--   7) public.create_order_with_items — RPC allineata a adminService (Supabase JS)
--   8) public.replace_order_items — sostituisce righe ordine (modifica cassa; adminService.replaceOrderItems)
--
-- App (senza DDL qui): Admin Magazzino/Contabilità usa ancora localStorage per tenant;
--   parametri_operativi (JSON su tenants) — comanda / cassa (CassaImpostazioniPage + printComanda.js):
--   comanda_copie, comanda_font_size (px 8–28), comanda_titolo_scale, comanda_qty_scale,
--   comanda_dettaglio_scale, comanda_line_height, comanda_margin_mm, comanda_width_mm,
--   comanda_font_family (system|sans|mono|serif), comanda_mostra_id_ordine, comanda_mostra_pagamento,
--   comanda_mostra_dest_stampanti, comanda_stampanti[], comanda_stampa_auto;
--   più ritiro_ogni_min, pizze_ogni_15_min, consegne_ogni_min, …
--
-- Prerequisiti tipici: public.utenti_ruoli, public.tenant_admins, auth.users,
--   core.tenants (FK su staff_password_note). Esegui su Supabase (SQL Editor) o CLI.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1–2) Tabella + RLS staff_password_note (admin tenant + superadmin piattaforma)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_password_note (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES core.tenants (id) ON DELETE CASCADE,
  password_nota TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_password_note_tenant ON public.staff_password_note (tenant_id);

ALTER TABLE public.staff_password_note ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_password_note_tenant_admin_all" ON public.staff_password_note;

CREATE POLICY "staff_password_note_tenant_admin_all" ON public.staff_password_note
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tenant_admins ta
      WHERE ta.user_id = auth.uid()
        AND ta.tenant_id = staff_password_note.tenant_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur_sa
      WHERE ur_sa.user_id = auth.uid()
        AND COALESCE(ur_sa.attivo, true) IS DISTINCT FROM false
        AND lower(trim(ur_sa.ruolo)) = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tenant_admins ta
      WHERE ta.user_id = auth.uid()
        AND ta.tenant_id = staff_password_note.tenant_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur_sa
      WHERE ur_sa.user_id = auth.uid()
        AND COALESCE(ur_sa.attivo, true) IS DISTINCT FROM false
        AND lower(trim(ur_sa.ruolo)) = 'superadmin'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_password_note TO authenticated;

COMMENT ON TABLE public.staff_password_note IS
  'Nota password accesso staff (archivio titolare). RLS: tenant_admins del tenant o superadmin (utenti_ruoli). Non è la password Auth.';

-- -----------------------------------------------------------------------------
-- 3) Vista ruoli_pizzeria: superadmin vede tutti gli staff; altri solo il proprio tenant
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.ruoli_pizzeria CASCADE;

CREATE VIEW public.ruoli_pizzeria AS
SELECT
  ur.user_id,
  ur.ruolo,
  ur.tenant_id,
  ur.puo_modificare_parametri,
  ur.attivo,
  ur.accesso_riepilogo,
  ur.accesso_cassa,
  ur.accesso_cucina,
  ur.accesso_bancone,
  ur.accesso_pizzaiolo,
  ur.accesso_delivery,
  ur.accesso_pony,
  ur.nome_visualizzato,
  u.email
FROM public.utenti_ruoli ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.tenant_id IN (
  SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
)
OR EXISTS (
  SELECT 1
  FROM public.utenti_ruoli ur_sa
  WHERE ur_sa.user_id = auth.uid()
    AND COALESCE(ur_sa.attivo, true) IS DISTINCT FROM false
    AND lower(trim(ur_sa.ruolo)) = 'superadmin'
);

GRANT SELECT ON public.ruoli_pizzeria TO authenticated;

-- -----------------------------------------------------------------------------
-- 4) Abbonamenti: ciclo (codice 30/365 = mesi di calendario in app) + sconto annuale %
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    ALTER TABLE public.subscriptions
      ADD COLUMN IF NOT EXISTS ciclo_fatturazione_giorni INTEGER NOT NULL DEFAULT 30;
    ALTER TABLE public.subscriptions
      ADD COLUMN IF NOT EXISTS sconto_annuale_percent NUMERIC(5,2);
    COMMENT ON COLUMN public.subscriptions.ciclo_fatturazione_giorni IS
      'Codice ciclo: 30 = 1 mese di calendario, 365 = 12 mesi di calendario (non giorni fissi).';
    COMMENT ON COLUMN public.subscriptions.sconto_annuale_percent IS
      'Sconto % sul totale 12 mensilità se ciclo annuale; NULL se mensile.';
  END IF;

  IF to_regclass('core.subscriptions') IS NOT NULL THEN
    ALTER TABLE core.subscriptions
      ADD COLUMN IF NOT EXISTS ciclo_fatturazione_giorni INTEGER NOT NULL DEFAULT 30;
    ALTER TABLE core.subscriptions
      ADD COLUMN IF NOT EXISTS sconto_annuale_percent NUMERIC(5,2);
    COMMENT ON COLUMN core.subscriptions.ciclo_fatturazione_giorni IS
      'Codice ciclo: 30 = 1 mese di calendario, 365 = 12 mesi di calendario (non giorni fissi).';
    COMMENT ON COLUMN core.subscriptions.sconto_annuale_percent IS
      'Sconto % sul totale 12 mensilità se ciclo annuale; NULL se mensile.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 5–6) Ordini e righe: campi usati da Cassa (createOrder) e stampa comanda
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('core.ordini') IS NOT NULL THEN
    ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS note TEXT;
    ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS tipo_pagamento TEXT;
    ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS tipo_ordine TEXT;
    ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS nome_cliente TEXT;
    ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS orario_ritiro TEXT;
    ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS indirizzo_consegna TEXT;
    COMMENT ON COLUMN core.ordini.tipo_ordine IS 'es. negozio | delivery (cassa / clienti).';
    COMMENT ON COLUMN core.ordini.orario_ritiro IS 'Fascia oraria ritiro/consegna scelta in cassa.';
  END IF;

  IF to_regclass('core.riga_ordine') IS NOT NULL THEN
    ALTER TABLE core.riga_ordine ADD COLUMN IF NOT EXISTS formato_nome TEXT;
    ALTER TABLE core.riga_ordine ADD COLUMN IF NOT EXISTS ingredienti_cottura_summary TEXT;
    COMMENT ON COLUMN core.riga_ordine.ingredienti_cottura_summary IS 'Testo riepilogo modifiche ingredienti/cottura per cucina e comanda.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 7) RPC create_order_with_items (firma allineata a src/features/admin/services/adminService.js)
--     Rimuove overload public/core preesistenti con lo stesso nome, poi crea public.
-- -----------------------------------------------------------------------------
DO $drop$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT format(
      '%I.%I(%s)',
      ns.nspname,
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid)
    ) AS sig
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace ns ON ns.oid = p.pronamespace
    WHERE p.proname = 'create_order_with_items'
      AND ns.nspname IN ('public', 'core')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END
$drop$;

CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_tenant_id UUID,
  p_totale NUMERIC,
  p_stato TEXT DEFAULT 'IN_PREPARAZIONE',
  p_items JSONB DEFAULT '[]'::JSONB,
  p_note TEXT DEFAULT NULL,
  p_tipo_pagamento TEXT DEFAULT NULL,
  p_tipo_ordine TEXT DEFAULT NULL,
  p_nome_cliente TEXT DEFAULT NULL,
  p_orario_ritiro TEXT DEFAULT NULL,
  p_indirizzo_consegna TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $fn$
DECLARE
  v_ordine_id UUID;
  v_numero INTEGER;
  v_item JSONB;
  v_stato core.stato_ordine;
BEGIN
  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_numero
  FROM core.ordini
  WHERE tenant_id = p_tenant_id;

  BEGIN
    v_stato := COALESCE(NULLIF(trim(p_stato), ''), 'IN_PREPARAZIONE')::core.stato_ordine;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_stato := 'IN_PREPARAZIONE'::core.stato_ordine;
  END;

  INSERT INTO core.ordini (
    tenant_id,
    numero,
    stato,
    totale,
    note,
    tipo_pagamento,
    tipo_ordine,
    nome_cliente,
    orario_ritiro,
    indirizzo_consegna
  )
  VALUES (
    p_tenant_id,
    v_numero,
    v_stato,
    p_totale,
    NULLIF(trim(COALESCE(p_note, '')), ''),
    NULLIF(trim(COALESCE(p_tipo_pagamento, '')), ''),
    NULLIF(trim(COALESCE(p_tipo_ordine, '')), ''),
    NULLIF(trim(COALESCE(p_nome_cliente, '')), ''),
    NULLIF(trim(COALESCE(p_orario_ritiro, '')), ''),
    NULLIF(trim(COALESCE(p_indirizzo_consegna, '')), '')
  )
  RETURNING id INTO v_ordine_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::JSONB))
  LOOP
    INSERT INTO core.riga_ordine (
      tenant_id,
      ordine_id,
      prodotto_id,
      quantita,
      prezzo,
      formato_nome,
      ingredienti_cottura_summary
    )
    VALUES (
      p_tenant_id,
      v_ordine_id,
      (v_item->>'prodotto_id')::UUID,
      GREATEST(1, COALESCE((v_item->>'quantita')::INTEGER, 1)),
      COALESCE((v_item->>'prezzo')::NUMERIC, 0),
      NULLIF(trim(COALESCE(v_item->>'formato_nome', '')), ''),
      NULLIF(trim(COALESCE(v_item->>'ingredienti_cottura_summary', '')), '')
    );
  END LOOP;

  RETURN v_ordine_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

COMMENT ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) IS
  'Crea ordine + righe (cassa). p_items: prodotto_id, quantita, prezzo, formato_nome, ingredienti_cottura_summary.';

-- -----------------------------------------------------------------------------
-- 7b) public.replace_order_items — modifica righe ordine dalla cassa
--     Allineata a sql/sql_upgrade.sql e src/features/admin/services/adminService.js (replaceOrderItems).
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.replace_order_items(UUID, NUMERIC, JSONB);

CREATE OR REPLACE FUNCTION public.replace_order_items(
  p_ordine_id UUID,
  p_totale NUMERIC,
  p_items JSONB DEFAULT '[]'::JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, admin
AS $rep$
DECLARE
  v_tenant_id UUID;
  v_stato core.stato_ordine;
  v_item JSONB;
  v_is_staff_cassa BOOLEAN;
  v_pid UUID;
BEGIN
  IF p_ordine_id IS NULL THEN
    RAISE EXCEPTION 'ordine_id_obbligatorio';
  END IF;

  SELECT o.tenant_id, o.stato INTO v_tenant_id, v_stato
  FROM core.ordini o
  WHERE o.id = p_ordine_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'ordine_non_trovato';
  END IF;

  IF v_stato = 'ANNULLATO'::core.stato_ordine THEN
    RAISE EXCEPTION 'ordine_annullato_non_modificabile';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = v_tenant_id
      AND COALESCE(ur.attivo, true) = true
      AND (
        lower(trim(COALESCE(ur.ruolo, ''))) = 'cassa'
        OR COALESCE(ur.accesso_cassa, false) = true
      )
  ) INTO v_is_staff_cassa;

  IF NOT v_is_staff_cassa THEN
    RAISE EXCEPTION 'non_autorizzato';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'almeno_una_riga';
  END IF;

  DELETE FROM core.riga_ordine
  WHERE ordine_id = p_ordine_id
    AND tenant_id = v_tenant_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_pid := NULL;
    BEGIN
      v_pid := (v_item->>'prodotto_id')::UUID;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'prodotto_id_non_valido';
    END;

    IF v_pid IS NULL THEN
      RAISE EXCEPTION 'prodotto_id_obbligatorio';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM core.prodotti p
      WHERE p.id = v_pid
        AND p.tenant_id = v_tenant_id
    ) THEN
      RAISE EXCEPTION 'prodotto_non_valido';
    END IF;

    INSERT INTO core.riga_ordine (
      tenant_id,
      ordine_id,
      prodotto_id,
      quantita,
      prezzo,
      formato_nome,
      ingredienti_cottura_summary
    )
    VALUES (
      v_tenant_id,
      p_ordine_id,
      v_pid,
      GREATEST(1, COALESCE((v_item->>'quantita')::INTEGER, 1)),
      COALESCE((v_item->>'prezzo')::NUMERIC, 0),
      NULLIF(
        trim(COALESCE(v_item->>'formato_nome', v_item->>'formatoNome', '')),
        ''
      ),
      NULLIF(
        trim(
          COALESCE(
            v_item->>'ingredienti_cottura_summary',
            v_item->>'ingredientiCotturaSummary',
            ''
          )
        ),
        ''
      )
    );
  END LOOP;

  UPDATE core.ordini
  SET
    totale = p_totale,
    updated_at = now(),
    cucina_prep_stato = '{}'::jsonb
  WHERE id = p_ordine_id
    AND tenant_id = v_tenant_id;
END;
$rep$;

GRANT EXECUTE ON FUNCTION public.replace_order_items(UUID, NUMERIC, JSONB) TO authenticated;

COMMENT ON FUNCTION public.replace_order_items(UUID, NUMERIC, JSONB) IS
  'Cassa: sostituisce righe ordine, ricalcola totale, azzera cucina_prep_stato (nuovi id riga).';

-- <<< END: sql/PM_LATEST_IMPLEMENTATIONS.sql

-- >>> BEGIN: sql/PM_FIDELITY_IMPLEMENTATIONS_UNIFIED.sql
-- =============================================================================
-- PizzaManager — Fidelity Card + canale domicilio
--
-- Contenuto:
--   1) Tabelle public.fidelity_saldi, public.fidelity_movimenti + RLS + GRANT
--   2) Colonna fidelity_saldi.nome_negozio (alias bancone)
--   3) Default opzionali in core.tenants.parametri_operativi:
--        consegna_domicilio_attiva, fidelity_abilita_clienti_domicilio
--
-- Altre chiavi fidelity (solo JSON, nessuna colonna DB): fidelity_nome_programma,
-- fidelity_punti_per_euro, fidelity_attivo, fidelity_timbri_per_pizza,
-- fidelity_timbri_scheda_totale, fidelity_premi, fidelity_card_* (tema tessera).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Tabelle fidelity
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fidelity_saldi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  anagrafica_cliente_id UUID NOT NULL REFERENCES public.anagrafica_clienti(id) ON DELETE CASCADE,
  punti INT NOT NULL DEFAULT 0,
  codice_carta TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fidelity_saldi_tenant_cliente_unique UNIQUE (tenant_id, anagrafica_cliente_id),
  CONSTRAINT fidelity_saldi_tenant_codice_unique UNIQUE (tenant_id, codice_carta),
  CONSTRAINT fidelity_saldi_punti_non_neg CHECK (punti >= 0)
);

CREATE INDEX IF NOT EXISTS idx_fidelity_saldi_tenant ON public.fidelity_saldi(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fidelity_saldi_anagrafica ON public.fidelity_saldi(anagrafica_cliente_id);

CREATE TABLE IF NOT EXISTS public.fidelity_movimenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  anagrafica_cliente_id UUID NOT NULL REFERENCES public.anagrafica_clienti(id) ON DELETE CASCADE,
  punti INT NOT NULL,
  tipo TEXT NOT NULL,
  ordine_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fidelity_movimenti_tenant_cliente
  ON public.fidelity_movimenti(tenant_id, anagrafica_cliente_id, created_at DESC);

ALTER TABLE public.fidelity_saldi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fidelity_movimenti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fidelity_saldi_staff_all" ON public.fidelity_saldi;
CREATE POLICY "fidelity_saldi_staff_all" ON public.fidelity_saldi
  FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "fidelity_movimenti_staff_all" ON public.fidelity_movimenti;
DROP POLICY IF EXISTS "fidelity_movimenti_staff_select" ON public.fidelity_movimenti;
DROP POLICY IF EXISTS "fidelity_movimenti_staff_insert" ON public.fidelity_movimenti;
CREATE POLICY "fidelity_movimenti_staff_select" ON public.fidelity_movimenti
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );
CREATE POLICY "fidelity_movimenti_staff_insert" ON public.fidelity_movimenti
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fidelity_saldi TO authenticated;
GRANT SELECT, INSERT ON public.fidelity_movimenti TO authenticated;

COMMENT ON TABLE public.fidelity_saldi IS 'Punti fidelity per cliente anagrafica (cassa); codice_carta univoco per tenant.';
COMMENT ON TABLE public.fidelity_movimenti IS 'Storico variazioni punti (manuale, ordine, ecc.).';

-- -----------------------------------------------------------------------------
-- 2) Alias nome in negozio (bancone)
-- -----------------------------------------------------------------------------
ALTER TABLE public.fidelity_saldi
  ADD COLUMN IF NOT EXISTS nome_negozio TEXT;

COMMENT ON COLUMN public.fidelity_saldi.nome_negozio IS
  'Nome come lo chiami in negozio (bancone); opzionale, affiancato al codice carta.';

-- -----------------------------------------------------------------------------
-- 3) Parametri tenant: consegna + fidelity domicilio (default espliciti nel JSON)
-- -----------------------------------------------------------------------------
UPDATE core.tenants t
SET parametri_operativi =
  COALESCE(t.parametri_operativi, '{}'::jsonb)
  || jsonb_build_object(
    'consegna_domicilio_attiva',
    CASE
      WHEN COALESCE(t.parametri_operativi, '{}'::jsonb) ? 'consegna_domicilio_attiva'
        THEN (COALESCE(t.parametri_operativi, '{}'::jsonb)->>'consegna_domicilio_attiva')::boolean
      ELSE true
    END,
    'fidelity_abilita_clienti_domicilio',
    CASE
      WHEN COALESCE(t.parametri_operativi, '{}'::jsonb) ? 'fidelity_abilita_clienti_domicilio'
        THEN (COALESCE(t.parametri_operativi, '{}'::jsonb)->>'fidelity_abilita_clienti_domicilio')::boolean
      ELSE true
    END
  );

-- =============================================================================
-- Fine. Dopo l'esecuzione: Dashboard Supabase → Settings → API → Reload schema
--   se PostgREST non espone subito tabelle/colonne nuove.
-- =============================================================================

-- <<< END: sql/PM_FIDELITY_IMPLEMENTATIONS_UNIFIED.sql
-- ---------- END: supabase/migrations/20260406100000_post_remote_schema_unified.sql ----------

-- ---------- BEGIN: supabase/migrations/20260406110000_delivery_area_polygon.sql ----------
-- =============================================================================
-- Area di consegna: poligono in parametri_operativi.consegna_area_poligono (GeoJSON Polygon)
-- Verifica in create_order_with_items: clienti (non staff cassa) bloccati fuori area;
-- utenti con ruolo cassa o accesso_cassa sul tenant possono ordinare anche fuori / senza coordinate.
-- Esegui DOPO 20260406100000_post_remote_schema_unified.sql (sostituisce la RPC con +2 argomenti).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pm_point_in_ring(
  p_lng double precision,
  p_lat double precision,
  p_ring jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $ring$
DECLARE
  n int;
  i int;
  j int;
  xi double precision;
  yi double precision;
  xj double precision;
  yj double precision;
  inside boolean := false;
BEGIN
  IF p_ring IS NULL OR jsonb_typeof(p_ring) <> 'array' THEN
    RETURN NULL;
  END IF;

  n := jsonb_array_length(p_ring);
  IF n < 4 THEN
    RETURN NULL;
  END IF;

  IF (p_ring->0->>0)::double precision = (p_ring->(n - 1)->>0)::double precision
     AND (p_ring->0->>1)::double precision = (p_ring->(n - 1)->>1)::double precision THEN
    n := n - 1;
  END IF;

  IF n < 3 THEN
    RETURN NULL;
  END IF;

  FOR i IN 0..(n - 1) LOOP
    j := (i + 1) % n;
    xi := (p_ring->i->>0)::double precision;
    yi := (p_ring->i->>1)::double precision;
    xj := (p_ring->j->>0)::double precision;
    yj := (p_ring->j->>1)::double precision;
    IF (yi > p_lat) <> (yj > p_lat) THEN
      IF p_lng < (xj - xi) * (p_lat - yi) / NULLIF(yj - yi, 0) + xi THEN
        inside := NOT inside;
      END IF;
    END IF;
  END LOOP;

  RETURN inside;
END;
$ring$;

COMMENT ON FUNCTION public.pm_point_in_ring(double precision, double precision, jsonb) IS
  'Ray casting: punto [lng,lat] dentro anello poligonale GeoJSON (primo anello, senza buchi).';

DO $drop$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT format(
      '%I.%I(%s)',
      ns.nspname,
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid)
    ) AS sig
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace ns ON ns.oid = p.pronamespace
    WHERE p.proname = 'create_order_with_items'
      AND ns.nspname IN ('public', 'core')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END
$drop$;

CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_tenant_id UUID,
  p_totale NUMERIC,
  p_stato TEXT DEFAULT 'IN_PREPARAZIONE',
  p_items JSONB DEFAULT '[]'::JSONB,
  p_note TEXT DEFAULT NULL,
  p_tipo_pagamento TEXT DEFAULT NULL,
  p_tipo_ordine TEXT DEFAULT NULL,
  p_nome_cliente TEXT DEFAULT NULL,
  p_orario_ritiro TEXT DEFAULT NULL,
  p_indirizzo_consegna TEXT DEFAULT NULL,
  p_consegna_lng DOUBLE PRECISION DEFAULT NULL,
  p_consegna_lat DOUBLE PRECISION DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, admin
AS $fn$
DECLARE
  v_ordine_id UUID;
  v_numero INTEGER;
  v_item JSONB;
  v_stato core.stato_ordine;
  v_po jsonb;
  v_ring jsonb;
  v_inside boolean;
  v_is_staff_cassa boolean;
BEGIN
  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_numero
  FROM core.ordini
  WHERE tenant_id = p_tenant_id;

  BEGIN
    v_stato := COALESCE(NULLIF(trim(p_stato), ''), 'IN_PREPARAZIONE')::core.stato_ordine;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_stato := 'IN_PREPARAZIONE'::core.stato_ordine;
  END;

  SELECT t.parametri_operativi INTO v_po
  FROM admin.tenants t
  WHERE t.id = p_tenant_id
  LIMIT 1;

  v_ring := NULL;
  IF v_po IS NOT NULL
     AND (v_po->'consegna_area_poligono'->>'type') = 'Polygon'
     AND jsonb_typeof(v_po->'consegna_area_poligono'->'coordinates') = 'array'
     AND jsonb_array_length(v_po->'consegna_area_poligono'->'coordinates') >= 1
  THEN
    v_ring := v_po->'consegna_area_poligono'->'coordinates'->0;
  END IF;

  IF lower(trim(COALESCE(p_tipo_ordine, ''))) = 'delivery'
     AND v_ring IS NOT NULL
     AND jsonb_typeof(v_ring) = 'array'
     AND jsonb_array_length(v_ring) >= 4
  THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = p_tenant_id
        AND COALESCE(ur.attivo, true) = true
        AND (
          lower(trim(COALESCE(ur.ruolo, ''))) = 'cassa'
          OR COALESCE(ur.accesso_cassa, false) = true
        )
    ) INTO v_is_staff_cassa;

    IF NOT v_is_staff_cassa THEN
      IF p_consegna_lng IS NULL OR p_consegna_lat IS NULL THEN
        RAISE EXCEPTION 'Per la consegna a domicilio servono coordinate valide dell''indirizzo (verifica su mappa).';
      END IF;

      v_inside := public.pm_point_in_ring(p_consegna_lng, p_consegna_lat, v_ring);
      IF v_inside IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'L''indirizzo di consegna è fuori dall''area coperta dal locale.';
      END IF;
    END IF;
  END IF;

  INSERT INTO core.ordini (
    tenant_id,
    numero,
    stato,
    totale,
    note,
    tipo_pagamento,
    tipo_ordine,
    nome_cliente,
    orario_ritiro,
    indirizzo_consegna
  )
  VALUES (
    p_tenant_id,
    v_numero,
    v_stato,
    p_totale,
    NULLIF(trim(COALESCE(p_note, '')), ''),
    NULLIF(trim(COALESCE(p_tipo_pagamento, '')), ''),
    NULLIF(trim(COALESCE(p_tipo_ordine, '')), ''),
    NULLIF(trim(COALESCE(p_nome_cliente, '')), ''),
    NULLIF(trim(COALESCE(p_orario_ritiro, '')), ''),
    NULLIF(trim(COALESCE(p_indirizzo_consegna, '')), '')
  )
  RETURNING id INTO v_ordine_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::JSONB))
  LOOP
    INSERT INTO core.riga_ordine (
      tenant_id,
      ordine_id,
      prodotto_id,
      quantita,
      prezzo,
      formato_nome,
      ingredienti_cottura_summary
    )
    VALUES (
      p_tenant_id,
      v_ordine_id,
      (v_item->>'prodotto_id')::UUID,
      GREATEST(1, COALESCE((v_item->>'quantita')::INTEGER, 1)),
      COALESCE((v_item->>'prezzo')::NUMERIC, 0),
      NULLIF(trim(COALESCE(v_item->>'formato_nome', '')), ''),
      NULLIF(trim(COALESCE(v_item->>'ingredienti_cottura_summary', '')), '')
    );
  END LOOP;

  RETURN v_ordine_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION
) TO authenticated;

COMMENT ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION
) IS
  'Crea ordine + righe. Delivery + poligono in parametri_operativi: clienti devono passare p_consegna_lng/lat dentro area; staff cassa esentato.';
-- ---------- END: supabase/migrations/20260406110000_delivery_area_polygon.sql ----------

-- ---------- BEGIN: supabase/migrations/20260406115500_turni_operatori_base_if_missing.sql ----------
-- Base tabella turni cassa (se il dump remote_schema non è mai stato applicato).
-- Eseguire prima di 20260406120000_cassa_turni_rpc.sql.

CREATE SEQUENCE IF NOT EXISTS public.turni_operatori_id_seq
  AS integer
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

ALTER SEQUENCE public.turni_operatori_id_seq OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.turni_operatori (
  id integer NOT NULL DEFAULT nextval('public.turni_operatori_id_seq'::regclass),
  user_id uuid,
  tenant_id uuid NOT NULL,
  punto_vendita_id uuid,
  stato text NOT NULL DEFAULT 'aperto'::text,
  aperto_il timestamp with time zone DEFAULT now(),
  chiuso_il timestamp with time zone,
  azienda_id uuid,
  fondo_contato_euro numeric(12, 2),
  incasso_atteso_euro numeric(12, 2),
  delta_euro numeric(12, 2),
  note_chiusura text,
  CONSTRAINT turni_operatori_stato_check CHECK ((stato = ANY (ARRAY['aperto'::text, 'chiuso'::text])))
);

ALTER TABLE ONLY public.turni_operatori OWNER TO postgres;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'turni_operatori_pkey' AND conrelid = 'public.turni_operatori'::regclass
  ) THEN
    ALTER TABLE ONLY public.turni_operatori ADD CONSTRAINT turni_operatori_pkey PRIMARY KEY (id);
  END IF;
END $$;

ALTER SEQUENCE public.turni_operatori_id_seq OWNED BY public.turni_operatori.id;

CREATE INDEX IF NOT EXISTS idx_turni_operatori_tenant_id ON public.turni_operatori USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_turni_user ON public.turni_operatori USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_turni_operatori_azienda ON public.turni_operatori USING btree (azienda_id);

CREATE UNIQUE INDEX IF NOT EXISTS unico_turno_aperto_per_operatore
  ON public.turni_operatori USING btree (user_id, tenant_id)
  WHERE ((stato = 'aperto'::text) AND (chiuso_il IS NULL));

-- FK opzionali (solo se le tabelle referenziate esistono)
DO $$
BEGIN
  IF to_regclass('core.tenants') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'turni_operatori_tenant_id_fkey') THEN
    ALTER TABLE public.turni_operatori
      ADD CONSTRAINT turni_operatori_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES core.tenants (id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'turni_operatori_user_id_fkey') THEN
    ALTER TABLE public.turni_operatori
      ADD CONSTRAINT turni_operatori_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;
END $$;

-- FK verso punti_vendita solo se è tabella base (relkind 'r'): su alcuni DB è una VIEW → niente FK.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'punti_vendita'
      AND c.relkind = 'r'
  )
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'turni_operatori_punto_vendita_id_fkey') THEN
    ALTER TABLE public.turni_operatori
      ADD CONSTRAINT turni_operatori_punto_vendita_id_fkey
      FOREIGN KEY (punto_vendita_id) REFERENCES public.punti_vendita (id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'aziende'
      AND c.relkind = 'r'
  )
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'turni_operatori_azienda_fkey') THEN
    ALTER TABLE public.turni_operatori
      ADD CONSTRAINT turni_operatori_azienda_fkey
      FOREIGN KEY (azienda_id) REFERENCES public.aziende (id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.turni_operatori ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.turni_operatori TO postgres;
GRANT ALL ON SEQUENCE public.turni_operatori_id_seq TO postgres;
GRANT ALL ON TABLE public.turni_operatori TO service_role;
GRANT ALL ON SEQUENCE public.turni_operatori_id_seq TO service_role;
-- ---------- END: supabase/migrations/20260406115500_turni_operatori_base_if_missing.sql ----------

-- ---------- BEGIN: supabase/migrations/20260406120000_cassa_turni_rpc.sql ----------
-- Turni cassa: RPC SECURITY DEFINER (staff tenant) + colonne riconciliazione chiusura.
-- Richiede public.turni_operatori, public.utenti_ruoli, public.punti_vendita.

ALTER TABLE public.turni_operatori
  ADD COLUMN IF NOT EXISTS fondo_contato_euro numeric(12, 2),
  ADD COLUMN IF NOT EXISTS incasso_atteso_euro numeric(12, 2),
  ADD COLUMN IF NOT EXISTS delta_euro numeric(12, 2),
  ADD COLUMN IF NOT EXISTS note_chiusura text;

COMMENT ON COLUMN public.turni_operatori.fondo_contato_euro IS 'Conteggio cassa alla chiusura (riconciliazione).';
COMMENT ON COLUMN public.turni_operatori.incasso_atteso_euro IS 'Incasso atteso (es. da sistema) al momento della chiusura.';
COMMENT ON COLUMN public.turni_operatori.delta_euro IS 'fondo_contato - incasso_atteso (se entrambi valorizzati).';
COMMENT ON COLUMN public.turni_operatori.note_chiusura IS 'Note operatore in chiusura turno.';

CREATE OR REPLACE FUNCTION public._turni_cassa_assert_staff(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND (ur.attivo IS DISTINCT FROM false)
  ) THEN
    RAISE EXCEPTION 'tenant_forbidden' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.turni_cassa_aperto(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
BEGIN
  PERFORM public._turni_cassa_assert_staff(p_tenant_id);

  SELECT jsonb_build_object(
    'id', t.id,
    'punto_vendita_id', t.punto_vendita_id,
    'stato', t.stato,
    'aperto_il', t.aperto_il,
    'chiuso_il', t.chiuso_il,
    'fondo_contato_euro', t.fondo_contato_euro,
    'incasso_atteso_euro', t.incasso_atteso_euro,
    'delta_euro', t.delta_euro,
    'note_chiusura', t.note_chiusura
  )
  INTO r
  FROM public.turni_operatori t
  WHERE t.user_id = auth.uid()
    AND t.tenant_id = p_tenant_id
    AND t.stato = 'aperto'
    AND t.chiuso_il IS NULL
  ORDER BY t.aperto_il DESC NULLS LAST
  LIMIT 1;

  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.turni_cassa_apri(p_tenant_id uuid, p_punto_vendita_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  existing_pv uuid;
  v_new_id integer;
BEGIN
  PERFORM public._turni_cassa_assert_staff(p_tenant_id);

  IF p_punto_vendita_id IS NULL THEN
    RAISE EXCEPTION 'punto_vendita_obbligatorio' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.punti_vendita pv
    WHERE pv.id = p_punto_vendita_id
      AND pv.tenant_id = p_tenant_id
      AND pv.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'punto_vendita_non_valido' USING ERRCODE = 'P0001';
  END IF;

  SELECT t.punto_vendita_id
  INTO existing_pv
  FROM public.turni_operatori t
  WHERE t.user_id = auth.uid()
    AND t.tenant_id = p_tenant_id
    AND t.stato = 'aperto'
    AND t.chiuso_il IS NULL
  LIMIT 1;

  IF FOUND THEN
    IF existing_pv IS DISTINCT FROM p_punto_vendita_id THEN
      RAISE EXCEPTION 'turno_aperto_altro_pv' USING ERRCODE = 'P0001';
    END IF;

    SELECT jsonb_build_object(
      'id', t.id,
      'punto_vendita_id', t.punto_vendita_id,
      'stato', t.stato,
      'aperto_il', t.aperto_il,
      'chiuso_il', t.chiuso_il,
      'gia_aperto', true
    )
    INTO r
    FROM public.turni_operatori t
    WHERE t.user_id = auth.uid()
      AND t.tenant_id = p_tenant_id
      AND t.stato = 'aperto'
      AND t.chiuso_il IS NULL
    LIMIT 1;

    RETURN r;
  END IF;

  INSERT INTO public.turni_operatori (user_id, tenant_id, punto_vendita_id, stato, aperto_il)
  VALUES (auth.uid(), p_tenant_id, p_punto_vendita_id, 'aperto', now())
  RETURNING id INTO v_new_id;

  SELECT jsonb_build_object(
    'id', t.id,
    'punto_vendita_id', t.punto_vendita_id,
    'stato', t.stato,
    'aperto_il', t.aperto_il,
    'chiuso_il', t.chiuso_il,
    'gia_aperto', false
  )
  INTO r
  FROM public.turni_operatori t
  WHERE t.id = v_new_id;

  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.turni_cassa_chiudi(
  p_tenant_id uuid,
  p_fondo_contato_euro numeric,
  p_incasso_atteso_euro numeric DEFAULT NULL,
  p_note_chiusura text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id integer;
  v_delta numeric(12, 2);
BEGIN
  PERFORM public._turni_cassa_assert_staff(p_tenant_id);

  IF p_fondo_contato_euro IS NULL THEN
    RAISE EXCEPTION 'fondo_contato_obbligatorio' USING ERRCODE = 'P0001';
  END IF;

  SELECT t.id
  INTO v_id
  FROM public.turni_operatori t
  WHERE t.user_id = auth.uid()
    AND t.tenant_id = p_tenant_id
    AND t.stato = 'aperto'
    AND t.chiuso_il IS NULL
  ORDER BY t.aperto_il DESC NULLS LAST
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'nessun_turno_aperto' USING ERRCODE = 'P0001';
  END IF;

  v_delta := CASE
    WHEN p_incasso_atteso_euro IS NULL THEN NULL
    ELSE round(p_fondo_contato_euro - p_incasso_atteso_euro, 2)
  END;

  UPDATE public.turni_operatori t
  SET
    stato = 'chiuso',
    chiuso_il = now(),
    fondo_contato_euro = p_fondo_contato_euro,
    incasso_atteso_euro = p_incasso_atteso_euro,
    delta_euro = v_delta,
    note_chiusura = NULLIF(trim(p_note_chiusura), '')
  WHERE t.id = v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'chiuso', true,
    'fondo_contato_euro', p_fondo_contato_euro,
    'incasso_atteso_euro', p_incasso_atteso_euro,
    'delta_euro', v_delta
  );
END;
$$;

ALTER FUNCTION public._turni_cassa_assert_staff(uuid) OWNER TO postgres;
ALTER FUNCTION public.turni_cassa_aperto(uuid) OWNER TO postgres;
ALTER FUNCTION public.turni_cassa_apri(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.turni_cassa_chiudi(uuid, numeric, numeric, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public._turni_cassa_assert_staff(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.turni_cassa_aperto(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.turni_cassa_apri(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.turni_cassa_chiudi(uuid, numeric, numeric, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.turni_cassa_aperto(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.turni_cassa_apri(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.turni_cassa_chiudi(uuid, numeric, numeric, text) TO authenticated;
-- ---------- END: supabase/migrations/20260406120000_cassa_turni_rpc.sql ----------

-- ---------- BEGIN: supabase/migrations/20260406140000_ordine_turno_operatori.sql ----------
-- Ordine: colonna turno_operatori_id + create_order_with_items(..., p_turno_operatori_id) + vista public."Ordine".
-- Richiede core.ordini, public.turni_operatori (opzionale per FK), moduli allineati: 03/04/05.

DO $e$
BEGIN
  IF to_regclass('core.ordini') IS NULL THEN
    RAISE NOTICE 'core.ordini assente: salto turno_operatori_id.';
    RETURN;
  END IF;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS turno_operatori_id INTEGER;
  COMMENT ON COLUMN core.ordini.turno_operatori_id IS 'Turno cassa aperto (public.turni_operatori.id) al momento dell''ordine; null per ordini web o senza turno.';
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'turni_operatori'
      AND c.relkind = 'r'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'ordini_turno_operatori_id_fkey'
    ) THEN
      ALTER TABLE core.ordini
        ADD CONSTRAINT ordini_turno_operatori_id_fkey
        FOREIGN KEY (turno_operatori_id) REFERENCES public.turni_operatori (id) ON DELETE SET NULL;
    END IF;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END
$e$;


-- =============================================================================
-- 5) pm_point_in_ring + create_order_with_items (poligono + PV + pagamento misto)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pm_point_in_ring(
  p_lng double precision,
  p_lat double precision,
  p_ring jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $ring$
DECLARE
  n int;
  i int;
  j int;
  xi double precision;
  yi double precision;
  xj double precision;
  yj double precision;
  inside boolean := false;
BEGIN
  IF p_ring IS NULL OR jsonb_typeof(p_ring) <> 'array' THEN
    RETURN NULL;
  END IF;

  n := jsonb_array_length(p_ring);
  IF n < 4 THEN
    RETURN NULL;
  END IF;

  IF (p_ring->0->>0)::double precision = (p_ring->(n - 1)->>0)::double precision
     AND (p_ring->0->>1)::double precision = (p_ring->(n - 1)->>1)::double precision THEN
    n := n - 1;
  END IF;

  IF n < 3 THEN
    RETURN NULL;
  END IF;

  FOR i IN 0..(n - 1) LOOP
    j := (i + 1) % n;
    xi := (p_ring->i->>0)::double precision;
    yi := (p_ring->i->>1)::double precision;
    xj := (p_ring->j->>0)::double precision;
    yj := (p_ring->j->>1)::double precision;
    IF (yi > p_lat) <> (yj > p_lat) THEN
      IF p_lng < (xj - xi) * (p_lat - yi) / NULLIF(yj - yi, 0) + xi THEN
        inside := NOT inside;
      END IF;
    END IF;
  END LOOP;

  RETURN inside;
END;
$ring$;

COMMENT ON FUNCTION public.pm_point_in_ring(double precision, double precision, jsonb) IS
  'Ray casting: punto [lng,lat] dentro anello poligonale GeoJSON (primo anello).';

DO $drop$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT format(
      '%I.%I(%s)',
      ns.nspname,
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid)
    ) AS sig
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace ns ON ns.oid = p.pronamespace
    WHERE p.proname = 'create_order_with_items'
      AND ns.nspname IN ('public', 'core')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END
$drop$;

CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_tenant_id UUID,
  p_totale NUMERIC,
  p_stato TEXT DEFAULT 'IN_PREPARAZIONE',
  p_items JSONB DEFAULT '[]'::JSONB,
  p_note TEXT DEFAULT NULL,
  p_tipo_pagamento TEXT DEFAULT NULL,
  p_tipo_ordine TEXT DEFAULT NULL,
  p_nome_cliente TEXT DEFAULT NULL,
  p_orario_ritiro TEXT DEFAULT NULL,
  p_indirizzo_consegna TEXT DEFAULT NULL,
  p_consegna_lng DOUBLE PRECISION DEFAULT NULL,
  p_consegna_lat DOUBLE PRECISION DEFAULT NULL,
  p_pagamento_dettaglio JSONB DEFAULT NULL,
  p_punto_vendita_id UUID DEFAULT NULL,
  p_turno_operatori_id INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, admin
AS $fn$
DECLARE
  v_ordine_id UUID;
  v_numero INTEGER;
  v_item JSONB;
  v_stato core.stato_ordine;
  v_po jsonb;
  v_ring jsonb;
  v_inside boolean;
  v_is_staff_cassa boolean;
  v_turno_pv uuid;
BEGIN
  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_numero
  FROM core.ordini
  WHERE tenant_id = p_tenant_id;

  BEGIN
    v_stato := COALESCE(NULLIF(trim(p_stato), ''), 'IN_PREPARAZIONE')::core.stato_ordine;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_stato := 'IN_PREPARAZIONE'::core.stato_ordine;
  END;

  v_po := NULL;
  IF to_regclass('admin.tenants') IS NOT NULL THEN
    SELECT t.parametri_operativi INTO v_po
    FROM admin.tenants t
    WHERE t.id = p_tenant_id
    LIMIT 1;
  END IF;
  IF v_po IS NULL AND to_regclass('core.tenants') IS NOT NULL THEN
    SELECT t.parametri_operativi INTO v_po
    FROM core.tenants t
    WHERE t.id = p_tenant_id
    LIMIT 1;
  END IF;

  v_ring := NULL;
  IF v_po IS NOT NULL
     AND (v_po->'consegna_area_poligono'->>'type') = 'Polygon'
     AND jsonb_typeof(v_po->'consegna_area_poligono'->'coordinates') = 'array'
     AND jsonb_array_length(v_po->'consegna_area_poligono'->'coordinates') >= 1
  THEN
    v_ring := v_po->'consegna_area_poligono'->'coordinates'->0;
  END IF;

  IF lower(trim(COALESCE(p_tipo_ordine, ''))) = 'delivery'
     AND v_ring IS NOT NULL
     AND jsonb_typeof(v_ring) = 'array'
     AND jsonb_array_length(v_ring) >= 4
  THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = p_tenant_id
        AND COALESCE(ur.attivo, true) = true
        AND (
          lower(trim(COALESCE(ur.ruolo, ''))) = 'cassa'
          OR COALESCE(ur.accesso_cassa, false) = true
        )
    ) INTO v_is_staff_cassa;

    IF NOT v_is_staff_cassa THEN
      IF p_consegna_lng IS NULL OR p_consegna_lat IS NULL THEN
        RAISE EXCEPTION 'Per la consegna a domicilio servono coordinate valide dell''indirizzo (verifica su mappa).';
      END IF;

      v_inside := public.pm_point_in_ring(p_consegna_lng, p_consegna_lat, v_ring);
      IF v_inside IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'L''indirizzo di consegna ÃƒÂ¨ fuori dall''area coperta dal locale.';
      END IF;
    END IF;
  END IF;

  IF p_turno_operatori_id IS NOT NULL THEN
    IF to_regclass('public.turni_operatori') IS NULL THEN
      RAISE EXCEPTION 'turni_operatori non disponibile sul database';
    END IF;
    SELECT t.punto_vendita_id INTO v_turno_pv
    FROM public.turni_operatori t
    WHERE t.id = p_turno_operatori_id
      AND t.tenant_id = p_tenant_id
      AND t.user_id = auth.uid()
      AND t.stato = 'aperto'
      AND t.chiuso_il IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'turno_non_valido';
    END IF;
    IF p_punto_vendita_id IS NOT NULL AND v_turno_pv IS DISTINCT FROM p_punto_vendita_id THEN
      RAISE EXCEPTION 'turno_punto_vendita_mismatch';
    END IF;
  END IF;

  INSERT INTO core.ordini (
    tenant_id,
    numero,
    stato,
    totale,
    note,
    tipo_pagamento,
    tipo_ordine,
    nome_cliente,
    orario_ritiro,
    indirizzo_consegna,
    consegna_lng,
    consegna_lat,
    pagamento_dettaglio,
    punto_vendita_id,
    turno_operatori_id
  )
  VALUES (
    p_tenant_id,
    v_numero,
    v_stato,
    p_totale,
    NULLIF(trim(COALESCE(p_note, '')), ''),
    NULLIF(trim(COALESCE(p_tipo_pagamento, '')), ''),
    NULLIF(trim(COALESCE(p_tipo_ordine, '')), ''),
    NULLIF(trim(COALESCE(p_nome_cliente, '')), ''),
    NULLIF(trim(COALESCE(p_orario_ritiro, '')), ''),
    NULLIF(trim(COALESCE(p_indirizzo_consegna, '')), ''),
    p_consegna_lng,
    p_consegna_lat,
    p_pagamento_dettaglio,
    p_punto_vendita_id,
    p_turno_operatori_id
  )
  RETURNING id INTO v_ordine_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::JSONB))
  LOOP
    INSERT INTO core.riga_ordine (
      tenant_id,
      ordine_id,
      prodotto_id,
      quantita,
      prezzo,
      formato_nome,
      ingredienti_cottura_summary
    )
    VALUES (
      p_tenant_id,
      v_ordine_id,
      (v_item->>'prodotto_id')::UUID,
      GREATEST(1, COALESCE((v_item->>'quantita')::INTEGER, 1)),
      COALESCE((v_item->>'prezzo')::NUMERIC, 0),
      NULLIF(trim(COALESCE(v_item->>'formato_nome', '')), ''),
      NULLIF(trim(COALESCE(v_item->>'ingredienti_cottura_summary', '')), '')
    );
  END LOOP;

  RETURN v_ordine_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, JSONB, UUID, INTEGER
) TO authenticated;

COMMENT ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, JSONB, UUID, INTEGER
) IS
  'Crea ordine + righe. Delivery+poligono: clienti con lng/lat in area; staff cassa esentato. Opzionale pagamento_dettaglio JSONB, punto_vendita_id, turno_operatori_id (turno aperto cassa).';



-- =============================================================================
-- 4) Vista public."Ordine" + INSTEAD OF UPDATE
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ordine_instead_of_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $tr$
BEGIN
  UPDATE core.ordini
  SET
    stato              = COALESCE(NEW.stato, OLD.stato),
    totale             = COALESCE(NEW.totale, OLD.totale),
    note               = COALESCE(NEW.note, OLD.note),
    tipo_pagamento     = COALESCE(NEW.tipo_pagamento, OLD.tipo_pagamento),
    tipo_ordine        = COALESCE(NEW.tipo_ordine, OLD.tipo_ordine),
    nome_cliente       = NEW.nome_cliente,
    orario_ritiro      = NEW.orario_ritiro,
    indirizzo_consegna = NEW.indirizzo_consegna,
    consegna_lng       = COALESCE(NEW.consegna_lng, OLD.consegna_lng),
    consegna_lat       = COALESCE(NEW.consegna_lat, OLD.consegna_lat),
    pagamento_dettaglio = COALESCE(NEW.pagamento_dettaglio, OLD.pagamento_dettaglio),
    stato_consegna     = COALESCE(NEW.stato_consegna, OLD.stato_consegna),
    punto_vendita_id   = COALESCE(NEW.punto_vendita_id, OLD.punto_vendita_id),
    turno_operatori_id = COALESCE(NEW.turno_operatori_id, OLD.turno_operatori_id),
    updated_at         = now()
  WHERE id = OLD.id
    AND tenant_id IN (
      SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
      UNION
      SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
      UNION
      SELECT rr.tenant_id FROM core.rider rr
      WHERE rr.auth_user_id = auth.uid()
        AND COALESCE(rr.attivo, true) IS NOT FALSE
        AND rr.deleted_at IS NULL
    );
  RETURN NEW;
END;
$tr$;

DROP VIEW IF EXISTS public."Ordine" CASCADE;

CREATE VIEW public."Ordine" AS
  SELECT
    id,
    numero,
    stato,
    totale,
    note,
    tipo_pagamento,
    tipo_ordine,
    nome_cliente,
    orario_ritiro,
    indirizzo_consegna,
    consegna_lng,
    consegna_lat,
    pagamento_dettaglio,
    stato_consegna,
    punto_vendita_id,
    turno_operatori_id,
    tenant_id AS "tenantId",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    deleted_at AS "deletedAt"
  FROM core.ordini
  WHERE tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
    UNION
    SELECT rr.tenant_id FROM core.rider rr
    WHERE rr.auth_user_id = auth.uid()
      AND COALESCE(rr.attivo, true) IS NOT FALSE
      AND rr.deleted_at IS NULL
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public."Ordine" TO authenticated;

DROP TRIGGER IF EXISTS ordine_instead_of_update_trigger ON public."Ordine";
CREATE TRIGGER ordine_instead_of_update_trigger
  INSTEAD OF UPDATE ON public."Ordine"
  FOR EACH ROW
  EXECUTE FUNCTION public.ordine_instead_of_update();


-- ---------- END: supabase/migrations/20260406140000_ordine_turno_operatori.sql ----------

-- ---------- BEGIN: supabase/migrations/20260406150000_cassa_ordine_audit.sql ----------
-- Audit operazioni cassa (append-only) per tracciabilità enterprise.
-- Richiede public.utenti_ruoli con staff sul tenant.

CREATE TABLE IF NOT EXISTS public.cassa_ordine_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  ordine_id uuid,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cassa_ordine_audit_tenant_created
  ON public.cassa_ordine_audit (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cassa_ordine_audit_ordine
  ON public.cassa_ordine_audit (ordine_id)
  WHERE ordine_id IS NOT NULL;

COMMENT ON TABLE public.cassa_ordine_audit IS
  'Append-only: eventi cassa (ordine creato, errore checkout, aggiornamenti rilevanti).';

ALTER TABLE public.cassa_ordine_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cassa_ordine_audit_select_staff" ON public.cassa_ordine_audit;

CREATE POLICY "cassa_ordine_audit_select_staff"
  ON public.cassa_ordine_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = cassa_ordine_audit.tenant_id
        AND (ur.attivo IS DISTINCT FROM false)
    )
  );

GRANT SELECT ON public.cassa_ordine_audit TO authenticated;

CREATE OR REPLACE FUNCTION public.cassa_audit_log(
  p_tenant_id uuid,
  p_ordine_id uuid,
  p_event_type text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND (ur.attivo IS DISTINCT FROM false)
  ) THEN
    RAISE EXCEPTION 'tenant_forbidden' USING ERRCODE = 'P0001';
  END IF;
  IF p_event_type IS NULL OR trim(p_event_type) = '' THEN
    RAISE EXCEPTION 'event_type_obbligatorio' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.cassa_ordine_audit (tenant_id, ordine_id, user_id, event_type, payload)
  VALUES (
    p_tenant_id,
    p_ordine_id,
    auth.uid(),
    trim(p_event_type),
    COALESCE(p_payload, '{}'::jsonb)
  );
END;
$$;

ALTER FUNCTION public.cassa_audit_log(uuid, uuid, text, jsonb) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.cassa_audit_log(uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cassa_audit_log(uuid, uuid, text, jsonb) TO authenticated;
-- ---------- END: supabase/migrations/20260406150000_cassa_ordine_audit.sql ----------

-- ---------- BEGIN: supabase/migrations/20260407130000_online_payment_stripe.sql ----------
-- Pagamenti online: stato su ordine, legame cliente web, segreti Stripe solo service_role.

DO $e$
BEGIN
  IF to_regclass('core.ordini') IS NULL THEN
    RAISE NOTICE 'core.ordini assente: salto online_payment.';
    RETURN;
  END IF;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS online_payment JSONB;
  COMMENT ON COLUMN core.ordini.online_payment IS 'Stripe/SumUp: provider, payment_intent_id, charge_id, status, refund ids (aggiornato da Edge/webhook).';
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS web_cliente_user_id UUID;
  COMMENT ON COLUMN core.ordini.web_cliente_user_id IS 'auth.users id del cliente che ha creato l''ordine da vetrina (per verifica pagamento).';
  -- Allineamento con migrazioni turni cassa: la vista Ordine referenzia questa colonna.
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS turno_operatori_id INTEGER;
END
$e$;

-- Segreti gateway: mai esposti a anon/authenticated via REST; solo Edge (service_role).
DO $sec$
BEGIN
  IF to_regclass('admin.tenants') IS NULL THEN
    RAISE NOTICE 'admin.tenants assente: salto tenant_payment_secrets.';
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS admin.tenant_payment_secrets (
    tenant_id UUID PRIMARY KEY REFERENCES admin.tenants (id) ON DELETE CASCADE,
    stripe_secret TEXT,
    sumup_api_key TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  COMMENT ON TABLE admin.tenant_payment_secrets IS 'Chiavi segrete gateway (Stripe sk_, SumUp API): solo service_role / Edge Functions.';

  ALTER TABLE admin.tenant_payment_secrets ENABLE ROW LEVEL SECURITY;

  REVOKE ALL ON admin.tenant_payment_secrets FROM PUBLIC;
  REVOKE ALL ON admin.tenant_payment_secrets FROM anon;
  REVOKE ALL ON admin.tenant_payment_secrets FROM authenticated;
  GRANT ALL ON admin.tenant_payment_secrets TO service_role;
END
$sec$;

-- Staff: solo flag presenza segreto Stripe (no valore).
CREATE OR REPLACE FUNCTION public.tenant_payment_stripe_configured(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, admin
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non autenticato';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND COALESCE(ur.attivo, true) = true
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM admin.tenant_payment_secrets s
    WHERE s.tenant_id = p_tenant_id
      AND s.stripe_secret IS NOT NULL
      AND btrim(s.stripe_secret) <> ''
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.tenant_payment_stripe_configured(UUID) TO authenticated;

COMMENT ON FUNCTION public.tenant_payment_stripe_configured(UUID) IS
  'True se il tenant ha sk_ Stripe salvata (solo staff; non espone il segreto).';

CREATE OR REPLACE FUNCTION public.save_tenant_stripe_secret(p_tenant_id UUID, p_secret TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, admin
AS $save$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non autenticato';
  END IF;
  IF p_secret IS NULL OR btrim(p_secret) NOT LIKE 'sk_%' THEN
    RAISE EXCEPTION 'chiave Stripe non valida (atteso sk_...)';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND COALESCE(ur.attivo, true) = true
      AND lower(trim(COALESCE(ur.ruolo, ''))) = 'admin'
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO admin.tenant_payment_secrets (tenant_id, stripe_secret, updated_at)
  VALUES (p_tenant_id, btrim(p_secret), now())
  ON CONFLICT (tenant_id) DO UPDATE
  SET stripe_secret = EXCLUDED.stripe_secret, updated_at = now();
END;
$save$;

GRANT EXECUTE ON FUNCTION public.save_tenant_stripe_secret(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.save_tenant_stripe_secret(UUID, TEXT) IS
  'Salva sk_ Stripe per il tenant (solo ruolo admin).';

CREATE OR REPLACE FUNCTION public.get_stripe_secret_for_tenant_edge(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, admin
AS $get$
DECLARE
  v_secret TEXT;
BEGIN
  IF COALESCE((auth.jwt())->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT s.stripe_secret INTO v_secret
  FROM admin.tenant_payment_secrets s
  WHERE s.tenant_id = p_tenant_id;

  RETURN v_secret;
END;
$get$;

GRANT EXECUTE ON FUNCTION public.get_stripe_secret_for_tenant_edge(UUID) TO service_role;

COMMENT ON FUNCTION public.get_stripe_secret_for_tenant_edge(UUID) IS
  'Solo Edge (service_role): legge sk_ Stripe per PaymentIntent / rimborsi.';

CREATE OR REPLACE FUNCTION public.stripe_refund_allowed(p_ordine_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, core
STABLE
AS $rf$
  SELECT EXISTS (
    SELECT 1
    FROM core.ordini o
    JOIN public.utenti_ruoli ur ON ur.tenant_id = o.tenant_id
    WHERE o.id = p_ordine_id
      AND ur.user_id = p_user_id
      AND COALESCE(ur.attivo, true) = true
      AND (
        lower(trim(COALESCE(ur.ruolo, ''))) = 'admin'
        OR COALESCE(ur.accesso_cassa, false) = true
      )
  );
$rf$;

GRANT EXECUTE ON FUNCTION public.stripe_refund_allowed(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.stripe_refund_allowed(UUID, UUID) IS
  'Solo Edge (service_role): verifica se l''utente può rimborsare l''ordine.';

-- Ricrea create_order_with_items con web_cliente_user_id
DO $drop$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT format(
      '%I.%I(%s)',
      ns.nspname,
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid)
    ) AS sig
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace ns ON ns.oid = p.pronamespace
    WHERE p.proname = 'create_order_with_items'
      AND ns.nspname IN ('public', 'core')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END
$drop$;

CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_tenant_id UUID,
  p_totale NUMERIC,
  p_stato TEXT DEFAULT 'IN_PREPARAZIONE',
  p_items JSONB DEFAULT '[]'::JSONB,
  p_note TEXT DEFAULT NULL,
  p_tipo_pagamento TEXT DEFAULT NULL,
  p_tipo_ordine TEXT DEFAULT NULL,
  p_nome_cliente TEXT DEFAULT NULL,
  p_orario_ritiro TEXT DEFAULT NULL,
  p_indirizzo_consegna TEXT DEFAULT NULL,
  p_consegna_lng DOUBLE PRECISION DEFAULT NULL,
  p_consegna_lat DOUBLE PRECISION DEFAULT NULL,
  p_pagamento_dettaglio JSONB DEFAULT NULL,
  p_punto_vendita_id UUID DEFAULT NULL,
  p_turno_operatori_id INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, admin
AS $fn$
DECLARE
  v_ordine_id UUID;
  v_numero INTEGER;
  v_item JSONB;
  v_stato core.stato_ordine;
  v_po jsonb;
  v_ring jsonb;
  v_inside boolean;
  v_is_staff_cassa boolean;
  v_turno_pv uuid;
  v_web_cliente uuid;
BEGIN
  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_numero
  FROM core.ordini
  WHERE tenant_id = p_tenant_id;

  BEGIN
    v_stato := COALESCE(NULLIF(trim(p_stato), ''), 'IN_PREPARAZIONE')::core.stato_ordine;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_stato := 'IN_PREPARAZIONE'::core.stato_ordine;
  END;

  v_web_cliente := NULL;
  IF EXISTS (
    SELECT 1
    FROM public.clienti c
    WHERE c.id = auth.uid()
      AND c.tenant_id = p_tenant_id
  ) THEN
    v_web_cliente := auth.uid();
  END IF;

  v_po := NULL;
  IF to_regclass('admin.tenants') IS NOT NULL THEN
    SELECT t.parametri_operativi INTO v_po
    FROM admin.tenants t
    WHERE t.id = p_tenant_id
    LIMIT 1;
  END IF;
  IF v_po IS NULL AND to_regclass('core.tenants') IS NOT NULL THEN
    SELECT t.parametri_operativi INTO v_po
    FROM core.tenants t
    WHERE t.id = p_tenant_id
    LIMIT 1;
  END IF;

  v_ring := NULL;
  IF v_po IS NOT NULL
     AND (v_po->'consegna_area_poligono'->>'type') = 'Polygon'
     AND jsonb_typeof(v_po->'consegna_area_poligono'->'coordinates') = 'array'
     AND jsonb_array_length(v_po->'consegna_area_poligono'->'coordinates') >= 1
  THEN
    v_ring := v_po->'consegna_area_poligono'->'coordinates'->0;
  END IF;

  IF lower(trim(COALESCE(p_tipo_ordine, ''))) = 'delivery'
     AND v_ring IS NOT NULL
     AND jsonb_typeof(v_ring) = 'array'
     AND jsonb_array_length(v_ring) >= 4
  THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = p_tenant_id
        AND COALESCE(ur.attivo, true) = true
        AND (
          lower(trim(COALESCE(ur.ruolo, ''))) = 'cassa'
          OR COALESCE(ur.accesso_cassa, false) = true
        )
    ) INTO v_is_staff_cassa;

    IF NOT v_is_staff_cassa THEN
      IF p_consegna_lng IS NULL OR p_consegna_lat IS NULL THEN
        RAISE EXCEPTION 'Per la consegna a domicilio servono coordinate valide dell''indirizzo (verifica su mappa).';
      END IF;

      v_inside := public.pm_point_in_ring(p_consegna_lng, p_consegna_lat, v_ring);
      IF v_inside IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'L''indirizzo di consegna è fuori dall''area coperta dal locale.';
      END IF;
    END IF;
  END IF;

  IF p_turno_operatori_id IS NOT NULL THEN
    IF to_regclass('public.turni_operatori') IS NULL THEN
      RAISE EXCEPTION 'turni_operatori non disponibile sul database';
    END IF;
    SELECT t.punto_vendita_id INTO v_turno_pv
    FROM public.turni_operatori t
    WHERE t.id = p_turno_operatori_id
      AND t.tenant_id = p_tenant_id
      AND t.user_id = auth.uid()
      AND t.stato = 'aperto'
      AND t.chiuso_il IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'turno_non_valido';
    END IF;
    IF p_punto_vendita_id IS NOT NULL AND v_turno_pv IS DISTINCT FROM p_punto_vendita_id THEN
      RAISE EXCEPTION 'turno_punto_vendita_mismatch';
    END IF;
  END IF;

  INSERT INTO core.ordini (
    tenant_id,
    numero,
    stato,
    totale,
    note,
    tipo_pagamento,
    tipo_ordine,
    nome_cliente,
    orario_ritiro,
    indirizzo_consegna,
    consegna_lng,
    consegna_lat,
    pagamento_dettaglio,
    punto_vendita_id,
    turno_operatori_id,
    web_cliente_user_id
  )
  VALUES (
    p_tenant_id,
    v_numero,
    v_stato,
    p_totale,
    NULLIF(trim(COALESCE(p_note, '')), ''),
    NULLIF(trim(COALESCE(p_tipo_pagamento, '')), ''),
    NULLIF(trim(COALESCE(p_tipo_ordine, '')), ''),
    NULLIF(trim(COALESCE(p_nome_cliente, '')), ''),
    NULLIF(trim(COALESCE(p_orario_ritiro, '')), ''),
    NULLIF(trim(COALESCE(p_indirizzo_consegna, '')), ''),
    p_consegna_lng,
    p_consegna_lat,
    p_pagamento_dettaglio,
    p_punto_vendita_id,
    p_turno_operatori_id,
    v_web_cliente
  )
  RETURNING id INTO v_ordine_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::JSONB))
  LOOP
    INSERT INTO core.riga_ordine (
      tenant_id,
      ordine_id,
      prodotto_id,
      quantita,
      prezzo,
      formato_nome,
      ingredienti_cottura_summary
    )
    VALUES (
      p_tenant_id,
      v_ordine_id,
      (v_item->>'prodotto_id')::UUID,
      GREATEST(1, COALESCE((v_item->>'quantita')::INTEGER, 1)),
      COALESCE((v_item->>'prezzo')::NUMERIC, 0),
      NULLIF(trim(COALESCE(v_item->>'formato_nome', '')), ''),
      NULLIF(trim(COALESCE(v_item->>'ingredienti_cottura_summary', '')), '')
    );
  END LOOP;

  RETURN v_ordine_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, JSONB, UUID, INTEGER
) TO authenticated;

COMMENT ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, JSONB, UUID, INTEGER
) IS
  'Crea ordine + righe. web_cliente_user_id valorizzato se auth.uid() è cliente del tenant.';

-- Vista Ordine: online_payment
CREATE OR REPLACE FUNCTION public.ordine_instead_of_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $tr$
BEGIN
  UPDATE core.ordini
  SET
    stato                 = COALESCE(NEW.stato, OLD.stato),
    totale                = COALESCE(NEW.totale, OLD.totale),
    note                  = COALESCE(NEW.note, OLD.note),
    tipo_pagamento        = COALESCE(NEW.tipo_pagamento, OLD.tipo_pagamento),
    tipo_ordine           = COALESCE(NEW.tipo_ordine, OLD.tipo_ordine),
    nome_cliente          = NEW.nome_cliente,
    orario_ritiro         = NEW.orario_ritiro,
    indirizzo_consegna    = NEW.indirizzo_consegna,
    consegna_lng          = COALESCE(NEW.consegna_lng, OLD.consegna_lng),
    consegna_lat          = COALESCE(NEW.consegna_lat, OLD.consegna_lat),
    pagamento_dettaglio   = COALESCE(NEW.pagamento_dettaglio, OLD.pagamento_dettaglio),
    stato_consegna        = COALESCE(NEW.stato_consegna, OLD.stato_consegna),
    punto_vendita_id      = COALESCE(NEW.punto_vendita_id, OLD.punto_vendita_id),
    turno_operatori_id    = COALESCE(NEW.turno_operatori_id, OLD.turno_operatori_id),
    online_payment        = COALESCE(NEW.online_payment, OLD.online_payment),
    updated_at            = now()
  WHERE id = OLD.id
    AND tenant_id IN (
      SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
      UNION
      SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
      UNION
      SELECT rr.tenant_id FROM core.rider rr
      WHERE rr.auth_user_id = auth.uid()
        AND COALESCE(rr.attivo, true) IS NOT FALSE
        AND rr.deleted_at IS NULL
    );
  RETURN NEW;
END;
$tr$;

DROP VIEW IF EXISTS public."Ordine" CASCADE;

CREATE VIEW public."Ordine" AS
  SELECT
    id,
    numero,
    stato,
    totale,
    note,
    tipo_pagamento,
    tipo_ordine,
    nome_cliente,
    orario_ritiro,
    indirizzo_consegna,
    consegna_lng,
    consegna_lat,
    pagamento_dettaglio,
    stato_consegna,
    punto_vendita_id,
    turno_operatori_id,
    online_payment,
    tenant_id AS "tenantId",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    deleted_at AS "deletedAt"
  FROM core.ordini
  WHERE tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
    UNION
    SELECT rr.tenant_id FROM core.rider rr
    WHERE rr.auth_user_id = auth.uid()
      AND COALESCE(rr.attivo, true) IS NOT FALSE
      AND rr.deleted_at IS NULL
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public."Ordine" TO authenticated;

DROP TRIGGER IF EXISTS ordine_instead_of_update_trigger ON public."Ordine";
CREATE TRIGGER ordine_instead_of_update_trigger
  INSTEAD OF UPDATE ON public."Ordine"
  FOR EACH ROW
  EXECUTE FUNCTION public.ordine_instead_of_update();

CREATE INDEX IF NOT EXISTS idx_ordini_online_payment_stripe_pi
  ON core.ordini ((online_payment->>'stripe_payment_intent_id'))
  WHERE (online_payment->>'stripe_payment_intent_id') IS NOT NULL;

-- Aggiornamenti ordine da webhook Stripe (solo service_role / Edge)
CREATE OR REPLACE FUNCTION public.edge_stripe_mark_payment_succeeded(
  p_payment_intent_id TEXT,
  p_charge_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $ok$
DECLARE
  v_id UUID;
BEGIN
  IF COALESCE((auth.jwt())->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE core.ordini o
  SET
    stato = 'IN_PREPARAZIONE'::core.stato_ordine,
    tipo_pagamento = 'Carta (Stripe — pagato)',
    online_payment = COALESCE(o.online_payment, '{}'::jsonb) || jsonb_build_object(
      'provider', 'stripe',
      'stripe_payment_intent_id', p_payment_intent_id,
      'status', 'succeeded',
      'charge_id', p_charge_id,
      'paid_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ),
    updated_at = now()
  WHERE (o.online_payment->>'stripe_payment_intent_id') IS NOT DISTINCT FROM p_payment_intent_id
  RETURNING o.id INTO v_id;

  RETURN v_id;
END;
$ok$;

GRANT EXECUTE ON FUNCTION public.edge_stripe_mark_payment_succeeded(TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.edge_stripe_mark_payment_failed(
  p_payment_intent_id TEXT,
  p_message TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $fail$
DECLARE
  v_id UUID;
BEGIN
  IF COALESCE((auth.jwt())->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE core.ordini o
  SET
    online_payment = COALESCE(o.online_payment, '{}'::jsonb) || jsonb_build_object(
      'provider', 'stripe',
      'stripe_payment_intent_id', p_payment_intent_id,
      'status', 'payment_failed',
      'failure_message', LEFT(COALESCE(p_message, ''), 2000)
    ),
    updated_at = now()
  WHERE (o.online_payment->>'stripe_payment_intent_id') IS NOT DISTINCT FROM p_payment_intent_id
  RETURNING o.id INTO v_id;

  RETURN v_id;
END;
$fail$;

GRANT EXECUTE ON FUNCTION public.edge_stripe_mark_payment_failed(TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.edge_stripe_append_refund(
  p_payment_intent_id TEXT,
  p_refund_id TEXT,
  p_amount_cent INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $ref$
DECLARE
  v_id UUID;
  v_arr jsonb;
BEGIN
  IF COALESCE((auth.jwt())->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT o.id, COALESCE(o.online_payment->'refunds', '[]'::jsonb)
  INTO v_id, v_arr
  FROM core.ordini o
  WHERE (o.online_payment->>'stripe_payment_intent_id') IS NOT DISTINCT FROM p_payment_intent_id
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_arr := COALESCE(v_arr, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'refund_id', p_refund_id,
      'amount_cent', p_amount_cent,
      'at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
  );

  UPDATE core.ordini o
  SET
    online_payment = COALESCE(o.online_payment, '{}'::jsonb) || jsonb_build_object('refunds', v_arr),
    updated_at = now()
  WHERE o.id = v_id;

  RETURN v_id;
END;
$ref$;

GRANT EXECUTE ON FUNCTION public.edge_stripe_append_refund(TEXT, TEXT, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.edge_ordine_snapshot_for_stripe(
  p_ordine_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  tenant_id UUID,
  totale NUMERIC,
  stato TEXT,
  stripe_provider TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, admin
AS $snap$
DECLARE
  v_web UUID;
  v_stato TEXT;
  v_tot NUMERIC;
  v_tid UUID;
  v_prov TEXT;
BEGIN
  IF COALESCE((auth.jwt())->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT
    o.tenant_id,
    o.totale,
    o.stato::text,
    o.web_cliente_user_id,
    lower(trim(COALESCE(t.pagamento_online_provider, '')))
  INTO v_tid, v_tot, v_stato, v_web, v_prov
  FROM core.ordini o
  LEFT JOIN admin.tenants t ON t.id = o.tenant_id
  WHERE o.id = p_ordine_id;

  IF v_tid IS NULL THEN
    RAISE EXCEPTION 'ordine non trovato';
  END IF;
  IF v_web IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'ordine non associato al cliente';
  END IF;
  IF v_stato IS DISTINCT FROM 'IN_ATTESA' THEN
    RAISE EXCEPTION 'ordine non in attesa pagamento';
  END IF;
  IF v_prov IS DISTINCT FROM 'stripe' THEN
    RAISE EXCEPTION 'provider non stripe';
  END IF;

  RETURN QUERY SELECT v_tid, v_tot, v_stato, v_prov;
END;
$snap$;

GRANT EXECUTE ON FUNCTION public.edge_ordine_snapshot_for_stripe(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.edge_stripe_attach_payment_intent(
  p_ordine_id UUID,
  p_payment_intent_id TEXT,
  p_status TEXT,
  p_amount_cent INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $att$
BEGIN
  IF COALESCE((auth.jwt())->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE core.ordini o
  SET
    online_payment = jsonb_build_object(
      'provider', 'stripe',
      'stripe_payment_intent_id', p_payment_intent_id,
      'status', p_status,
      'amount_cent', p_amount_cent,
      'currency', 'eur'
    ),
    updated_at = now()
  WHERE o.id = p_ordine_id
    AND o.stato::text = 'IN_ATTESA';
END;
$att$;

GRANT EXECUTE ON FUNCTION public.edge_stripe_attach_payment_intent(UUID, TEXT, TEXT, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.edge_get_ordine_payment_context(p_ordine_id UUID)
RETURNS TABLE (tenant_id UUID, online_payment JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
STABLE
AS $ctx$
BEGIN
  IF COALESCE((auth.jwt())->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT o.tenant_id, o.online_payment
  FROM core.ordini o
  WHERE o.id = p_ordine_id
  LIMIT 1;
END;
$ctx$;

GRANT EXECUTE ON FUNCTION public.edge_get_ordine_payment_context(UUID) TO service_role;
-- ---------- END: supabase/migrations/20260407130000_online_payment_stripe.sql ----------

-- ---------- BEGIN: supabase/migrations/20260408120000_rider_delivery_enterprise.sql ----------
-- Rider / consegne enterprise — copia allineata a sql/modules/11_rider_delivery_enterprise.sql
-- Modifiche: editare il modulo 11 e riallineare questo file.

-- =============================================================================
-- 11) Rider / consegne enterprise — anagrafica rider, turni, percorsi, eventi
-- =============================================================================
-- Regola A (logistica): il flag bloccato_cucina su consegna_percorso_ordine indica
-- ordini non riordinabili al ricalcolo percorso (es. già in forno).
--
-- Dipendenze: core.tenants, core.ordini, core.punti_vendita (opzionale), core.users (opzionale)
-- Prerequisiti progetto: sql/modules/03_ordini_extensions.sql (tipo_ordine, stato_consegna, coordinate, …)
-- =============================================================================

-- --- Enum stato logistica delivery (affianca stato_consegna TEXT legacy) ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'core' AND t.typname = 'stato_delivery') THEN
    CREATE TYPE core.stato_delivery AS ENUM (
      'DA_ASSEGNARE',
      'ASSEGNATO',
      'IN_ATTESA_BANCONE',
      'IN_VIAGGIO',
      'PRESSO_CLIENTE',
      'CONSEGNATO',
      'ANOMALIA'
    );
  END IF;
END $$;

COMMENT ON TYPE core.stato_delivery IS
  'Ciclo consegna rider (affianca core.ordini.stato_consegna TEXT per compatibilità).';

-- --- Rider -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core.rider (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  nome_display TEXT NOT NULL,
  telefono TEXT,
  attivo BOOLEAN NOT NULL DEFAULT true,
  veicolo_tipo TEXT,
  note TEXT,
  staff_user_id UUID REFERENCES core.users(id) ON DELETE SET NULL,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rider_almeno_un_utente CHECK (
    staff_user_id IS NOT NULL OR auth_user_id IS NOT NULL OR length(trim(nome_display)) > 0
  )
);

ALTER TABLE core.rider ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rider_auth_tenant
  ON core.rider (tenant_id, auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rider_tenant_attivo ON core.rider (tenant_id) WHERE attivo = true AND deleted_at IS NULL;

COMMENT ON TABLE core.rider IS 'Operatori consegna per tenant (app rider o staff).';
COMMENT ON COLUMN core.rider.staff_user_id IS 'Operatore backoffice core.users, se presente.';
COMMENT ON COLUMN core.rider.auth_user_id IS 'Login Supabase auth.users per app rider nativa.';

-- --- Turno operativo rider (distinto dal turno cassa) ------------------------
CREATE TABLE IF NOT EXISTS core.turno_rider (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES core.rider(id) ON DELETE CASCADE,
  punto_vendita_id UUID REFERENCES core.punti_vendita(id) ON DELETE SET NULL,
  stato TEXT NOT NULL DEFAULT 'aperto' CHECK (stato IN ('aperto', 'chiuso')),
  aperto_il TIMESTAMPTZ NOT NULL DEFAULT now(),
  chiuso_il TIMESTAMPTZ,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_turno_rider_tenant_aperto
  ON core.turno_rider (tenant_id, rider_id)
  WHERE stato = 'aperto' AND chiuso_il IS NULL;

COMMENT ON TABLE core.turno_rider IS 'Turno operativo rider (apertura/chiusura giornata o servizio).';

-- --- Percorso (versionato; regola A su righe ordine) -------------------------
CREATE TABLE IF NOT EXISTS core.consegna_percorso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES core.rider(id) ON DELETE CASCADE,
  turno_rider_id UUID REFERENCES core.turno_rider(id) ON DELETE SET NULL,
  versione INT NOT NULL DEFAULT 1,
  stato TEXT NOT NULL DEFAULT 'bozza' CHECK (stato IN ('bozza', 'attivo', 'completato', 'sostituito', 'annullato')),
  provider TEXT,
  geometria JSONB,
  durata_stimata_sec INT,
  distanza_metri NUMERIC(12, 2),
  creato_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  chiuso_at TIMESTAMPTZ,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_consegna_percorso_tenant_rider
  ON core.consegna_percorso (tenant_id, rider_id, creato_at DESC);

COMMENT ON TABLE core.consegna_percorso IS 'Piano di consegna (ricalcoli → nuova riga o versione).';
COMMENT ON COLUMN core.consegna_percorso.geometria IS 'Polyline/geojson o risposta provider (opzionale).';

-- --- Ordini nel percorso (sequenza + blocco cucina) --------------------------
CREATE TABLE IF NOT EXISTS core.consegna_percorso_ordine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  percorso_id UUID NOT NULL REFERENCES core.consegna_percorso(id) ON DELETE CASCADE,
  ordine_id UUID NOT NULL REFERENCES core.ordini(id) ON DELETE CASCADE,
  sequenza INT NOT NULL CHECK (sequenza >= 1),
  bloccato_cucina BOOLEAN NOT NULL DEFAULT false,
  eta_minuti INT,
  dwell_secondi INT,
  note TEXT,
  UNIQUE (percorso_id, ordine_id),
  UNIQUE (percorso_id, sequenza)
);

CREATE INDEX IF NOT EXISTS idx_percorso_ordine_ordine ON core.consegna_percorso_ordine (ordine_id);

COMMENT ON COLUMN core.consegna_percorso_ordine.bloccato_cucina IS
  'Se true, il ricalcolo percorso non deve spostare/riordinare questo ordine (regola A: es. in forno).';

-- --- Ultima posizione rider --------------------------------------------------
CREATE TABLE IF NOT EXISTS core.rider_posizione (
  rider_id UUID PRIMARY KEY REFERENCES core.rider(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy_m DOUBLE PRECISION,
  aggiornato_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rider_posizione_aggiornato ON core.rider_posizione (aggiornato_at DESC);

-- --- Eventi / audit consegna -------------------------------------------------
CREATE TABLE IF NOT EXISTS core.ordine_consegna_evento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  ordine_id UUID NOT NULL REFERENCES core.ordini(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  percorso_id UUID REFERENCES core.consegna_percorso(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ordine_consegna_evento_tenant_created
  ON core.ordine_consegna_evento (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ordine_consegna_evento_ordine
  ON core.ordine_consegna_evento (ordine_id, created_at DESC);

COMMENT ON TABLE core.ordine_consegna_evento IS 'Append-only: transizioni stato, ricalcoli percorso, note operative.';

-- --- Outbox notifiche (push / worker Edge) -----------------------------------
CREATE TABLE IF NOT EXISTS public.notifiche_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  destinatario TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  stato TEXT NOT NULL DEFAULT 'in_coda' CHECK (stato IN ('in_coda', 'inviato', 'fallito', 'annullato')),
  tentativi INT NOT NULL DEFAULT 0,
  ultimo_errore TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  inviato_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifiche_outbox_tenant_stato
  ON public.notifiche_outbox (tenant_id, stato, created_at)
  WHERE stato = 'in_coda';

COMMENT ON TABLE public.notifiche_outbox IS 'Coda notifiche (FCM/email) per processamento Edge/cron.';

-- --- Estensioni core.ordini ----------------------------------------------------
DO $$
BEGIN
  IF to_regclass('core.ordini') IS NULL THEN
    RAISE NOTICE 'core.ordini assente: salto colonne rider.';
    RETURN;
  END IF;

  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS rider_id UUID REFERENCES core.rider(id) ON DELETE SET NULL;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS turno_rider_id UUID REFERENCES core.turno_rider(id) ON DELETE SET NULL;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS percorso_attivo_id UUID REFERENCES core.consegna_percorso(id) ON DELETE SET NULL;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS stato_delivery core.stato_delivery;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS assegnato_rider_at TIMESTAMPTZ;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS ritiro_bancone_rider_at TIMESTAMPTZ;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS consegna_effettiva_at TIMESTAMPTZ;

  COMMENT ON COLUMN core.ordini.rider_id IS 'Rider assegnato all''ordine delivery.';
  COMMENT ON COLUMN core.ordini.turno_rider_id IS 'Turno rider di riferimento (opzionale).';
  COMMENT ON COLUMN core.ordini.percorso_attivo_id IS 'Ultimo percorso attivo noto per l''ordine.';
  COMMENT ON COLUMN core.ordini.stato_delivery IS 'Stato logistica (enum); affianca stato_consegna TEXT legacy.';
  COMMENT ON COLUMN core.ordini.assegnato_rider_at IS 'Quando l''ordine è stato assegnato al rider.';
  COMMENT ON COLUMN core.ordini.ritiro_bancone_rider_at IS 'Quando il rider ha ritirato la merce al bancone.';
  COMMENT ON COLUMN core.ordini.consegna_effettiva_at IS 'Consegna al cliente completata.';
END $$;

DO $$
BEGIN
  IF to_regclass('core.ordini') IS NULL THEN
    RETURN;
  END IF;
  CREATE INDEX IF NOT EXISTS idx_ordini_tenant_rider_delivery
    ON core.ordini (tenant_id, rider_id)
    WHERE rider_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_ordini_tenant_stato_delivery
    ON core.ordini (tenant_id, stato_delivery)
    WHERE stato_delivery IS NOT NULL;
END $$;

-- Backfill stato_delivery da stato_consegna (best-effort; richiede colonne da sql/modules/03_ordini_extensions.sql)
DO $$
BEGIN
  IF to_regclass('core.ordini') IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'core' AND table_name = 'ordini' AND column_name = 'tipo_ordine'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'core' AND table_name = 'ordini' AND column_name = 'stato_consegna'
  ) THEN
    RETURN;
  END IF;
  UPDATE core.ordini o
  SET stato_delivery = v.mapped
  FROM (
    SELECT id,
      CASE upper(trim(COALESCE(stato_consegna, '')))
        WHEN 'CONSEGNATO' THEN 'CONSEGNATO'::core.stato_delivery
        WHEN 'IN_VIAGGIO' THEN 'IN_VIAGGIO'::core.stato_delivery
        WHEN 'RICHIESTA' THEN 'DA_ASSEGNARE'::core.stato_delivery
        WHEN '' THEN 'DA_ASSEGNARE'::core.stato_delivery
        ELSE NULL
      END AS mapped
    FROM core.ordini
    WHERE tipo_ordine IS NOT NULL AND lower(trim(tipo_ordine)) = 'delivery'
  ) v
  WHERE o.id = v.id AND o.stato_delivery IS NULL AND v.mapped IS NOT NULL;
END $$;

-- --- RLS core.* (staff tenant via utenti_ruoli) --------------------------------
ALTER TABLE core.rider ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.turno_rider ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.consegna_percorso ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.consegna_percorso_ordine ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.rider_posizione ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.ordine_consegna_evento ENABLE ROW LEVEL SECURITY;

-- Rider
DROP POLICY IF EXISTS rider_select_staff ON core.rider;
CREATE POLICY rider_select_staff ON core.rider FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = rider.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ));
DROP POLICY IF EXISTS rider_modify_staff ON core.rider;
CREATE POLICY rider_modify_staff ON core.rider FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = rider.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = rider.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ));

-- turno_rider
DROP POLICY IF EXISTS turno_rider_select_staff ON core.turno_rider;
CREATE POLICY turno_rider_select_staff ON core.turno_rider FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = turno_rider.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ));
DROP POLICY IF EXISTS turno_rider_modify_staff ON core.turno_rider;
CREATE POLICY turno_rider_modify_staff ON core.turno_rider FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = turno_rider.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = turno_rider.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ));

-- consegna_percorso
DROP POLICY IF EXISTS consegna_percorso_select_staff ON core.consegna_percorso;
CREATE POLICY consegna_percorso_select_staff ON core.consegna_percorso FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = consegna_percorso.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ));
DROP POLICY IF EXISTS consegna_percorso_modify_staff ON core.consegna_percorso;
CREATE POLICY consegna_percorso_modify_staff ON core.consegna_percorso FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = consegna_percorso.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = consegna_percorso.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ));

-- consegna_percorso_ordine (tenant via join percorso)
DROP POLICY IF EXISTS consegna_percorso_ordine_select_staff ON core.consegna_percorso_ordine;
CREATE POLICY consegna_percorso_ordine_select_staff ON core.consegna_percorso_ordine FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM core.consegna_percorso p
    JOIN public.utenti_ruoli ur ON ur.tenant_id = p.tenant_id
    WHERE p.id = consegna_percorso_ordine.percorso_id AND ur.user_id = auth.uid() AND (ur.attivo IS DISTINCT FROM false)
  ));
DROP POLICY IF EXISTS consegna_percorso_ordine_modify_staff ON core.consegna_percorso_ordine;
CREATE POLICY consegna_percorso_ordine_modify_staff ON core.consegna_percorso_ordine FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM core.consegna_percorso p
    JOIN public.utenti_ruoli ur ON ur.tenant_id = p.tenant_id
    WHERE p.id = consegna_percorso_ordine.percorso_id AND ur.user_id = auth.uid() AND (ur.attivo IS DISTINCT FROM false)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM core.consegna_percorso p
    JOIN public.utenti_ruoli ur ON ur.tenant_id = p.tenant_id
    WHERE p.id = consegna_percorso_ordine.percorso_id AND ur.user_id = auth.uid() AND (ur.attivo IS DISTINCT FROM false)
  ));

-- rider_posizione (tenant via rider)
DROP POLICY IF EXISTS rider_posizione_select_staff ON core.rider_posizione;
CREATE POLICY rider_posizione_select_staff ON core.rider_posizione FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM core.rider r
    JOIN public.utenti_ruoli ur ON ur.tenant_id = r.tenant_id
    WHERE r.id = rider_posizione.rider_id AND ur.user_id = auth.uid() AND (ur.attivo IS DISTINCT FROM false)
  ));
DROP POLICY IF EXISTS rider_posizione_modify_staff ON core.rider_posizione;
CREATE POLICY rider_posizione_modify_staff ON core.rider_posizione FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM core.rider r
    JOIN public.utenti_ruoli ur ON ur.tenant_id = r.tenant_id
    WHERE r.id = rider_posizione.rider_id AND ur.user_id = auth.uid() AND (ur.attivo IS DISTINCT FROM false)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM core.rider r
    JOIN public.utenti_ruoli ur ON ur.tenant_id = r.tenant_id
    WHERE r.id = rider_posizione.rider_id AND ur.user_id = auth.uid() AND (ur.attivo IS DISTINCT FROM false)
  ));

-- ordine_consegna_evento
DROP POLICY IF EXISTS ordine_consegna_evento_select_staff ON core.ordine_consegna_evento;
CREATE POLICY ordine_consegna_evento_select_staff ON core.ordine_consegna_evento FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = ordine_consegna_evento.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ));
DROP POLICY IF EXISTS ordine_consegna_evento_insert_staff ON core.ordine_consegna_evento;
CREATE POLICY ordine_consegna_evento_insert_staff ON core.ordine_consegna_evento FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = ordine_consegna_evento.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ));

-- Outbox: solo staff; niente UPDATE da client (worker usa service role)
ALTER TABLE public.notifiche_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifiche_outbox_select_staff ON public.notifiche_outbox;
CREATE POLICY notifiche_outbox_select_staff ON public.notifiche_outbox FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = notifiche_outbox.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ));
DROP POLICY IF EXISTS notifiche_outbox_insert_staff ON public.notifiche_outbox;
CREATE POLICY notifiche_outbox_insert_staff ON public.notifiche_outbox FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = notifiche_outbox.tenant_id AND (ur.attivo IS DISTINCT FROM false)
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON core.rider TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.turno_rider TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.consegna_percorso TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.consegna_percorso_ordine TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.rider_posizione TO authenticated;
GRANT SELECT, INSERT ON core.ordine_consegna_evento TO authenticated;
GRANT SELECT, INSERT ON public.notifiche_outbox TO authenticated;
-- ---------- END: supabase/migrations/20260408120000_rider_delivery_enterprise.sql ----------

-- ---------- BEGIN: supabase/migrations/20260408121000_ordine_view_rider_columns.sql ----------
-- Vista public."Ordine" + trigger: colonne rider (dopo 20260408120000_rider_delivery_enterprise.sql)
-- Fonte: sql/modules/04_ordine_view_trigger.sql

CREATE OR REPLACE FUNCTION public.ordine_instead_of_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $tr$
BEGIN
  UPDATE core.ordini
  SET
    stato              = COALESCE(NEW.stato, OLD.stato),
    totale             = COALESCE(NEW.totale, OLD.totale),
    note               = COALESCE(NEW.note, OLD.note),
    tipo_pagamento     = COALESCE(NEW.tipo_pagamento, OLD.tipo_pagamento),
    tipo_ordine        = COALESCE(NEW.tipo_ordine, OLD.tipo_ordine),
    nome_cliente       = NEW.nome_cliente,
    orario_ritiro      = NEW.orario_ritiro,
    indirizzo_consegna = NEW.indirizzo_consegna,
    consegna_lng       = COALESCE(NEW.consegna_lng, OLD.consegna_lng),
    consegna_lat       = COALESCE(NEW.consegna_lat, OLD.consegna_lat),
    pagamento_dettaglio = COALESCE(NEW.pagamento_dettaglio, OLD.pagamento_dettaglio),
    stato_consegna     = COALESCE(NEW.stato_consegna, OLD.stato_consegna),
    punto_vendita_id   = COALESCE(NEW.punto_vendita_id, OLD.punto_vendita_id),
    turno_operatori_id = COALESCE(NEW.turno_operatori_id, OLD.turno_operatori_id),
    rider_id           = COALESCE(NEW.rider_id, OLD.rider_id),
    turno_rider_id     = COALESCE(NEW.turno_rider_id, OLD.turno_rider_id),
    percorso_attivo_id = COALESCE(NEW.percorso_attivo_id, OLD.percorso_attivo_id),
    stato_delivery     = COALESCE(NEW.stato_delivery, OLD.stato_delivery),
    assegnato_rider_at = COALESCE(NEW.assegnato_rider_at, OLD.assegnato_rider_at),
    ritiro_bancone_rider_at = COALESCE(NEW.ritiro_bancone_rider_at, OLD.ritiro_bancone_rider_at),
    consegna_effettiva_at = COALESCE(NEW.consegna_effettiva_at, OLD.consegna_effettiva_at),
    updated_at         = now()
  WHERE id = OLD.id
    AND tenant_id IN (
      SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
      UNION
      SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
      UNION
      SELECT rr.tenant_id FROM core.rider rr
      WHERE rr.auth_user_id = auth.uid()
        AND COALESCE(rr.attivo, true) IS NOT FALSE
        AND rr.deleted_at IS NULL
    );
  RETURN NEW;
END;
$tr$;

DROP VIEW IF EXISTS public."Ordine" CASCADE;

CREATE VIEW public."Ordine" AS
  SELECT
    id,
    numero,
    stato,
    totale,
    note,
    tipo_pagamento,
    tipo_ordine,
    nome_cliente,
    orario_ritiro,
    indirizzo_consegna,
    consegna_lng,
    consegna_lat,
    pagamento_dettaglio,
    stato_consegna,
    punto_vendita_id,
    turno_operatori_id,
    rider_id,
    turno_rider_id,
    percorso_attivo_id,
    stato_delivery,
    assegnato_rider_at,
    ritiro_bancone_rider_at,
    consegna_effettiva_at,
    tenant_id AS "tenantId",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    deleted_at AS "deletedAt"
  FROM core.ordini
  WHERE tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
    UNION
    SELECT rr.tenant_id FROM core.rider rr
    WHERE rr.auth_user_id = auth.uid()
      AND COALESCE(rr.attivo, true) IS NOT FALSE
      AND rr.deleted_at IS NULL
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public."Ordine" TO authenticated;

DROP TRIGGER IF EXISTS ordine_instead_of_update_trigger ON public."Ordine";
CREATE TRIGGER ordine_instead_of_update_trigger
  INSTEAD OF UPDATE ON public."Ordine"
  FOR EACH ROW
  EXECUTE FUNCTION public.ordine_instead_of_update();
-- ---------- END: supabase/migrations/20260408121000_ordine_view_rider_columns.sql ----------

-- ---------- BEGIN: supabase/migrations/20260409120000_anon_select_core_prodotti_menu_pubblico.sql ----------
-- Menu pubblico: la vista public.prodotti_menu_pubblico legge core.prodotti.
-- Con RLS solo "isolate_by_tenant", il ruolo anon non passa → 403 su REST.
-- Policy di sola lettura sui soli prodotti pubblicabili (allineata al WHERE della vista).

DROP POLICY IF EXISTS anon_select_prodotti_menu_pubblico ON core.prodotti;

CREATE POLICY anon_select_prodotti_menu_pubblico
  ON core.prodotti
  FOR SELECT
  TO anon
  USING (
    deleted_at IS NULL
    AND (attivo = true OR attivo IS NULL)
    AND (visibile_online = true OR visibile_online IS NULL)
  );
-- ---------- END: supabase/migrations/20260409120000_anon_select_core_prodotti_menu_pubblico.sql ----------

-- =============================================================================
-- CONSOLIDAMENTO sql/modules + parti di sql/sql_upgrade.sql (idempotente)
-- =============================================================================
-- Allinea il baseline a: 06_contabilita_movimenti, 07_magazzino_movimenti,
-- 12_fiscal_outbox_payment_links, 08_seed_pv_default (con colonne PV se mancanti),
-- vista public."Ordine" + trigger (telefono_ritiro, cucina_prep_stato, COALESCE nome_cliente).
-- =============================================================================

-- --- core.punti_vendita: colonne usate da moduli 02 / 08 / 10 (se assenti nel dump) ---
ALTER TABLE core.punti_vendita ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE core.punti_vendita ADD COLUMN IF NOT EXISTS attivo BOOLEAN DEFAULT true;
ALTER TABLE core.punti_vendita ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE core.punti_vendita ADD COLUMN IF NOT EXISTS consegna_area_poligono JSONB;
ALTER TABLE core.punti_vendita ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE core.punti_vendita ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

COMMENT ON COLUMN core.punti_vendita.consegna_area_poligono IS 'GeoJSON Polygon WGS84; se NULL in checkout si usa parametri_operativi.consegna_area_poligono del tenant.';
COMMENT ON COLUMN core.punti_vendita.lat IS 'Latitudine sede (centro mappa e marcatore in admin aree consegna).';
COMMENT ON COLUMN core.punti_vendita.lng IS 'Longitudine sede (centro mappa e marcatore in admin aree consegna).';

-- --- 06 contabilita_movimenti ---
CREATE TABLE IF NOT EXISTS public.contabilita_movimenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  data_mov DATE NOT NULL,
  descrizione TEXT,
  importo NUMERIC(12, 2) NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('contanti', 'elettronico')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contabilita_movimenti_tenant_data
  ON public.contabilita_movimenti(tenant_id, data_mov DESC);

ALTER TABLE public.contabilita_movimenti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabilita_movimenti_staff_all" ON public.contabilita_movimenti;
CREATE POLICY "contabilita_movimenti_staff_all" ON public.contabilita_movimenti
  FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contabilita_movimenti TO authenticated;

COMMENT ON TABLE public.contabilita_movimenti IS
  'Incassi manuali registrati da Admin (contanti / elettronico); usabile al posto del solo localStorage.';

-- --- 07 magazzino_movimenti ---
CREATE TABLE IF NOT EXISTS public.magazzino_movimenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  prodotto_id UUID,
  descrizione TEXT NOT NULL,
  qty_delta NUMERIC(14, 3) NOT NULL,
  unita TEXT DEFAULT 'pz',
  riferimento TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_magazzino_movimenti_tenant ON public.magazzino_movimenti(tenant_id, created_at DESC);

ALTER TABLE public.magazzino_movimenti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "magazzino_movimenti_staff_all" ON public.magazzino_movimenti;
CREATE POLICY "magazzino_movimenti_staff_all" ON public.magazzino_movimenti
  FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.magazzino_movimenti TO authenticated;

COMMENT ON TABLE public.magazzino_movimenti IS
  'Movimenti di carico/scarico; prodotto_id opzionale se il movimento è aggregato o non legato al listino.';

-- --- 12 fiscal_outbox + payment_link_intents (stesso contenuto sql/modules/12_*.sql) ---
CREATE TABLE IF NOT EXISTS public.fiscal_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  ordine_id UUID REFERENCES core.ordini(id) ON DELETE SET NULL,
  punto_vendita_id UUID,
  kind TEXT NOT NULL CHECK (
    kind IN (
      'corrispettivo_rt',
      'chiusura_giornaliera_rt',
      'annullo_rt',
      'sdi_fattura',
      'sdi_nota_credito',
      'export_file',
      'noop_test'
    )
  ),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'sent', 'ack', 'failed', 'cancelled')
  ),
  idempotency_key TEXT NOT NULL,
  payload_canonical JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_key TEXT,
  provider_request JSONB,
  provider_response JSONB,
  last_error TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT fiscal_outbox_tenant_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_outbox_tenant_status
  ON public.fiscal_outbox(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fiscal_outbox_ordine
  ON public.fiscal_outbox(ordine_id)
  WHERE ordine_id IS NOT NULL;

COMMENT ON TABLE public.fiscal_outbox IS
  'Coda fiscal: corrispettivi RT, chiusure, SDI, export. Adapter esterni mappano payload_canonical → fornitore.';

COMMENT ON COLUMN public.fiscal_outbox.payload_canonical IS
  'Payload interno stabile (importi, righe, aliquote, riferimenti ordine) prima del mapping verso il provider.';

COMMENT ON COLUMN public.fiscal_outbox.provider_key IS
  'Identificativo implementazione: es. rtmiddleware_acme, export_xml_v1, noop.';

CREATE TABLE IF NOT EXISTS public.payment_link_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  ordine_id UUID NOT NULL REFERENCES core.ordini(id) ON DELETE CASCADE,
  importo_cent BIGINT NOT NULL CHECK (importo_cent > 0),
  valuta TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sent', 'opened', 'paid', 'failed', 'expired', 'cancelled')
  ),
  idempotency_key TEXT NOT NULL,
  destinatario_telefono TEXT,
  payment_url TEXT,
  provider_key TEXT,
  provider_intent_id TEXT,
  provider_payload JSONB,
  last_error TEXT,
  sms_sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT payment_link_intents_tenant_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_payment_link_intents_tenant_status
  ON public.payment_link_intents(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_link_intents_ordine
  ON public.payment_link_intents(ordine_id);

COMMENT ON TABLE public.payment_link_intents IS
  'Intent pay-by-link: generazione URL, invio SMS, stato da webhook PSP.';

ALTER TABLE public.fiscal_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_link_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fiscal_outbox_staff_all" ON public.fiscal_outbox;
CREATE POLICY "fiscal_outbox_staff_all" ON public.fiscal_outbox
  FOR ALL
  USING (
    tenant_id IN (SELECT ur.tenant_id FROM public.utenti_ruoli ur WHERE ur.user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT ur.tenant_id FROM public.utenti_ruoli ur WHERE ur.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "payment_link_intents_staff_all" ON public.payment_link_intents;
CREATE POLICY "payment_link_intents_staff_all" ON public.payment_link_intents
  FOR ALL
  USING (
    tenant_id IN (SELECT ur.tenant_id FROM public.utenti_ruoli ur WHERE ur.user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT ur.tenant_id FROM public.utenti_ruoli ur WHERE ur.user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_outbox TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_link_intents TO authenticated;

CREATE OR REPLACE FUNCTION public.pm_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_fiscal_outbox_updated ON public.fiscal_outbox;
CREATE TRIGGER tr_fiscal_outbox_updated
  BEFORE UPDATE ON public.fiscal_outbox
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

DROP TRIGGER IF EXISTS tr_payment_link_intents_updated ON public.payment_link_intents;
CREATE TRIGGER tr_payment_link_intents_updated
  BEFORE UPDATE ON public.payment_link_intents
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

-- --- 08 seed PV default (dopo colonne slug/attivo) ---
INSERT INTO core.punti_vendita (tenant_id, nome, slug, attivo)
SELECT t.id, 'Sede principale', 'principale', true
FROM core.tenants t
WHERE NOT EXISTS (SELECT 1 FROM core.punti_vendita pv WHERE pv.tenant_id = t.id);

-- --- Vista Ordine + INSTEAD OF UPDATE (allineamento sql/sql_upgrade.sql) ---
ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS telefono_ritiro TEXT;
ALTER TABLE core.ingredienti ADD COLUMN IF NOT EXISTS prep_cucina BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE core.ingredienti ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE core.ingredienti ADD COLUMN IF NOT EXISTS colore TEXT;
ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS cucina_prep_stato JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.ordine_instead_of_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $tr$
BEGIN
  UPDATE core.ordini
  SET
    stato              = COALESCE(NEW.stato, OLD.stato),
    totale             = COALESCE(NEW.totale, OLD.totale),
    note               = COALESCE(NEW.note, OLD.note),
    tipo_pagamento     = COALESCE(NEW.tipo_pagamento, OLD.tipo_pagamento),
    tipo_ordine        = COALESCE(NEW.tipo_ordine, OLD.tipo_ordine),
    nome_cliente       = COALESCE(NEW.nome_cliente, OLD.nome_cliente),
    telefono_ritiro    = COALESCE(NEW.telefono_ritiro, OLD.telefono_ritiro),
    orario_ritiro      = COALESCE(NEW.orario_ritiro, OLD.orario_ritiro),
    indirizzo_consegna = COALESCE(NEW.indirizzo_consegna, OLD.indirizzo_consegna),
    consegna_lng       = COALESCE(NEW.consegna_lng, OLD.consegna_lng),
    consegna_lat       = COALESCE(NEW.consegna_lat, OLD.consegna_lat),
    pagamento_dettaglio = COALESCE(NEW.pagamento_dettaglio, OLD.pagamento_dettaglio),
    stato_consegna     = COALESCE(NEW.stato_consegna, OLD.stato_consegna),
    punto_vendita_id   = COALESCE(NEW.punto_vendita_id, OLD.punto_vendita_id),
    turno_operatori_id = COALESCE(NEW.turno_operatori_id, OLD.turno_operatori_id),
    rider_id           = COALESCE(NEW.rider_id, OLD.rider_id),
    turno_rider_id     = COALESCE(NEW.turno_rider_id, OLD.turno_rider_id),
    percorso_attivo_id = COALESCE(NEW.percorso_attivo_id, OLD.percorso_attivo_id),
    stato_delivery     = COALESCE(NEW.stato_delivery, OLD.stato_delivery),
    assegnato_rider_at = COALESCE(NEW.assegnato_rider_at, OLD.assegnato_rider_at),
    ritiro_bancone_rider_at = COALESCE(NEW.ritiro_bancone_rider_at, OLD.ritiro_bancone_rider_at),
    consegna_effettiva_at = COALESCE(NEW.consegna_effettiva_at, OLD.consegna_effettiva_at),
    cucina_prep_stato  = COALESCE(NEW.cucina_prep_stato, OLD.cucina_prep_stato),
    updated_at         = now()
  WHERE id = OLD.id
    AND tenant_id IN (
      SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
      UNION
      SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
      UNION
      SELECT rr.tenant_id FROM core.rider rr
      WHERE rr.auth_user_id = auth.uid()
        AND COALESCE(rr.attivo, true) IS NOT FALSE
        AND rr.deleted_at IS NULL
    );
  RETURN NEW;
END;
$tr$;

DROP VIEW IF EXISTS public."Ordine" CASCADE;

CREATE VIEW public."Ordine" AS
  SELECT
    id,
    numero,
    stato,
    totale,
    note,
    tipo_pagamento,
    tipo_ordine,
    nome_cliente,
    telefono_ritiro,
    orario_ritiro,
    indirizzo_consegna,
    consegna_lng,
    consegna_lat,
    pagamento_dettaglio,
    stato_consegna,
    punto_vendita_id,
    turno_operatori_id,
    rider_id,
    turno_rider_id,
    percorso_attivo_id,
    stato_delivery,
    assegnato_rider_at,
    ritiro_bancone_rider_at,
    consegna_effettiva_at,
    cucina_prep_stato,
    tenant_id AS "tenantId",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    deleted_at AS "deletedAt"
  FROM core.ordini
  WHERE tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
    UNION
    SELECT rr.tenant_id FROM core.rider rr
    WHERE rr.auth_user_id = auth.uid()
      AND COALESCE(rr.attivo, true) IS NOT FALSE
      AND rr.deleted_at IS NULL
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public."Ordine" TO authenticated;

DROP TRIGGER IF EXISTS ordine_instead_of_update_trigger ON public."Ordine";
CREATE TRIGGER ordine_instead_of_update_trigger
  INSTEAD OF UPDATE ON public."Ordine"
  FOR EACH ROW
  EXECUTE FUNCTION public.ordine_instead_of_update();
-- =============================================================================
-- FINE CONSOLIDAMENTO sql/modules + sql_upgrade (append)
-- =============================================================================

-- =============================================================================
-- RLS core + public hardening (allineato a sql/sql_upgrade.sql — 2026-04-11)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pm_core_tenant_access(p_tenant uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public, core
AS $fn$
BEGIN
  IF p_tenant IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur_sa
    WHERE ur_sa.user_id = auth.uid()
      AND COALESCE(ur_sa.attivo, true) IS NOT FALSE
      AND lower(trim(COALESCE(ur_sa.ruolo, ''))) = 'superadmin'
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND COALESCE(ur.attivo, true) IS NOT FALSE
      AND ur.tenant_id = p_tenant
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clienti c
    WHERE c.id = auth.uid()
      AND c.tenant_id = p_tenant
  ) THEN
    RETURN true;
  END IF;

  IF to_regclass('core.rider') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM core.rider rr
      WHERE rr.auth_user_id = auth.uid()
        AND COALESCE(rr.attivo, true) IS NOT FALSE
        AND rr.deleted_at IS NULL
        AND rr.tenant_id = p_tenant
    ) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$fn$;

COMMENT ON FUNCTION public.pm_core_tenant_access(uuid) IS
  'RLS core: true se auth.uid() è superadmin, staff/cliente del tenant, o rider (core.rider.auth_user_id).';

REVOKE ALL ON FUNCTION public.pm_core_tenant_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_core_tenant_access(uuid) TO authenticated;

ALTER TABLE core.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolate_by_tenant ON core.tenants;
DROP POLICY IF EXISTS pm_core_tenants_auth_tenant ON core.tenants;
CREATE POLICY pm_core_tenants_auth_tenant ON core.tenants
  FOR ALL
  TO authenticated
  USING (public.pm_core_tenant_access(id))
  WITH CHECK (public.pm_core_tenant_access(id));

ALTER TABLE core.prodotti ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolate_by_tenant ON core.prodotti;
DROP POLICY IF EXISTS pm_core_prodotti_auth_tenant ON core.prodotti;
CREATE POLICY pm_core_prodotti_auth_tenant ON core.prodotti
  FOR ALL
  TO authenticated
  USING (public.pm_core_tenant_access(tenant_id))
  WITH CHECK (public.pm_core_tenant_access(tenant_id));
DROP POLICY IF EXISTS anon_select_prodotti_menu_pubblico ON core.prodotti;
CREATE POLICY anon_select_prodotti_menu_pubblico ON core.prodotti
  FOR SELECT
  TO anon
  USING (
    deleted_at IS NULL
    AND (attivo = true OR attivo IS NULL)
    AND (visibile_online = true OR visibile_online IS NULL)
  );

DO $$
DECLARE
  r record;
  pol text;
BEGIN
  FOR r IN
    SELECT c.oid, c.relname AS tname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'core'
      AND c.relkind = 'r'
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns col
        WHERE col.table_schema = 'core'
          AND col.table_name = c.relname
          AND col.column_name = 'tenant_id'
      )
      AND c.relname <> 'prodotti'
    ORDER BY c.relname
  LOOP
    pol := 'pm_core_' || replace(r.tname, '-', '_') || '_auth_tenant';
    EXECUTE format('ALTER TABLE core.%I ENABLE ROW LEVEL SECURITY', r.tname);
    EXECUTE format('DROP POLICY IF EXISTS isolate_by_tenant ON core.%I', r.tname);
    EXECUTE format('DROP POLICY IF EXISTS %I ON core.%I', pol, r.tname);
    EXECUTE format(
      'CREATE POLICY %I ON core.%I FOR ALL TO authenticated USING (public.pm_core_tenant_access(tenant_id)) WITH CHECK (public.pm_core_tenant_access(tenant_id))',
      pol,
      r.tname
    );
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('core.consegna_percorso_ordine') IS NULL
     OR to_regclass('core.consegna_percorso') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE core.consegna_percorso_ordine ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS pm_core_consegna_percorso_ordine_auth ON core.consegna_percorso_ordine;
  CREATE POLICY pm_core_consegna_percorso_ordine_auth ON core.consegna_percorso_ordine
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM core.consegna_percorso cp
        WHERE cp.id = consegna_percorso_ordine.percorso_id
          AND public.pm_core_tenant_access(cp.tenant_id)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM core.consegna_percorso cp
        WHERE cp.id = consegna_percorso_ordine.percorso_id
          AND public.pm_core_tenant_access(cp.tenant_id)
      )
    );
END $$;

DO $$
BEGIN
  IF to_regclass('core.rider_posizione') IS NULL OR to_regclass('core.rider') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE core.rider_posizione ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS pm_core_rider_posizione_auth ON core.rider_posizione;
  CREATE POLICY pm_core_rider_posizione_auth ON core.rider_posizione
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM core.rider rr
        WHERE rr.id = rider_posizione.rider_id
          AND public.pm_core_tenant_access(rr.tenant_id)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM core.rider rr
        WHERE rr.id = rider_posizione.rider_id
          AND public.pm_core_tenant_access(rr.tenant_id)
      )
    );
END $$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND (
        tablename = '_prisma_migrations'
        OR tablename LIKE '%\_backup' ESCAPE '\'
        OR tablename LIKE '%\_backup\_%' ESCAPE '\'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', r.tablename);
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.ingrediente_allergeni') IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ingrediente_allergeni'
      AND column_name = 'tenant_id'
  ) THEN
    RAISE NOTICE 'public.ingrediente_allergeni senza tenant_id: salto RLS pm_public_ingrediente_allergeni_tenant.';
    RETURN;
  END IF;
  ALTER TABLE public.ingrediente_allergeni ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS pm_public_ingrediente_allergeni_tenant ON public.ingrediente_allergeni;
  CREATE POLICY pm_public_ingrediente_allergeni_tenant ON public.ingrediente_allergeni
    FOR ALL
    TO authenticated
    USING (public.pm_core_tenant_access(tenant_id))
    WITH CHECK (public.pm_core_tenant_access(tenant_id));
END $$;

DO $$
BEGIN
  IF to_regclass('public."User"') IS NULL THEN
    RETURN;
  END IF;
  REVOKE ALL ON TABLE public."User" FROM anon, authenticated;
END $$;

DO $$
DECLARE
  r record;
  pol text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'admin') THEN
    RETURN;
  END IF;
  FOR r IN
    SELECT c.relname AS tname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'admin'
      AND c.relkind = 'r'
      AND c.relrowsecurity
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'admin' AND tablename = r.tname
    ) THEN
      CONTINUE;
    END IF;
    pol := 'pm_admin_' || replace(r.tname, '-', '_') || '_superadmin';
    EXECUTE format($f$
      CREATE POLICY %I ON admin.%I
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.utenti_ruoli ur_sa
          WHERE ur_sa.user_id = auth.uid()
            AND COALESCE(ur_sa.attivo, true) IS NOT FALSE
            AND lower(trim(COALESCE(ur_sa.ruolo, ''))) = 'superadmin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.utenti_ruoli ur_sa
          WHERE ur_sa.user_id = auth.uid()
            AND COALESCE(ur_sa.attivo, true) IS NOT FALSE
            AND lower(trim(COALESCE(ur_sa.ruolo, ''))) = 'superadmin'
        )
      )
    $f$, pol, r.tname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('admin.tenants') IS NOT NULL THEN
    ALTER TABLE admin.tenants ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS pm_admin_tenants_tenant_access ON admin.tenants;
    CREATE POLICY pm_admin_tenants_tenant_access ON admin.tenants
      FOR ALL
      TO authenticated
      USING (public.pm_core_tenant_access(id))
      WITH CHECK (public.pm_core_tenant_access(id));
  END IF;

  IF to_regclass('admin.audit_global') IS NOT NULL THEN
    ALTER TABLE admin.audit_global ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS pm_admin_audit_global_access ON admin.audit_global;
    CREATE POLICY pm_admin_audit_global_access ON admin.audit_global
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.utenti_ruoli ur_sa
          WHERE ur_sa.user_id = auth.uid()
            AND COALESCE(ur_sa.attivo, true) IS NOT FALSE
            AND lower(trim(COALESCE(ur_sa.ruolo, ''))) = 'superadmin'
        )
        OR (
          tenant_id IS NOT NULL
          AND public.pm_core_tenant_access(tenant_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.utenti_ruoli ur_sa
          WHERE ur_sa.user_id = auth.uid()
            AND COALESCE(ur_sa.attivo, true) IS NOT FALSE
            AND lower(trim(COALESCE(ur_sa.ruolo, ''))) = 'superadmin'
        )
        OR (
          tenant_id IS NOT NULL
          AND public.pm_core_tenant_access(tenant_id)
        )
      );
  END IF;

  IF to_regclass('admin.piani_config') IS NOT NULL THEN
    ALTER TABLE admin.piani_config ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS pm_admin_piani_config_superadmin_only ON admin.piani_config;
    CREATE POLICY pm_admin_piani_config_superadmin_only ON admin.piani_config
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.utenti_ruoli ur_sa
          WHERE ur_sa.user_id = auth.uid()
            AND COALESCE(ur_sa.attivo, true) IS NOT FALSE
            AND lower(trim(COALESCE(ur_sa.ruolo, ''))) = 'superadmin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.utenti_ruoli ur_sa
          WHERE ur_sa.user_id = auth.uid()
            AND COALESCE(ur_sa.attivo, true) IS NOT FALSE
            AND lower(trim(COALESCE(ur_sa.ruolo, ''))) = 'superadmin'
        )
      );
  END IF;
END $$;

-- =============================================================================
-- CONSOLIDAMENTO FASE 0 (2026-04-18): merge sql_upgrade in baseline
-- (create_order hardening + web_cliente + delivery_mark_consegnato + prodotto_ingrediente)
-- Copia di lavoro: docs/sql/append_phase0_consolidamento_2026-04.sql
-- =============================================================================

DO $drop$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT format(
      '%I.%I(%s)',
      ns.nspname,
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid)
    ) AS sig
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace ns ON ns.oid = p.pronamespace
    WHERE p.proname = 'create_order_with_items'
      AND ns.nspname IN ('public', 'core')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END
$drop$;

CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_tenant_id UUID,
  p_totale NUMERIC,
  p_stato TEXT DEFAULT 'IN_PREPARAZIONE',
  p_items JSONB DEFAULT '[]'::JSONB,
  p_note TEXT DEFAULT NULL,
  p_tipo_pagamento TEXT DEFAULT NULL,
  p_tipo_ordine TEXT DEFAULT NULL,
  p_nome_cliente TEXT DEFAULT NULL,
  p_orario_ritiro TEXT DEFAULT NULL,
  p_indirizzo_consegna TEXT DEFAULT NULL,
  p_consegna_lng DOUBLE PRECISION DEFAULT NULL,
  p_consegna_lat DOUBLE PRECISION DEFAULT NULL,
  p_pagamento_dettaglio JSONB DEFAULT NULL,
  p_punto_vendita_id UUID DEFAULT NULL,
  p_turno_operatori_id INTEGER DEFAULT NULL,
  p_telefono_ritiro TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, admin
AS $fn$
DECLARE
  v_ordine_id UUID;
  v_numero INTEGER;
  v_item JSONB;
  v_stato core.stato_ordine;
  v_po jsonb;
  v_ring jsonb;
  v_inside boolean;
  v_is_staff_cassa boolean;
  v_has_tenant_access boolean;
  v_is_web_cliente boolean;
  v_turno_pv uuid;
  v_web_cliente uuid;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_obbligatorio';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;

  v_has_tenant_access := false;
  IF to_regproc('public.pm_core_tenant_access(uuid)') IS NOT NULL THEN
    SELECT public.pm_core_tenant_access(p_tenant_id) INTO v_has_tenant_access;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = p_tenant_id
        AND COALESCE(ur.attivo, true) = true
    ) INTO v_has_tenant_access;
  END IF;

  IF NOT COALESCE(v_has_tenant_access, false) THEN
    RAISE EXCEPTION 'tenant_non_autorizzato';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.clienti c
    WHERE c.id = auth.uid()
      AND c.tenant_id = p_tenant_id
  ) INTO v_is_web_cliente;

  IF v_is_web_cliente THEN
    IF lower(trim(COALESCE(p_tipo_ordine, ''))) NOT IN ('', 'delivery', 'negozio') THEN
      RAISE EXCEPTION 'tipo_ordine_non_valido';
    END IF;
    IF upper(trim(COALESCE(p_stato, 'IN_PREPARAZIONE'))) NOT IN ('IN_PREPARAZIONE') THEN
      RAISE EXCEPTION 'stato_ordine_non_valido';
    END IF;
  END IF;

  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_numero
  FROM core.ordini
  WHERE tenant_id = p_tenant_id;

  BEGIN
    v_stato := COALESCE(NULLIF(trim(p_stato), ''), 'IN_PREPARAZIONE')::core.stato_ordine;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_stato := 'IN_PREPARAZIONE'::core.stato_ordine;
  END;

  v_web_cliente := NULL;
  IF EXISTS (
    SELECT 1
    FROM public.clienti c
    WHERE c.id = auth.uid()
      AND c.tenant_id = p_tenant_id
  ) THEN
    v_web_cliente := auth.uid();
  END IF;

  v_po := NULL;
  IF to_regclass('admin.tenants') IS NOT NULL THEN
    SELECT t.parametri_operativi INTO v_po
    FROM admin.tenants t
    WHERE t.id = p_tenant_id
    LIMIT 1;
  END IF;
  IF v_po IS NULL AND to_regclass('core.tenants') IS NOT NULL THEN
    SELECT t.parametri_operativi INTO v_po
    FROM core.tenants t
    WHERE t.id = p_tenant_id
    LIMIT 1;
  END IF;

  v_ring := NULL;
  IF v_po IS NOT NULL
     AND (v_po->'consegna_area_poligono'->>'type') = 'Polygon'
     AND jsonb_typeof(v_po->'consegna_area_poligono'->'coordinates') = 'array'
     AND jsonb_array_length(v_po->'consegna_area_poligono'->'coordinates') >= 1
  THEN
    v_ring := v_po->'consegna_area_poligono'->'coordinates'->0;
  END IF;

  IF lower(trim(COALESCE(p_tipo_ordine, ''))) = 'delivery'
     AND v_ring IS NOT NULL
     AND jsonb_typeof(v_ring) = 'array'
     AND jsonb_array_length(v_ring) >= 4
  THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = p_tenant_id
        AND COALESCE(ur.attivo, true) = true
        AND (
          lower(trim(COALESCE(ur.ruolo, ''))) = 'cassa'
          OR COALESCE(ur.accesso_cassa, false) = true
        )
    ) INTO v_is_staff_cassa;

    IF NOT v_is_staff_cassa THEN
      IF p_consegna_lng IS NULL OR p_consegna_lat IS NULL THEN
        RAISE EXCEPTION 'Per la consegna a domicilio servono coordinate valide dell''indirizzo (verifica su mappa).';
      END IF;

      v_inside := public.pm_point_in_ring(p_consegna_lng, p_consegna_lat, v_ring);
      IF v_inside IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'L''indirizzo di consegna è fuori dall''area coperta dal locale.';
      END IF;
    END IF;
  END IF;

  IF p_turno_operatori_id IS NOT NULL THEN
    IF to_regclass('public.turni_operatori') IS NULL THEN
      RAISE EXCEPTION 'turni_operatori non disponibile sul database';
    END IF;
    SELECT t.punto_vendita_id INTO v_turno_pv
    FROM public.turni_operatori t
    WHERE t.id = p_turno_operatori_id
      AND t.tenant_id = p_tenant_id
      AND t.user_id = auth.uid()
      AND t.stato = 'aperto'
      AND t.chiuso_il IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'turno_non_valido';
    END IF;
    IF p_punto_vendita_id IS NOT NULL AND v_turno_pv IS DISTINCT FROM p_punto_vendita_id THEN
      RAISE EXCEPTION 'turno_punto_vendita_mismatch';
    END IF;
  END IF;

  INSERT INTO core.ordini (
    tenant_id,
    numero,
    stato,
    totale,
    note,
    tipo_pagamento,
    tipo_ordine,
    nome_cliente,
    telefono_ritiro,
    orario_ritiro,
    indirizzo_consegna,
    consegna_lng,
    consegna_lat,
    pagamento_dettaglio,
    punto_vendita_id,
    turno_operatori_id,
    web_cliente_user_id
  )
  VALUES (
    p_tenant_id,
    v_numero,
    v_stato,
    p_totale,
    NULLIF(trim(COALESCE(p_note, '')), ''),
    NULLIF(trim(COALESCE(p_tipo_pagamento, '')), ''),
    NULLIF(trim(COALESCE(p_tipo_ordine, '')), ''),
    NULLIF(trim(COALESCE(p_nome_cliente, '')), ''),
    NULLIF(trim(COALESCE(p_telefono_ritiro, '')), ''),
    NULLIF(trim(COALESCE(p_orario_ritiro, '')), ''),
    NULLIF(trim(COALESCE(p_indirizzo_consegna, '')), ''),
    p_consegna_lng,
    p_consegna_lat,
    p_pagamento_dettaglio,
    p_punto_vendita_id,
    p_turno_operatori_id,
    v_web_cliente
  )
  RETURNING id INTO v_ordine_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::JSONB))
  LOOP
    INSERT INTO core.riga_ordine (
      tenant_id,
      ordine_id,
      prodotto_id,
      quantita,
      prezzo,
      formato_nome,
      ingredienti_cottura_summary
    )
    VALUES (
      p_tenant_id,
      v_ordine_id,
      (v_item->>'prodotto_id')::UUID,
      GREATEST(1, COALESCE((v_item->>'quantita')::INTEGER, 1)),
      COALESCE((v_item->>'prezzo')::NUMERIC, 0),
      NULLIF(trim(COALESCE(v_item->>'formato_nome', '')), ''),
      NULLIF(trim(COALESCE(v_item->>'ingredienti_cottura_summary', '')), '')
    );
  END LOOP;

  RETURN v_ordine_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, JSONB, UUID, INTEGER, TEXT
) TO authenticated;

COMMENT ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, JSONB, UUID, INTEGER, TEXT
) IS
  'Crea ordine + righe. Hardening tenant + cliente web; web_cliente_user_id se auth è cliente del tenant; telefono_ritiro opzionale.';

-- Delivery: transizione CONSEGNATO atomica
CREATE OR REPLACE FUNCTION public.delivery_mark_consegnato(
  p_ordine_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $$
DECLARE
  v_tenant_id UUID;
  v_allowed BOOLEAN;
BEGIN
  IF p_ordine_id IS NULL THEN
    RAISE EXCEPTION 'ordine_id_obbligatorio';
  END IF;

  SELECT o.tenant_id
  INTO v_tenant_id
  FROM core.ordini o
  WHERE o.id = p_ordine_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'ordine_non_trovato';
  END IF;

  SELECT COALESCE(
    (
      SELECT EXISTS (
        SELECT 1
        FROM public.utenti_ruoli ur
        WHERE ur.user_id = auth.uid()
          AND ur.tenant_id = v_tenant_id
          AND COALESCE(ur.attivo, true) = true
          AND (
            lower(trim(COALESCE(ur.ruolo, ''))) IN (
              'delivery', 'pony', 'cassa', 'admin', 'amministratore', 'gestore'
            )
            OR COALESCE(ur.accesso_delivery, false) = true
            OR COALESCE(ur.accesso_pony, false) = true
            OR COALESCE(ur.accesso_cassa, false) = true
          )
      )
    ),
    false
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ruolo = 'superadmin'
  )
  OR EXISTS (
    SELECT 1
    FROM auth.users u
    INNER JOIN public.utenti_ruoli ur
      ON ur.user_id = u.id
     AND ur.tenant_id = v_tenant_id
     AND COALESCE(ur.attivo, true) = true
    WHERE u.id = auth.uid()
      AND lower(trim(COALESCE(u.email, ''))) = 'pizzaioli@pizzamanager.it'
  )
  INTO v_allowed;

  IF NOT COALESCE(v_allowed, false) THEN
    RAISE EXCEPTION 'non_autorizzato';
  END IF;

  UPDATE core.ordini o
  SET
    stato_consegna = 'CONSEGNATO',
    stato = 'CONSEGNATO'::core.stato_ordine,
    stato_delivery = 'CONSEGNATO'::core.stato_delivery,
    consegna_effettiva_at = COALESCE(o.consegna_effettiva_at, now()),
    updated_at = now()
  WHERE o.id = p_ordine_id
    AND o.tenant_id = v_tenant_id;

  IF to_regclass('core.ordine_consegna_evento') IS NOT NULL THEN
    INSERT INTO core.ordine_consegna_evento (tenant_id, ordine_id, tipo, payload, created_by)
    VALUES (v_tenant_id, p_ordine_id, 'delivery_mark_consegnato', '{}'::jsonb, auth.uid());
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delivery_mark_consegnato(UUID) TO authenticated;

COMMENT ON FUNCTION public.delivery_mark_consegnato(UUID) IS
  'Segna ordine CONSEGNATO (atomico). Consentito: ruoli delivery/pony/cassa/admin/amministratore/gestore, flag accesso_delivery/pony/cassa, superadmin piattaforma, account test pizzaioli@pizzamanager.it sul tenant.';

-- prodotto_ingrediente: colonna (se manca) + vincolo posizione_cottura + vista pubblica con trigger
ALTER TABLE core.prodotto_ingrediente
  ADD COLUMN IF NOT EXISTS posizione_cottura TEXT NOT NULL DEFAULT 'in_cottura';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prodotto_ingrediente_posizione_cottura_chk'
  ) THEN
    ALTER TABLE core.prodotto_ingrediente ADD CONSTRAINT prodotto_ingrediente_posizione_cottura_chk
      CHECK (posizione_cottura IN ('in_cottura', 'fuori_cottura', 'a_parte'));
  END IF;
END $$;

COMMENT ON COLUMN core.prodotto_ingrediente.posizione_cottura IS
  'Dove va messo l''ingrediente sulla pizza: in forno, dopo cottura, o servito a parte.';

DROP VIEW IF EXISTS public.prodotto_ingrediente CASCADE;

CREATE VIEW public.prodotto_ingrediente AS
  SELECT
    pi.id,
    pi.tenant_id,
    pi.prodotto_id,
    pi.ingrediente_id,
    pi.quantita,
    pi.ordine,
    pi.posizione_cottura
  FROM core.prodotto_ingrediente pi
  WHERE pi.tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );

GRANT SELECT, INSERT, DELETE ON public.prodotto_ingrediente TO authenticated;

CREATE OR REPLACE FUNCTION public.prodotto_ingrediente_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO core.prodotto_ingrediente (
    tenant_id,
    prodotto_id,
    ingrediente_id,
    quantita,
    ordine,
    posizione_cottura
  )
  VALUES (
    NEW.tenant_id,
    NEW.prodotto_id,
    NEW.ingrediente_id,
    COALESCE(NEW.quantita, 1),
    COALESCE(NEW.ordine, 0),
    COALESCE(NEW.posizione_cottura, 'in_cottura')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prodotto_ingrediente_insert_trigger ON public.prodotto_ingrediente;
CREATE TRIGGER prodotto_ingrediente_insert_trigger
  INSTEAD OF INSERT ON public.prodotto_ingrediente
  FOR EACH ROW EXECUTE FUNCTION public.prodotto_ingrediente_insert();

CREATE OR REPLACE FUNCTION public.prodotto_ingrediente_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM core.prodotto_ingrediente
  WHERE prodotto_id = OLD.prodotto_id
    AND tenant_id = OLD.tenant_id
    AND ingrediente_id = OLD.ingrediente_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prodotto_ingrediente_delete_trigger ON public.prodotto_ingrediente;
CREATE TRIGGER prodotto_ingrediente_delete_trigger
  INSTEAD OF DELETE ON public.prodotto_ingrediente
  FOR EACH ROW EXECUTE FUNCTION public.prodotto_ingrediente_delete();
