-- Supabase Security Advisor: function_search_path_mutable.
-- The check only calls built-in jsonb and text functions (always found in pg_catalog), so an empty
-- search_path is safe and stops a caller's search_path from changing what it resolves.
alter function public.generated_project_visual_sequence_keys_match_project_id(jsonb, text)
  set search_path = '';
