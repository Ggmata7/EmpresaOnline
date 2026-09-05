-- Clicks are recorded by the server's service role. Prevent unauthenticated event injection.
grant insert on public.cliques to service_role;
revoke insert on public.cliques from anon, authenticated;
