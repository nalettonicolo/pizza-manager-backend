-- Modulo 93 — Stima tempo di attesa per l'agente AI cliente-facing
--
-- Nasce dalla richiesta: un cliente sul sito chiede "a che ora posso avere 2 pizze a domicilio?"
-- e vuole una risposta subito, SENZA dover compilare e inserire un ordine vero solo per scoprire
-- l'orario. La stima usa la stessa regola di capacità già in produzione in
-- assert_slot_capacity_for_ordine (parametri_operativi.pizze_ogni_15_min): stesso parametro,
-- stessa logica di conteggio per slot da 15 minuti — così la stima resta coerente con cosa succede
-- davvero quando l'ordine viene poi creato per quello slot.
--
-- Pensata per essere chiamata dal tool "stima_tempo_attesa" della nuova modalità 'cliente'
-- dell'agente AI (vedi supabase/functions/agente-chat/index.ts) — il modello non calcola mai
-- l'orario da solo, lo chiede a questa funzione e si limita a spiegarlo in linguaggio naturale.
-- Sola lettura (STABLE), nessun ordine viene creato o modificato.
--
-- Applicato in produzione (progetto flfhrwzlrftuhkrfwzse) il 2026-08-28 via
-- mcp__supabase__apply_migration (nome migrazione: create_pm_stima_tempo_attesa).
create or replace function public.pm_stima_tempo_attesa(
  p_tenant_id uuid,
  p_quantita_pizze int default 1,
  p_tipo_ordine text default 'ritiro'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, core, admin
as $$
declare
  v_po jsonb;
  v_max int;
  v_extra_delivery_min int;
  v_now timestamptz := now();
  v_quantita int := greatest(1, coalesce(p_quantita_pizze, 1));
  v_tipo text := lower(trim(coalesce(p_tipo_ordine, 'ritiro')));
  v_minuti_base int;
  v_slot_start timestamptz;
  v_existing int;
  v_tentativi int := 0;
  v_max_tentativi int := 48; -- fino a 12 ore avanti, oltre non ha senso stimare "oggi"
  v_slot_hhmi text;
  v_orario_finale timestamptz;
begin
  if v_tipo not in ('ritiro', 'delivery') then
    v_tipo := 'ritiro';
  end if;

  select t.parametri_operativi into v_po from admin.tenants t where t.id = p_tenant_id;
  v_po := coalesce(v_po, '{}'::jsonb);
  v_max := greatest(1, round(coalesce((v_po->>'pizze_ogni_15_min')::numeric, 8))::int);
  v_extra_delivery_min := greatest(0, coalesce((v_po->>'tempo_consegna_extra_min')::int, 15));

  -- Primo slot possibile: adesso + 15 minuti di margine di preparazione minima, arrotondato al
  -- quarto d'ora successivo (stessa granularità degli slot usati per bloccare gli ordini).
  v_minuti_base := extract(hour from (v_now + interval '15 minutes') at time zone 'Europe/Rome')::int * 60
                  + extract(minute from (v_now + interval '15 minutes') at time zone 'Europe/Rome')::int;
  v_minuti_base := (ceil(v_minuti_base / 15.0)::int) * 15;
  v_slot_start := ((v_now at time zone 'Europe/Rome')::date + make_time(least(v_minuti_base, 1439) / 60, least(v_minuti_base, 1439) % 60, 0)) at time zone 'Europe/Rome';

  loop
    v_slot_hhmi := to_char(v_slot_start at time zone 'Europe/Rome', 'HH24:MI');

    select coalesce(sum(ro.quantita), 0)::int
    into v_existing
    from core.ordini o
    join core.riga_ordine ro
      on ro.ordine_id = o.id
     and ro.tenant_id = o.tenant_id
    where o.tenant_id = p_tenant_id
      and o.stato::text not in ('ANNULLATO')
      and (o.created_at at time zone 'Europe/Rome')::date = (now() at time zone 'Europe/Rome')::date
      and public.pm_orario_ritiro_to_slot_key(o.orario_ritiro) = public.pm_orario_ritiro_to_slot_key(v_slot_hhmi);

    exit when v_existing + v_quantita <= v_max;

    v_slot_start := v_slot_start + interval '15 minutes';
    v_tentativi := v_tentativi + 1;
    exit when v_tentativi >= v_max_tentativi;
  end loop;

  if v_tentativi >= v_max_tentativi then
    return jsonb_build_object(
      'disponibile', false,
      'tipo_ordine', v_tipo,
      'quantita_pizze', v_quantita,
      'nota', 'Nessuno slot libero nelle prossime ore: il locale è molto pieno oggi.'
    );
  end if;

  v_orario_finale := v_slot_start + (case when v_tipo = 'delivery' then make_interval(mins => v_extra_delivery_min) else interval '0' end);

  return jsonb_build_object(
    'disponibile', true,
    'tipo_ordine', v_tipo,
    'quantita_pizze', v_quantita,
    'orario_pronto', to_char(v_slot_start at time zone 'Europe/Rome', 'HH24:MI'),
    'orario_stimato', to_char(v_orario_finale at time zone 'Europe/Rome', 'HH24:MI')
  );
end;
$$;

comment on function public.pm_stima_tempo_attesa(uuid, int, text) is
  'Stima "a che ora posso avere N pizze?" senza creare un ordine reale. Usa la stessa regola di capacità (parametri_operativi.pizze_ogni_15_min) di assert_slot_capacity_for_ordine, per restare coerente con la validazione reale al momento dell''ordine. Chiamata dal tool stima_tempo_attesa dell''agente AI (modalità cliente).';

grant execute on function public.pm_stima_tempo_attesa(uuid, int, text) to anon, authenticated, service_role;
