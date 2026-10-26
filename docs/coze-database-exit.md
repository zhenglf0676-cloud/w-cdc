# 从扣子沙盒迁出数据库：W-CDC 实施记录

## 目标与边界

目标是将当前 Vercel 网站依赖的扣子 Supabase 兼容数据库复制到项目自行管理的 Supabase 项目，保留原有账号、企业、审批、排口、监测记录及其主键关系。现网 `www.w-cdc.cn` 在验收完成前继续连接原库。新资料库迁移 `supabase/migrations/20261021_assistant_knowledge.sql` 应在新库验证后执行。

W-CDC 使用 Supabase Auth、PostgREST、服务端 service role 和即将启用的私有 Storage 文件桶。仅换成普通 PostgreSQL/Neon 会同时要求重写登录、API 权限和文件存储，所以首选完整 Supabase 项目。

## 先确认源库

1. 在扣子编程中打开**原 W-CDC 项目**，进入「数据库」。扣子的开发库与生产库相互独立；必须核对 Vercel `w-cdc` 的 Supabase 地址与源库，选择现网站实际连接的实例，不能凭环境名称猜测。
2. 确认项目所有者能在该实例运行只读 SQL，以及是否有可从受控环境使用的 PostgreSQL 连接串、`pg_dump` 权限或完整备份。只读盘点见下方 SQL；不要把密码、service role、用户邮箱、哈希或完整导出文件贴在聊天和仓库中。
3. 列出 `public` 中所有业务表、列、约束、索引、序列、RLS 策略和函数；当前代码明确使用 `profiles`、`discharge_outlets`、`pollutant_applications`、`monitoring_data`、`notifications`，但代码里的 Drizzle schema 并不包含全部线上结构。还要盘点 `auth` 中的账号与身份，以及 `storage` 中的 bucket 和原件。

```sql
select current_database() as database_name, current_user as sql_user,
       pg_size_pretty(pg_database_size(current_database())) as database_size;

select table_schema, table_name
from information_schema.tables
where table_schema in ('public', 'auth', 'storage') and table_type = 'BASE TABLE'
order by table_schema, table_name;

select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, policyname;

select count(*) as auth_users from auth.users;
select count(*) as profiles from public.profiles;
select count(*) as outlets from public.discharge_outlets;
select count(*) as applications from public.pollutant_applications;
select count(*) as monitoring_rows from public.monitoring_data;
select count(*) as notifications from public.notifications;
select id, name, public from storage.buckets order by id;
select bucket_id, count(*) as objects from storage.objects group by bucket_id order by bucket_id;
```

如果个别表或 `storage` schema 不存在，先记录实际结构，再删去相应盘点语句。只读 SQL 编辑器可确认密码哈希是否存在，但不能证明导出权限；仍须试行完整的受控备份，并在新库验证登录。两套源库应分别归档，并按主键与内容核查独有数据；不能直接覆盖或合并。原始盘点结果、账号数量和权限异常只记录在受控的迁移工作环境，不提交到公开仓库。

新项目恢复后应为所有可经 Data API 访问的业务表启用 RLS，按企业与管理员范围制定策略，并核查注册流程的管理者角色授予。启用策略前不要连接生产站。新 Supabase 项目对新建表的 Data API 暴露规则也可能与旧库不同，需要核查 API 设置及必要的显式 GRANT。

## 复制到独立项目

1. 在用户指定的 Supabase 组织建立独立项目，选择数据存放地区并确认容量及费用。先将它连到单独的测试环境，**不要覆盖生产变量**。保留 Coze 两个原库及其备份。
2. 从网站实际连接的源库取得完整结构和数据，另一套扣子库也单独备份。优先使用有相应权限的 Supabase CLI 备份/受控 `pg_dump`，并按官方迁移指引恢复；不能把整个源 `auth`/`storage` schema 盲目覆盖目标托管 schema。`auth.users`、`auth.identities`、密码哈希与用户 UUID 必须一起处理，使 `profiles.user_id`、排口、审批、监测关联继续有效。若扣子只允许导出 `public` 表而不允许导出 Auth 数据，先停在这里：可保留监测历史，但旧密码无法直接保证延续，届时须另行设计账号重置和 ID 映射方案。
3. 迁移所有相关 schema、函数、索引、约束和 RLS，确认目标 Supabase 默认 `auth`/`storage` schema 不被盲目覆盖。Storage 文件需要单独复制；仅迁移 `storage.objects` 元数据不会复制文件内容。
4. 在目标库执行资料库 SQL 迁移，验证 `vector` 扩展、私有文件桶及检索 RPC 可以使用。新库的 URL、anon key、service role key 分别配置到**预览环境**，不要把 service role 公开给客户端。
5. 用 `scripts/verify-supabase-copy.mjs` 对比源库和目标库已知业务表的行数及内容摘要、账号 ID 集合。另通过受控 SQL 核对 `auth.users`、`auth.identities` 与非空密码哈希的数量，不输出哈希值。盘点如发现其他业务表，用 `MIGRATION_TABLES`（逗号分隔表名）加入对账；再用真实企业和管理员账号测试登录、审批排口、Excel 上传、监测查询、小水滴问答和资料检索。需特别测匿名用户不能读取 `profiles`、企业 A 不能读取企业 B 数据、企业用户不能自设管理员。自助注册仅为企业创建档案；管理员角色由系统负责人在受控后台配置。新旧项目 JWT 不同，切换后用户一般需重新登录。
6. 切换窗口暂停写入，做最后一次增量同步并重新对账，然后才更新生产环境的 Supabase URL、anon key、service role key、重新部署。保留原库和回退变量，持续监测一段时间；任何计数、内容、账号或权限不一致都回退连接。
