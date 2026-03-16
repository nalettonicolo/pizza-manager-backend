


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
