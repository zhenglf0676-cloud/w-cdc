-- The knowledge library is global for admins. Enterprises see public documents
-- and their own documents only. Legacy park-scoped documents remain admin-only.
-- Uploads and reviews still use server-side role checks; only published,
-- currently valid rows can participate in the invoker-based search RPC.
drop policy if exists assistant_knowledge_published_read on public.assistant_knowledge_documents;
create policy assistant_knowledge_published_read on public.assistant_knowledge_documents
  for select to authenticated using (
    status = 'published'
    and (valid_from is null or valid_from <= (now() at time zone 'Asia/Shanghai')::date)
    and (valid_until is null or valid_until >= (now() at time zone 'Asia/Shanghai')::date)
    and (
      visibility = 'public'
      or exists (
        select 1 from public.profiles p
        where p.user_id = (select auth.uid())
          and (
            p.role = 'admin'
            or (p.role = 'enterprise' and visibility = 'enterprise'
                and company_user_id = p.user_id::text)
          )
      )
    )
  );
