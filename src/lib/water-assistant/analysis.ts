import { z } from 'zod';
import { chinaDay, chinaPeriod } from '../china-time';
import { exceeded, type Reading } from '../water-reports/model';

export const analysisArgs = z.object({
  startDate: z.string(), endDate: z.string(),
  companyName: z.string().max(120).optional(),
}).strict().superRefine((v, ctx) => {
  try {
    const p = chinaPeriod(v.startDate, v.endDate);
    if (p.days > 31 || v.endDate > chinaDay(new Date())) throw new Error();
  } catch { ctx.addIssue({ code: 'custom', message: '请选择不晚于今天、跨度不超过31天的有效日期' }); }
});
export type Scope = { role: 'admin' | 'enterprise'; userId: string; park: string };
export type AuthorizedCompany = { id: string; user_id: string; company_name: string; park_name: string };
export function allowedCompany(scope: Scope, company: { user_id: string; park_name: string }) {
  return scope.role === 'enterprise' ? company.user_id === scope.userId : !!scope.park && company.park_name === scope.park;
}
export function selectAuthorizedCompanies(scope: Scope, companies: AuthorizedCompany[], name?: string) {
  return companies.filter(company => allowedCompany(scope, company) && (!name || company.company_name === name));
}
export function authorizedReadings(
  scope: Scope, companies: AuthorizedCompany[],
  outlets: { id: string; name: string; user_id: string; status: string }[], records: Reading[],
) {
  const owners = new Map(selectAuthorizedCompanies(scope, companies).map(company => [company.user_id, company]));
  const approved = new Map(outlets.filter(outlet => outlet.status === 'approved' && owners.has(outlet.user_id)).map(outlet => [outlet.id, outlet]));
  return records.flatMap(reading => {
    const outlet = approved.get(reading.outlet_id);
    const company = outlet ? owners.get(outlet.user_id) : null;
    return outlet && company ? [{ reading, outlet, company }] : [];
  });
}
export function comparableUpperLimit(record: Reading) {
  // The current schema stores only one upper limit; pH needs a lower and an upper bound.
  return !/^ph$/i.test(record.pollutant_type) && record.standard_limit !== null && Number.isFinite(Number(record.standard_limit));
}
export function confirmedExceedance(record: Reading) {
  return comparableUpperLimit(record) && exceeded(record);
}
export function summarize(records: Reading[]) {
  const groups = new Map<string, Reading[]>();
  for (const r of records) {
    if (r.value === null || !Number.isFinite(Number(r.value))) throw new Error('监测数据含无效数值');
    const key = JSON.stringify([r.outlet_id, r.pollutant_type, r.unit]);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.values()].map(rows => ({
    outletId: rows[0].outlet_id, pollutant: rows[0].pollutant_type, unit: rows[0].unit,
    count: rows.length, exceedances: rows.filter(confirmedExceedance).length,
    unassessable: rows.filter(r => !comparableUpperLimit(r)).length,
    missingThreshold: rows.filter(r => r.standard_limit === null || !Number.isFinite(Number(r.standard_limit))).length,
    min: Math.min(...rows.map(r => Number(r.value))), max: Math.max(...rows.map(r => Number(r.value))),
    mean: rows.reduce((s, r) => s + Number(r.value), 0) / rows.length,
    daily: [...new Set(rows.map(r => chinaDay(r.monitored_at)))].sort().map(date => {
      const selected = rows.filter(r => chinaDay(r.monitored_at) === date);
      return { date, count: selected.length, exceedances: selected.filter(confirmedExceedance).length, mean: selected.reduce((s, r) => s + Number(r.value), 0) / selected.length };
    }),
    evidence: rows.filter(confirmedExceedance).slice(0, 10).map(r => ({ id: r.id, at: r.monitored_at, value: r.value, limit: r.standard_limit })),
  }));
}
