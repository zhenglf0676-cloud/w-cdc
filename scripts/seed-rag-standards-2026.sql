-- Curated summaries of official ecology and environment standards, checked on 2026-10-29.
-- Run after the assistant knowledge and hybrid search migrations. Idempotent IDs
-- keep this seed separate from user uploads. These are summaries, not full texts.
with seed(slug, title, section, version, source_url, content) as (
  values
    (
      'hj-1209-2021',
      'HJ 1209—2021 工业企业土壤和地下水自行监测技术指南（试行）',
      '适用范围与监测流程',
      '2022-01-01 实施；官方题录摘要，2026-10-29 核对',
      'https://www.mee.gov.cn/ywgz/fgbz/bz/bzwb/jcffbz/202112/t20211206_963131.shtml',
      'HJ 1209—2021 面向工业企业土壤和地下水自行监测，覆盖监测方案、采样与样品流转、分析、质量保证与控制、结果分析和监测报告。企业出现地下水监测异常时，宜先核对监测点位、样品采集保存、分析与质控资料，再结合历史趋势判断。该指南不是排污口废水浓度限值，也不能仅凭平台中一个数值确定污染来源。'
    ),
    (
      'hj-819-2017',
      'HJ 819-2017 排污单位自行监测技术指南 总则',
      '自行监测方案、质控与记录',
      '2017-06-01 实施；官方题录摘要，2026-10-29 核对',
      'https://www.mee.gov.cn/ywgz/fgbz/bz/bzwb/shjbh/xgbzh/201705/t20170511_413871.shtml',
      'HJ 819-2017 提出排污单位自行监测的一般要求，包括监测方案制定、监测质量保证与质量控制、信息记录和报告。核查企业监测缺失或异常时，应先看该企业实际监测方案、记录与质控情况；具体监测项目、点位和频次还须结合适用的行业指南、排污许可证等文件确认。总则本身不等于某企业污染物的排放限值。'
    ),
    (
      'hj-91-1-2019',
      'HJ 91.1-2019 污水监测技术规范',
      '污水采样与质控的适用边界',
      '2020-03-24 实施；官方题录摘要，2026-10-29 核对',
      'https://www.mee.gov.cn/ywgz/fgbz/bz/bzwb/jcffbz/201912/t20191227_751689.shtml',
      'HJ 91.1-2019 规范污水监测的相关技术要求，适用于污水采样和监测过程核查。平台分析排污口废水记录时，应核对采样位置、采样方式、时间、样品保存与质量控制资料；不能把污水监测技术规范当作地下水质量分类标准或具体污染物排放限值。HJ 1405—2024 的监测点位设置要求将于 2027-01-01 实施，届时应复核本规范涉及点位设置的条款。'
    ),
    (
      'hj-355-2019',
      'HJ 355-2019 水污染源在线监测系统运行技术规范',
      'CODCr、NH3-N 等在线系统运行',
      '2020-03-24 实施；官方题录摘要，2026-10-29 核对',
      'https://www.mee.gov.cn/ywgz/fgbz/bz/bzwb/jcffbz/201912/t20191227_751679.shtml',
      'HJ 355-2019 规范化学需氧量 CODCr、氨氮 NH3-N 等水污染源在线监测系统的运行技术要求。平台发现在线记录中断、突变或设备异常提示时，可把运行维护与仪器状态作为需要核查的背景，并结合原始记录、质控和数据有效性判别进一步分析。缺少记录不代表水质正常；运行规范本身不提供企业排污口的审批上限。'
    ),
    (
      'hj-356-2019',
      'HJ 356-2019 水污染源在线监测系统数据有效性判别技术规范',
      'CODCr、NH3-N 等数据有效性',
      '2020-03-24 实施；官方题录摘要，2026-10-29 核对',
      'https://www.mee.gov.cn/ywgz/fgbz/bz/bzwb/jcffbz/201912/t20191227_751686.shtml',
      'HJ 356-2019 针对水污染源在线监测系统中 CODCr、NH3-N 等数据的有效性判别提出技术要求。平台若只有监测数值与审批上限，没有设备运行、校准、质控及有效性标记，就只能报告数值变化与超审批上限情况，不能直接宣称该在线数据符合标准意义上的有效性判别，也不能把无数据判为达标。应结合原始设备记录和相关运行规范核查。'
    )
), owner as (
  select user_id::text as user_id from public.profiles
  where role = 'admin' order by user_id::text limit 1
), inserted as (
  insert into public.assistant_knowledge_documents
    (id, title, version, visibility, status, source_url, file_name, content,
     embedding_status, uploaded_by, reviewed_by, reviewed_at)
  select md5('w-cdc:rag-v2:' || s.slug)::uuid, s.title, s.version, 'public', 'published',
    s.source_url, '官方题录摘要', s.content, 'keyword', owner.user_id, owner.user_id, now()
  from seed s cross join owner
  on conflict (id) do nothing
  returning id
)
insert into public.assistant_knowledge_chunks (document_id, ordinal, section, content)
select inserted.id, 0, seed.section, seed.content
from inserted join seed on inserted.id = md5('w-cdc:rag-v2:' || seed.slug)::uuid;
