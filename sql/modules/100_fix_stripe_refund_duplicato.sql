-- Modulo 100 — Fix: rimborso Stripe registrato due volte
--
-- Bug trovato in audit (stress test / analisi sistematica dei flussi di pagamento, richiesta
-- esplicita prima di andare in produzione): edge_stripe_append_refund faceva un append puro
-- nell'array online_payment.refunds, senza controllare se quel refund_id era già presente.
--
-- Il rimborso avviato dallo staff (supabase/functions/payment-stripe-refund/index.ts) chiama
-- questa RPC con l'id reale del refund appena creato su Stripe. Subito dopo Stripe invia
-- comunque l'evento webhook charge.refunded per lo STESSO refund (comportamento normale: ogni
-- azione Stripe genera anche il webhook corrispondente), e il webhook
-- (supabase/functions/payment-stripe-webhook/index.ts) chiama di nuovo questa stessa RPC con lo
-- stesso refund_id — il rimborso finiva registrato DUE VOLTE nell'array, gonfiando il totale
-- rimborsato per qualunque report/audit futuro che sommi online_payment.refunds[].amount_cent.
--
-- edge_stripe_mark_payment_succeeded (verificata nello stesso audit) NON ha questo problema: è
-- un SET di stato (merge jsonb sostitutivo), naturalmente idempotente anche se chiamata due
-- volte con lo stesso payment_intent_id — il bug era specifico al pattern "append ad array".
--
-- Applicato in produzione (progetto flfhrwzlrftuhkrfwzse) il 2026-08-28 via
-- mcp__supabase__apply_migration (nome migrazione: fix_stripe_refund_duplicato). Verificato con
-- un test isolato della logica di idempotenza (jsonb_array_elements + exists), non con un
-- pagamento reale (nessun ordine con pagamento Stripe presente nel DB al momento dell'audit).
create or replace function public.edge_stripe_append_refund(p_payment_intent_id text, p_refund_id text, p_amount_cent integer)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'core'
as $function$
declare
  v_id uuid;
  v_arr jsonb;
  v_gia_presente boolean;
begin
  if coalesce((auth.jwt())->>'role', '') is distinct from 'service_role' then
    raise exception 'forbidden';
  end if;

  select o.id, coalesce(o.online_payment->'refunds', '[]'::jsonb)
  into v_id, v_arr
  from core.ordini o
  where (o.online_payment->>'stripe_payment_intent_id') is not distinct from p_payment_intent_id
  limit 1;

  if v_id is null then
    return null;
  end if;

  -- Idempotenza: se questo refund_id è già registrato (rimborso avviato da staff + webhook
  -- Stripe per lo stesso evento, o un retry del webhook), non aggiungerlo di nuovo.
  select exists (
    select 1 from jsonb_array_elements(v_arr) elem
    where elem->>'refund_id' = p_refund_id
  ) into v_gia_presente;

  if v_gia_presente then
    return v_id;
  end if;

  v_arr := coalesce(v_arr, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'refund_id', p_refund_id,
      'amount_cent', p_amount_cent,
      'at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
  );

  update core.ordini o
  set
    online_payment = coalesce(o.online_payment, '{}'::jsonb) || jsonb_build_object('refunds', v_arr),
    updated_at = now()
  where o.id = v_id;

  return v_id;
end;
$function$;
