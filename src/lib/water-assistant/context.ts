import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { AuthorizedCompany } from './analysis';

export const contextArgs = z.object({ companyName: z.string().min(1).max(120).optional() }).strict();
export const recordArgs = z.object({ recordIds: z.array(z.string().min(1).max(120)).min(1).max(10) }).strict();

export type Approval = { id: string; label: string; unit: string | null; threshold: number | null; approvedAt: string | null };
export type MonitoringContext = {
  company: string;
  approvedOutlets: { id: string; name: string }[];
  approvedPollutants: Approval[];
};

export async function loadMonitoringContext(client: SupabaseClient, company: AuthorizedCompany): Promise<MonitoringContext> {
  const outlets: MonitoringContext['approvedOutlets'] = [];
  for (let offset = 0; ; offset += 500) {
    const res = await client.from('discharge_outlets').select('id,name').eq('user_id', company.user_id).eq('status', 'approved').order('id').range(offset, offset + 499);
    if (res.error) throw new Error('query');
    outlets.push(...(res.data ?? []));
    if (!res.data || res.data.length < 500) break;
    if (outlets.length >= 2000) throw new Error('too much data');
  }
  const approved = new Map<string, Approval>();
  // The latest approved application for each pollutant supplies the *current* company-level config.
  const apps = await client.from('pollutant_applications').select('id,pollutants,approved_at').eq('company_id', company.id).eq('status', 'approved').order('approved_at', { ascending: false }).limit(501);
  if (apps.error) throw new Error('query');
  if ((apps.data?.length ?? 0) > 500) throw new Error('too much data');
  for (const app of apps.data ?? []) {
    let items: unknown = app.pollutants;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch { throw new Error('invalid approval'); }
    }
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string' || approved.has(item.id)) continue;
      approved.set(item.id, {
        id: item.id, label: typeof item.label === 'string' ? item.label : typeof item.name === 'string' ? item.name : item.id,
        unit: typeof item.unit === 'string' ? item.unit : null,
        threshold: typeof item.threshold === 'number' && Number.isFinite(item.threshold) ? item.threshold : null,
        approvedAt: typeof app.approved_at === 'string' ? app.approved_at : null,
      });
    }
  }
  return { company: company.company_name, approvedOutlets: outlets, approvedPollutants: [...approved.values()] };
}
