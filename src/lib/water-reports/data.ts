import type { SupabaseClient } from '@supabase/supabase-js';
import { analyze, period, type Company, type Outlet, type Reading, type Pollutant, type Role, type Report } from './model';

export class ReportError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
// Supabase caps a single response. Fetch all pages in stable primary-key order.
async function pages<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const all: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query(offset, offset + 499);
    if (error) throw new ReportError('读取报告数据失败，请稍后重试', 503);
    all.push(...(data ?? []));
    if (!data || data.length < 500) return all;
    if (all.length >= 50000) throw new ReportError('数据量较大，请缩短报告日期范围', 422);
  }
}
export async function reportData(client: SupabaseClient, token: string, role: Role, start: unknown, end: unknown): Promise<Report> {
  let dates: ReturnType<typeof period>;
  try { dates = period(start, end); } catch (e) { throw new ReportError(e instanceof Error ? e.message : '日期错误', 400); }
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) throw new ReportError('登录已失效，请重新登录', 401);
  const { data: profile, error: profileError } = await client.from('profiles').select('id, role, company_name, park_name, user_id').eq('user_id', user.id).single();
  if (profileError || !profile || profile.role !== role) throw new ReportError('没有生成此类报告的权限', 403);
  if (!profile.park_name) throw new ReportError('请先完善所属园区信息', 400);
  // Other companies are read only on the server for CDC normalization. Enterprise output is filtered below.
  const companies = await pages<Company>((from, to) => client.from('profiles').select('id, user_id, company_name, park_name').eq('role', 'enterprise').eq('park_name', profile.park_name).order('id').range(from, to));
  const outlets: Outlet[] = [], readings: Reading[] = [];
  const pollutants: Record<string, Pollutant[]> = {};
  for (const company of companies) {
    const own = await pages<Outlet>((from, to) => client.from('discharge_outlets').select('id, name, user_id').eq('user_id', company.user_id).eq('status', 'approved').order('id').range(from, to));
    outlets.push(...own);
    const apps = await pages<{ pollutants: unknown }>((from, to) => client.from('pollutant_applications').select('id, pollutants').eq('company_id', company.id).eq('status', 'approved').order('id').range(from, to));
    const unique = new Map<string, Pollutant>();
    for (const app of apps) {
      let parsed: unknown = app.pollutants;
      if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch { throw new ReportError('污染物配置格式异常，请联系管理员', 422); } }
      if (!Array.isArray(parsed)) continue;
      for (const item of parsed as unknown[]) {
        if (!item || typeof item !== 'object' || !('id' in item) || typeof item.id !== 'string') continue;
        if (!unique.has(item.id)) unique.set(item.id, { id: item.id, label: 'label' in item && typeof item.label === 'string' ? item.label : item.id, unit: 'unit' in item && typeof item.unit === 'string' ? item.unit : '' });
      }
    }
    pollutants[company.id] = [...unique.values()];
    for (let i = 0; i < own.length; i += 100) {
      const ids = own.slice(i, i + 100).map(o => o.id);
      readings.push(...await pages<Reading>((from, to) => client.from('monitoring_data').select('id, outlet_id, pollutant_type, value, unit, standard_limit, monitored_at').in('outlet_id', ids).gte('monitored_at', dates.from).lt('monitored_at', dates.to).order('id').range(from, to)));
      if (readings.length > 50000) throw new ReportError('数据量较大，请缩短报告日期范围', 422);
    }
  }
  if (readings.some(r => r.value === null || !Number.isFinite(Number(r.value)) || !Number.isFinite(Date.parse(r.monitored_at)))) throw new ReportError('监测数据含无效数值或时间，请先核查', 422);
  const analysis = analyze(companies, outlets, readings, pollutants);
  const selected = role === 'admin' ? analysis : analysis.filter(c => c.id === profile.id);
  if (!selected.some(c => c.records.length)) throw new ReportError('所选日期内没有已审批排污口的监测数据，请调整日期', 422);
  return { role, park: profile.park_name, start: dates.start, end: dates.end, generated: new Date().toISOString(), companies: selected };
}
