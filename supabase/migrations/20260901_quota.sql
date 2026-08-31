-- Quota state lives on the profile: same lifecycle as the account, backed up
-- with it, and the natural home for the paid passes added later (C13).
alter table public.profiles
  add column if not exists quota_units_today integer not null default 0,
  add column if not exists quota_day date not null default current_date;

-- Anonymous callers have no profile. Keyed by an HMAC of the client IP so the
-- table never stores an address in clear.
create table if not exists public.guest_quota (
  fingerprint text primary key,
  quota_units_today integer not null default 0,
  quota_day date not null default current_date,
  updated_at timestamptz not null default now()
);

alter table public.guest_quota enable row level security;
-- No policy: only the service role reaches this table.

create index if not exists guest_quota_day_idx on public.guest_quota (quota_day);

/**
 * Atomically consume `p_cost` units for a user, resetting the counter when the
 * day rolls over. Returns the number of units remaining, or -1 when the request
 * would exceed the limit (in which case NOTHING is consumed).
 *
 * The whole decision is a single UPDATE ... RETURNING so two concurrent requests
 * can never both pass a limit of one.
 */
create or replace function public.consume_quota(
  p_user uuid,
  p_cost integer,
  p_limit integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
begin
  update public.profiles
     set quota_units_today =
           case when quota_day = current_date then quota_units_today + p_cost
                else p_cost end,
         quota_day = current_date
   where id = p_user
     and (quota_day <> current_date or quota_units_today + p_cost <= p_limit)
  returning p_limit - quota_units_today into v_remaining;

  return coalesce(v_remaining, -1);
end;
$$;

create or replace function public.consume_guest_quota(
  p_fingerprint text,
  p_cost integer,
  p_limit integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
begin
  insert into public.guest_quota (fingerprint, quota_units_today, quota_day)
       values (p_fingerprint, p_cost, current_date)
  on conflict (fingerprint) do update
     set quota_units_today =
           case when guest_quota.quota_day = current_date
                then guest_quota.quota_units_today + p_cost
                else p_cost end,
         quota_day = current_date,
         updated_at = now()
   where guest_quota.quota_day <> current_date
      or guest_quota.quota_units_today + p_cost <= p_limit
  returning p_limit - guest_quota.quota_units_today into v_remaining;

  return coalesce(v_remaining, -1);
end;
$$;

revoke execute on function public.consume_quota(uuid, integer, integer) from anon, authenticated;
revoke execute on function public.consume_guest_quota(text, integer, integer) from anon, authenticated;
