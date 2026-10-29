-- Rank visible knowledge chunks with both literal matches and 1024-dimensional
-- semantic similarity. Both candidate queries run with the caller's RLS before
-- ranking, so a private chunk cannot influence another user's top results.
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
  with keyword_matches as (
    select c.id,
      coalesce(ts_rank_cd(c.search_vector, websearch_to_tsquery('simple', left(p_query, 120))), 0) * 3
      + coalesce((select sum(case when length(term) >= 2 and
          position(lower(term) in lower(c.content || ' ' || d.title)) > 0 then 1.5 else 0 end)
        from unnest(p_terms) term), 0) as relevance
    from public.assistant_knowledge_chunks c
    join public.assistant_knowledge_documents d on d.id = c.document_id
    where d.status = 'published'
      and (d.valid_from is null or d.valid_from <= (now() at time zone 'Asia/Shanghai')::date)
      and (d.valid_until is null or d.valid_until >= (now() at time zone 'Asia/Shanghai')::date)
      and (c.search_vector @@ websearch_to_tsquery('simple', left(p_query, 120))
        or exists (select 1 from unnest(p_terms) term where length(term) >= 2
          and position(lower(term) in lower(c.content || ' ' || d.title)) > 0))
  ), keyword_ranked as (
    select id, row_number() over (order by relevance desc, id) as position
    from keyword_matches
    order by relevance desc, id
    limit 30
  ), semantic_ranked as (
    select c.id, row_number() over (order by c.embedding <=> p_embedding, c.id) as position
    from public.assistant_knowledge_chunks c
    join public.assistant_knowledge_documents d on d.id = c.document_id
    where p_embedding is not null and c.embedding is not null
      and 1 - (c.embedding <=> p_embedding) >= 0.52
      and d.status = 'published'
      and (d.valid_from is null or d.valid_from <= (now() at time zone 'Asia/Shanghai')::date)
      and (d.valid_until is null or d.valid_until >= (now() at time zone 'Asia/Shanghai')::date)
    order by c.embedding <=> p_embedding, c.id
    limit 30
  ), fused as (
    select coalesce(k.id, s.id) as chunk_id,
      (coalesce(1.2 / (60 + k.position), 0) + coalesce(1.0 / (60 + s.position), 0))::double precision as relevance
    from keyword_ranked k full join semantic_ranked s using (id)
  ), ranked as (
    select c.id, d.id as document_id, d.title, c.section, d.version,
      c.content as excerpt, d.source_url, d.file_name, d.storage_path is not null as has_file,
      f.relevance as score,
      row_number() over (partition by d.id order by f.relevance desc, c.ordinal) as document_position,
      d.created_at, c.ordinal
    from fused f
    join public.assistant_knowledge_chunks c on c.id = f.chunk_id
    join public.assistant_knowledge_documents d on d.id = c.document_id
  )
  select r.id, r.document_id, r.title, r.section, r.version,
    r.excerpt, r.source_url, r.file_name, r.has_file, r.score
  from ranked r
  where r.document_position <= 2
  order by r.score desc, r.created_at desc, r.ordinal
  limit least(greatest(coalesce(p_limit, 5), 1), 6)
$$;

revoke all on function public.assistant_search_knowledge(text, text[], extensions.vector, integer) from public, anon;
grant execute on function public.assistant_search_knowledge(text, text[], extensions.vector, integer) to authenticated;

