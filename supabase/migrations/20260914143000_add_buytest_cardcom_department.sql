-- Allow BuyTest to store a non-secret Cardcom department identifier alongside
-- the existing server-only Cardcom configuration. The value stays in Vault and
-- is read only by the payment Edge Function through the service-role RPC.

create or replace function public.buytest_set_private_config(p_name text, p_value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_name not in (
    'cardcom_terminal_number',
    'cardcom_api_name',
    'cardcom_api_password',
    'cardcom_payments_enabled',
    'cardcom_buytest_department_id',
    'buytest_cardcom_setup_token_hash'
  ) then
    raise exception 'unsupported secret name' using errcode = '22023';
  end if;
  if p_value is null or length(p_value) < 1 or length(p_value) > 500 then
    raise exception 'invalid secret value' using errcode = '22023';
  end if;
  select id into v_id from vault.decrypted_secrets where name = p_name limit 1;
  if v_id is null then
    perform vault.create_secret(p_value, p_name, 'BuyTest private configuration');
  else
    perform vault.update_secret(v_id, p_value, p_name, 'BuyTest private configuration');
  end if;
end;
$$;

revoke all on function public.buytest_set_private_config(text, text) from anon, authenticated, public;
grant execute on function public.buytest_set_private_config(text, text) to service_role;
