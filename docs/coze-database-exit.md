# 从扣子沙盒迁出数据库：W-CDC 实施记录

## 目标与边界

目标是将当前 Vercel 网站依赖的扣子 Supabase 兼容数据库复制到项目自行管理的 Supabase 项目，保留原有账号、企业、审批、排口、监测记录及其主键关系。现网 `www.w-cdc.cn` 在验收完成前继续连接原库。新资料库迁移 `supabase/migrations/20261021_assistant_knowledge.sql` 应在新库验证后执行。

W-CDC 使用 Supabase Auth、PostgREST、服务端 service role 和即将启用的私有 Storage 文件桶。仅换成普通 PostgreSQL/Neon 会同时要求重写登录、API 权限和文件存储，所以首选完整 Supabase 项目。

## 先确认源库

1. 在扣子编程中打开**原 W-CDC 项目**，进入「数据库」。扣子的开发库与生产库相互独立。2026-10-22 已核对 Coze 开发预览 `/api/supabase-config` 与 Vercel `w-cdc` 的 Supabase 主机名一致，现网站以**开发库**为主源；切换前仍须重新核对环境变量与最新记录。不能凭页面上“开发库”或“生产库”的名称猜测。
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

如果个别表或 `storage` schema 不存在，先记录实际结构，再删去相应盘点语句。只读 SQL 编辑器可确认密码哈希存在，但不能证明导出权限；仍须试行完整的受控备份，并在新库验证登录。

### 已核实的源库基线（2026-10-22，只读快照）

| 对象 | 开发库，现网站主源 | 扣子生产库，单独保留 |
| --- | ---: | ---: |
| `auth.users` | 12 | 8 |
| `auth.identities` | 12 | 8 |
| `public.profiles` | 11 | 7 |
| `public.discharge_outlets` | 15 | 14 |
| `public.pollutant_applications` | 24 | 21 |
| `public.monitoring_data` | 924 | 665 |
| `public.notifications` | 26 | 13 |
| `storage.buckets` / `storage.objects` | 0 / 0 | 0 / 0 |

两个库**不是同一份数据**。先对开发库做完整备份；扣子生产库也单独归档，再按主键和内容比较差异。若生产库存在开发库没有的合法业务记录，应在冲突和关联关系核验后有选择地补入，不能直接把两份库覆盖或合并。以上数量会随业务写入变化，切换前必须重新盘点并做最终增量同步。开发库 12 个、生产库 8 个账号均有非空 `encrypted_password`；不能把 12 与 8 相加当作独立用户数。

源库 `profiles` 的 RLS 关闭，`anon` 角色有 SELECT 权限；其余四张主要业务表开启了 RLS，但未发现策略。新项目恢复后应为所有可经 Data API 访问的业务表启用 RLS，按企业与管理员范围制定策略，并核查注册流程的管理者角色授予。启用策略前不要连接生产站。新 Supabase 项目对新建表的 Data API 暴露规则也可能与旧库不同，需要核查 API 设置及必要的显式 GRANT。

## 复制到独立项目

1. 在用户指定的 Supabase 组织中建立独立项目，选择数据存放地区并确认容量及费用。当前候选为新加坡区域（数据存放在中国大陆以外，须由所有者决定）。先将它连到单独的测试环境，**不要覆盖生产变量**。保留 Coze 两个原库及其备份。
2. 从**开发库**取得完整结构和数据，另存一份扣子生产库备份。优先使用有相应权限的 Supabase CLI 备份/受控 `pg_dump`，并按官方迁移指引恢复；不能把整个源 `auth`/`storage` schema 盲目覆盖目标托管 schema。`auth.users`、`auth.identities`、密码哈希与用户 UUID 必须一起处理，使 `profiles.user_id`、排口、审批、监测关联继续有效。扣子 SQL 编辑器可读到 `auth` 表及 PG 连接设置，但其终端尚未提供 `pg_dump`/`psql`，且没有自动注入 `DATABASE_URL`；备份工具和连接方式需要先打通。若扣子只允许导出 `public` 表而不允许导出 Auth 数据，先停在这里：可保留监测历史，但旧密码无法直接保证延续，届时须另行设计账号重置和 ID 映射方案。
3. 迁移所有相关 schema、函数、索引、约束和 RLS，确认目标 Supabase 默认 `auth`/`storage` schema 不被盲目覆盖。Storage 文件需要单独复制；仅迁移 `storage.objects` 元数据不会复制文件内容。
4. 在目标库执行资料库 SQL 迁移，验证 `vector` 扩展、私有文件桶及检索 RPC 可以使用。新库的 URL、anon key、service role key 分别配置到**预览环境**，不要把 service role 公开给客户端。
5. 用 `scripts/verify-supabase-copy.mjs` 对比源库和目标库已知业务表的行数及内容摘要、账号 ID 集合。另通过受控 SQL 核对 `auth.users`、`auth.identities` 与密码哈希迁移情况。盘点如发现其他业务表，用 `MIGRATION_TABLES`（逗号分隔表名）加入对账；再用真实企业和管理员账号测试登录、审批排口、Excel 上传、监测查询、小水滴问答和资料检索。需特别测匿名用户不能读取 `profiles`、企业 A 不能读取企业 B 数据、企业用户不能自设管理员。新旧项目 JWT 不同，切换后用户一般需重新登录。
6. 切换窗口暂停写入，做最后一次增量同步并重新对账，然后才更新生产环境的 Supabase URL、anon key、service role key、重新部署。保留原库和回退变量，持续监测一段时间；任何计数、内容、账号或权限不一致都回退连接。

## 当前状态

- Vercel `w-cdc` 已有当前源库的 URL、anon key、service role key，生产网站可正常运行；Supabase 连接器下目前有一个组织，但尚无独立项目。未修改任何生产数据库变量。
- 已通过扣子所有者会话运行只读 SQL，并确认两库的账号/业务数据基线和密码哈希存在。尚未完成受控数据库导出、独立项目创建、数据复制、权限测试与生产切换，因此不能称为“已迁移”。
- 独立 Supabase 所在组织、数据地区与费用需确认。若通过 Vercel Marketplace 安装，还会遇到 Vercel/Supabase 服务条款接受步骤，必须由用户对该具体协议操作确认。
- 资料库代码仍位于预览分支，生产站目前继续使用经过验证的 Agent 版本。
