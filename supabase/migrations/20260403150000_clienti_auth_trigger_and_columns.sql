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
