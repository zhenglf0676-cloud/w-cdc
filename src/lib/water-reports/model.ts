export type Role = 'enterprise' | 'admin';
export type Company = { id: string; user_id: string; company_name: string; park_name: string };
export type Outlet = { id: string; name: string; user_id: string };
export type Reading = { id: string; outlet_id: string; pollutant_type: string; value: number; unit: string | null; standard_limit: number | null; monitored_at: string };
export type Pollutant = { id: string; label: string; unit: string };
export type Stats = { av: number; ad: number; cv: number; skew: number };
export const chinaDay = (date: string) => new Date(new Date(date).getTime() + 28800000).toISOString().slice(0, 10);
export const exceeded = (r: Reading) => r.standard_limit !== null && Number.isFinite(Number(r.standard_limit)) && Number(r.value) > Number(r.standard_limit);
export function period(start: unknown, end: unknown) {
  const valid = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  if (!valid(start) || !valid(end) || start > end) throw new Error('请选择有效的起止日期');
  if ((Date.parse(end) - Date.parse(start)) / 86400000 > 365) throw new Error('一次最多生成366天的报告');
  return { start, end, from: new Date(start + 'T00:00:00+08:00').toISOString(), to: new Date(Date.parse(end + 'T00:00:00+08:00') + 86400000).toISOString() };
}
export function dailyLatest(records: Reading[]) {
  const latest = new Map<string, Reading>();
  for (const r of records) {
    const key = JSON.stringify([chinaDay(r.monitored_at), r.pollutant_type, r.outlet_id]);
    const old = latest.get(key);
    if (!old || Date.parse(r.monitored_at) > Date.parse(old.monitored_at) || (r.monitored_at === old.monitored_at && r.id > old.id)) latest.set(key, r);
  }
  const daily: Record<string, Record<string, number>> = {};
  for (const r of latest.values()) {
    const day = chinaDay(r.monitored_at);
    daily[r.pollutant_type] ??= {};
    daily[r.pollutant_type][day] = (daily[r.pollutant_type][day] ?? 0) + Number(r.value);
  }
  return daily;
}
export function statistics(values: number[]): Stats | null {
  if (!values.length) return null;
  const av = values.reduce((s, v) => s + v, 0) / values.length;
  const ad = values.reduce((s, v) => s + Math.abs(v - av), 0) / values.length;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - av) ** 2, 0) / values.length);
  return { av, ad, cv: av ? sd / av : 0, skew: sd ? values.reduce((s, v) => s + (v - av) ** 3, 0) / values.length / sd ** 3 : 0 };
}
export function analyze(companies: Company[], outlets: Outlet[], readings: Reading[], pollutants: Record<string, Pollutant[]>) {
  const result = companies.map(company => {
    const ownOutlets = outlets.filter(o => o.user_id === company.user_id);
    const ids = new Set(ownOutlets.map(o => o.id));
    const records = readings.filter(r => ids.has(r.outlet_id));
    const daily = dailyLatest(records);
    // Preserve the deployed CDC formula, including its positive-day sampling rule.
    const metrics = (pollutants[company.id] ?? []).map(p => ({ ...p, stats: statistics(Object.values(daily[p.id] ?? {}).filter(v => v > 0)), cdc: null as number | null }));
    return { ...company, outlets: ownOutlets, records, daily, metrics, cdc: null as number | null };
  });
  const stats = result.flatMap(c => c.metrics.flatMap(p => p.stats ? [p.stats] : []));
  const maxAD = Math.max(0, ...stats.map(s => s.ad)), maxCV = Math.max(0, ...stats.map(s => s.cv)), maxSkew = Math.max(0, ...stats.map(s => Math.abs(s.skew)));
  const sumAV = stats.reduce((s, v) => s + v.av, 0);
  for (const c of result) {
    for (const p of c.metrics) if (p.stats) {
      const s = p.stats;
      p.cdc = (sumAV ? companies.length * s.av / sumAV : 1) * ((maxAD ? s.ad / maxAD : 0) ** 2 + (maxCV ? s.cv / maxCV : 0) ** 2 + (maxSkew ? Math.abs(s.skew) / maxSkew : 0) ** 2);
    }
    const usable = c.metrics.filter(p => p.cdc !== null);
    c.cdc = usable.length ? usable.reduce((s, p) => s + (p.cdc ?? 0), 0) / usable.length : null;
  }
  return result;
}
export type Analysis = ReturnType<typeof analyze>;
export type Report = { role: Role; park: string; start: string; end: string; generated: string; companies: Analysis };
