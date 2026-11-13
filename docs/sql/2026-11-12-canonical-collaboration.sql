-- Prevent already-open pre-upgrade clients from stripping the durable Yjs
-- history after a project has migrated. No project data, RLS or grants change.
begin;

create or replace function public.propflow_require_canonical_history()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.doc #>> '{_collab,version}' = '1'
     and (new.doc #>> '{_collab,version}') is distinct from '1' then
    raise exception 'This project uses a newer collaboration format. Reload PropFlow before saving.';
  end if;
  return new;
end;
$$;

create or replace trigger propflow_require_canonical_history
before update of doc on public.project_documents
for each row execute function public.propflow_require_canonical_history();

commit;

-- Rollback if reverting the frontend to a pre-canonical version:
-- drop trigger propflow_require_canonical_history on public.project_documents;
-- drop function public.propflow_require_canonical_history();
