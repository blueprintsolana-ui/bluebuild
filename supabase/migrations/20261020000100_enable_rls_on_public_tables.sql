-- Supabase flagged public tables without row level security (rls_disabled_in_public) and
-- sensitive columns reachable through the public API (sensitive_columns_exposed).
--
-- Only the backend reads these tables, with the service-role key, which bypasses RLS. The web
-- app never talks to Supabase directly, so the anon and authenticated roles need no access.
-- Enabling RLS with no policies plus revoking those roles closes the public API path without
-- changing anything for the backend. Safe to run more than once.

do $$
declare
  table_name text;
  -- Tables created by earlier migrations without RLS.
  known_tables text[] := array[
    'component_templates',
    'generated_projects',
    'a2a_jobs',
    'alpha_signups',
    'project_chats',
    'user_api_keys',
    'project_saves',
    'project_remixes',
    'opencode_sessions',
    'opencode_commands',
    'opencode_events'
  ];
begin
  foreach table_name in array known_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('revoke all on table public.%I from anon, authenticated', table_name);
      execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
    end if;
  end loop;

  -- Safety net: any other public table without RLS, including ones made by hand in the dashboard.
  for table_name in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
  end loop;
end
$$;