-- The six already reviewed excerpts existed in the application before RAG.
-- Add them to the managed library so the initial retrieval has real rows.
-- Standards are summarized with source links; these are not full standard texts.
with seed(slug, title, section, version, source_url, content) as (
  values
    ('manual-upload', '工业园区地下水污染风险监测平台操作说明书', '5.3 排污点监测 / Excel 上传', '用户稿 2026-08（按现有功能核对）', null,
     '企业在排污点监测页选择已审批排污口，按模板上传包含排污口、监测时间和污染物列的 Excel。系统先核对排污口、污染物、单位和数值，再按管理员审批的阈值提示异常；小水滴的 Excel 录入先预检，用户确认后才保存。'),
    ('manual-cdc', '工业园区地下水污染风险监测平台操作说明书', '5.4 / 6 CDC 分析', '用户稿 2026-08（结合现有代码修订）', null,
     'CDC 是平台自定义的风险分析指标，不是国家标准水质类别。AV 是均值，AD 是平均绝对离差，CV 是变异系数，SKEW 是偏度。当前系统分级：CDC 小于 0.5 为低风险，0.5 至小于 1.5 为中风险，1.5 及以上为高风险。两期 CDC 各按当时园区样本归一化，直接相减可能受参照变化影响。历史正常参考日仅指当日该指标记录均有审批上限且未超上限，不能等同法定水质达标。'),
    ('thresholds', '平台监测数据分析口径', '超阈值与日均值', '当前系统实现 2026-10', null,
     '小水滴按企业、排污口、污染物及单位分别统计记录数、最小值、最大值、算术平均值与北京时间逐日平均值。逐条记录的数值大于记录保存的审批上限时计为超阈值；缺上限的记录不能判定。日均值只是趋势展示，不能替代单条记录的阈值判定；无记录不代表正常。审批阈值不自动等于国家或地方排放限值。当前数据结构只有上限，不适合自动判断 pH 等需要上下限的指标。'),
    ('groundwater-quality', 'GB/T 14848-2017 地下水质量标准', '标准题录与适用边界', '2017-10 发布 / 2018-05 实施',
     'https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=F745E3023BD5B10B9FB5314E0FFB5523',
     'GB/T 14848-2017 是地下水质量评价的推荐性国家标准。应用其分类指标前，先确认样品确为地下水、监测指标名称与测定方法相符，再确定评价类别。不能直接用此标准认定企业排污口废水浓度超标；平台当前没有完整的采样介质、标准类别和测定方法字段，因此不自动套用国标数值。'),
    ('groundwater-monitoring', 'HJ 164-2020 地下水环境监测技术规范', '适用内容', '2021-03 实施',
     'https://www.mee.gov.cn/ywgz/fgbz/bz/bzwb/jcffbz/202012/t20201203_811333.shtml',
     'HJ 164-2020 规定地下水监测点布设、监测井建设与管理、样品采集与保存、监测项目与分析方法、数据处理、质量保证和质量控制及资料整编。异常值核查时应先检查点位、采样和质控信息；仅靠平台数值无法确认污染来源。'),
    ('wastewater-discharge', 'GB 8978-1996 污水综合排放标准', '适用范围', '1998-01 实施',
     'https://www.mee.gov.cn/ywgz/fgbz/bz/bzwb/shjbh/swrwpfbz/199801/t19980101_66568.htm',
     'GB 8978-1996 按污水排放去向及建设年限设置排放控制要求。是否适用于某企业须核查排口性质、行业专门标准、排放去向、排污许可证及地方要求；不能从平台上的排污口名称直接推定适用 GB 8978，也不能把地下水质量标准当作排放限值。')
), owner as (
  select user_id::text as user_id from public.profiles
  where role = 'admin' order by user_id::text limit 1
), inserted as (
  insert into public.assistant_knowledge_documents
    (id, title, version, visibility, status, source_url, file_name, content,
     embedding_status, uploaded_by, reviewed_by, reviewed_at)
  select md5('w-cdc:rag-v1:' || s.slug)::uuid, s.title, s.version, 'public', 'published',
    s.source_url, '内置资料', s.content, 'keyword', owner.user_id, owner.user_id, now()
  from seed s cross join owner
  on conflict (id) do nothing
  returning id
)
insert into public.assistant_knowledge_chunks (document_id, ordinal, section, content)
select i.id, 0, s.section, s.content
from inserted i join seed s on i.id = md5('w-cdc:rag-v1:' || s.slug)::uuid;
