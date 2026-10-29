-- Official-standard section summaries, verified against the MEE PDFs on 2026-10-29.
-- Idempotent. Does not edit user uploads, monitoring records, or existing vectors.
-- These are paraphrases with section references, not copies of the standards.
with owner as (
  select user_id::text as user_id from public.profiles
  where role = 'admin' order by user_id::text limit 1
)
insert into public.assistant_knowledge_documents
  (id, title, version, visibility, status, source_url, file_name, content,
   embedding_status, uploaded_by, reviewed_by, reviewed_at)
select md5('w-cdc:rag-v3:hj164-sampling-qa')::uuid,
  'HJ 164-2020 地下水监测采样与质控核查要点',
  '2021-03 实施；官方标准章节摘要，2026-10-29 核对',
  'public', 'published',
  'https://www.mee.gov.cn/ywgz/fgbz/bz/bzwb/jcffbz/202012/W020201203608473632069.pdf',
  '官方标准章节摘要',
  '依据 HJ 164-2020 第 6、7、9、10 章整理地下水监测井采样、样品流转和分析质控核查要点；非标准全文，具体操作以原文及对应分析方法为准。',
  'keyword', owner.user_id, owner.user_id, now()
from owner where true on conflict (id) do nothing;

with sections(ordinal, section, content) as (
  values
    (0, 'HJ 164-2020 第 4.1、6.3.2～6.3.5 节 · 监测井与采样',
      '地下水读数异常时，先核对监测井编号、点位、采样层位及前次采样条件是否可比；查地下水水位、井水深度和附近抽水影响记录。HJ 164-2020 第 6.3.3 节规定采样前洗井，并结合现场浊度、电导率、pH 等观测判断洗井是否满足要求；第 6.3.5 节要求核对采样计划、采样记录与水样。平台中的废水排污口不自动等同地下水监测井。'),
    (1, 'HJ 164-2020 第 6.3.5、7.1～7.2 节 · 保存与交接',
      '现场取样后核对样品编号、采样时间和监测项目的标签，按监测项目和所用分析方法核查容器及保存剂。HJ 164-2020 第 7.1 节要求水样尽快送实验室，运输中避光并按规定冷藏；第 7.2 节要求实验室接样时核对包装、标识、采样地点、样品数量、保存剂及冷藏状态。具体保存条件和时限须以对应监测项目与分析方法为准。'),
    (2, 'HJ 164-2020 第 9.1.3、10.2～10.3 节 · 异常值与质控',
      '对突然升高的地下水监测值，应核对现场平行样、全程序空白样及实验室空白；复查分析方法、仪器和校准曲线、平行双样、标准物质或质控样，复杂样品可检查加标回收。HJ 164-2020 第 9.1.3 节要求结合监测点周围的水文地质、气象及附近污染源情况分析异常值，不应只凭一次统计偏离决定取舍或判断污染来源。')
)
insert into public.assistant_knowledge_chunks (document_id, ordinal, section, content)
select md5('w-cdc:rag-v3:hj164-sampling-qa')::uuid, ordinal, section, content from sections
where exists (select 1 from public.assistant_knowledge_documents
  where id = md5('w-cdc:rag-v3:hj164-sampling-qa')::uuid)
on conflict (document_id, ordinal) do nothing;

-- The earlier HJ 1209 excerpt remains intact. Add details to its keyword-only entry.
with sections(ordinal, section, content) as (
  values
    (1, 'HJ 1209—2021 第 1、5、6 节 · 适用范围与采样',
      'HJ 1209—2021 适用于土壤污染重点监管单位中在产工业企业内部的土壤和地下水自行监测；其他工业企业可参照，不应仅凭平台企业账号推断其法定适用性。核对监测方案中地下水监测井的位置、数量和深度及实际采样条件。该指南第 6 节将地下水采样前洗井及样品保存、流转的具体要求指向 HJ 164、HJ 1019 和所选分析方法。'),
    (2, 'HJ 1209—2021 第 7、8 节 · 前次结果与质量控制',
      '对工业企业地下水自行监测结果，第 7 节要求结合对应地下水点位的前次监测值和变化趋势分析；第 8 节要求复核监测方案、点位位置及深度，并核查样品采集、保存、流转和分析的质量控制。如果监测点位、采样方法或样品环节不可比，应先说明限制，不能仅凭单次数值跳高断言污染来源或把平台审批上限等同法定地下水质量类别。')
)
insert into public.assistant_knowledge_chunks (document_id, ordinal, section, content)
select md5('w-cdc:rag-v2:hj-1209-2021')::uuid, ordinal, section, content from sections
where exists (select 1 from public.assistant_knowledge_documents
  where id = md5('w-cdc:rag-v2:hj-1209-2021')::uuid and file_name = '官方题录摘要')
on conflict (document_id, ordinal) do nothing;

update public.assistant_knowledge_documents d set content = (
  select string_agg(c.section || E'\n' || c.content, E'\n\n' order by c.ordinal)
  from public.assistant_knowledge_chunks c where c.document_id = d.id
)
where d.id = md5('w-cdc:rag-v2:hj-1209-2021')::uuid
  and d.file_name = '官方题录摘要';
