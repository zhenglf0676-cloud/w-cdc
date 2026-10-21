-- Apply in the Supabase SQL editor before enabling document uploads.
create schema if not exists extensions;
create extension if not exists vector with schema extensions;

create table if not exists public.assistant_knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 2 and 180),
  version text not null default '1.0',
  visibility text not null check (visibility in ('public', 'park', 'enterprise')),
  park_name text,
  company_user_id text,
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected', 'archived')),
  source_url text,
  file_name text not null,
  storage_path text,
  content text not null,
  embedding_status text not null default 'keyword' check (embedding_status in ('keyword', 'hybrid')),
  uploaded_by text not null,
  reviewed_by text,
  review_note text,
  valid_from date,
  valid_until date,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint assistant_knowledge_scope check (
    (visibility = 'public' and park_name is null and company_user_id is null) or
    (visibility = 'park' and park_name is not null and company_user_id is null) or
    (visibility = 'enterprise' and park_name is not null and company_user_id is not null)
  ),
  constraint assistant_knowledge_dates check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

create table if not exists public.assistant_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.assistant_knowledge_documents(id) on delete cascade,
  ordinal integer not null,
  section text not null,
  content text not null,
  embedding extensions.vector(1024),
  search_vector tsvector generated always as (to_tsvector('simple', content)) stored,
  unique (document_id, ordinal)
);

create index if not exists assistant_knowledge_docs_scope_idx on public.assistant_knowledge_documents(status, visibility, park_name, company_user_id);
create index if not exists assistant_knowledge_chunks_document_idx on public.assistant_knowledge_chunks(document_id);
create index if not exists assistant_knowledge_chunks_text_idx on public.assistant_knowledge_chunks using gin(search_vector);
create index if not exists assistant_knowledge_chunks_vector_idx on public.assistant_knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);

alter table public.assistant_knowledge_documents enable row level security;
alter table public.assistant_knowledge_chunks enable row level security;

drop policy if exists assistant_knowledge_published_read on public.assistant_knowledge_documents;
create policy assistant_knowledge_published_read on public.assistant_knowledge_documents
  for select to authenticated using (
    status = 'published' and
    (valid_from is null or valid_from <= (now() at time zone 'Asia/Shanghai')::date) and
    (valid_until is null or valid_until >= (now() at time zone 'Asia/Shanghai')::date) and
    (visibility = 'public' or exists (
      select 1 from public.profiles p where p.user_id = auth.uid()::text and
      p.park_name = assistant_knowledge_documents.park_name and
      ((visibility = 'park' and p.role in ('admin', 'enterprise')) or
       (visibility = 'enterprise' and (p.user_id = company_user_id or p.role = 'admin')))
    ))
  );

drop policy if exists assistant_knowledge_chunks_read on public.assistant_knowledge_chunks;
create policy assistant_knowledge_chunks_read on public.assistant_knowledge_chunks
  for select to authenticated using (
    exists (select 1 from public.assistant_knowledge_documents d where d.id = document_id)
  );

grant select on public.assistant_knowledge_documents, public.assistant_knowledge_chunks to authenticated;
-- Uploads and reviews use the server service role after verifying the logged-in user's profile.

create or replace function public.assistant_search_knowledge(
  p_query text,
  p_terms text[] default '{}',
  p_embedding extensions.vector(1024) default null,
  p_limit integer default 5
)
returns table (
  id uuid, document_id uuid, title text, section text, version text,
  excerpt text, source_url text, file_name text, has_file boolean, score double precision
)
language sql stable security invoker set search_path = public, extensions
as $$
  select c.id, d.id, d.title, c.section, d.version, c.content, d.source_url, d.file_name, d.storage_path is not null,
    (coalesce(ts_rank_cd(c.search_vector, websearch_to_tsquery('simple', left(p_query, 120))), 0) * 3
     + coalesce((select sum(case when length(term) >= 2 and position(lower(term) in lower(c.content || ' ' || d.title)) > 0 then 1.5 else 0 end)
                 from unnest(p_terms) term), 0)
     + case when p_embedding is not null and c.embedding is not null
            then greatest(0, 1 - (c.embedding <=> p_embedding)) else 0 end)::double precision as score
  from public.assistant_knowledge_chunks c
  join public.assistant_knowledge_documents d on d.id = c.document_id
  where d.status = 'published'
    and (d.valid_from is null or d.valid_from <= (now() at time zone 'Asia/Shanghai')::date)
    and (d.valid_until is null or d.valid_until >= (now() at time zone 'Asia/Shanghai')::date)
    and (c.search_vector @@ websearch_to_tsquery('simple', left(p_query, 120))
      or exists (select 1 from unnest(p_terms) term where length(term) >= 2
                 and position(lower(term) in lower(c.content || ' ' || d.title)) > 0)
      or (p_embedding is not null and c.embedding is not null and 1 - (c.embedding <=> p_embedding) >= 0.52))
  order by score desc, d.created_at desc, c.ordinal asc
  limit least(greatest(p_limit, 1), 6)
$$;

revoke all on function public.assistant_search_knowledge(text, text[], extensions.vector, integer) from public, anon;
grant execute on function public.assistant_search_knowledge(text, text[], extensions.vector, integer) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assistant-knowledge', 'assistant-knowledge', false, 4194304,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown'])
on conflict (id) do nothing;
