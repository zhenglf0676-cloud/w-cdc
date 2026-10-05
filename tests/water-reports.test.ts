import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { analyze, exceeded, period, type Company, type Outlet, type Reading } from '../src/lib/water-reports/model';
import { reportData } from '../src/lib/water-reports/data';
const companies: Company[] = [{ id: 'a', user_id: 'ua', company_name: '甲企业', park_name: '园区甲' }, { id: 'b', user_id: 'ub', company_name: '乙企业', park_name: '园区甲' }, { id: 'c', user_id: 'uc', company_name: '外园企业', park_name: '园区乙' }];
const outlets: Outlet[] = [{ id: 'a1', user_id: 'ua', name: '甲1' }, { id: 'a2', user_id: 'ua', name: '甲2' }, { id: 'b1', user_id: 'ub', name: '乙1' }, { id: 'c1', user_id: 'uc', name: '外园1' }];
const reading = (id: string, outlet_id: string, value: number, at = '2026-09-24T15:00:00+08:00'): Reading => ({ id, outlet_id, value, monitored_at: new Date(at).toISOString(), pollutant_type: 'cod', standard_limit: 10, unit: 'mg/L' });
const readings = [reading('1','a1',20,'2026-09-24T09:00:00+08:00'), reading('2','a1',6), reading('3','a2',5), reading('4','b1',30), reading('5','c1',999)];
const pollutants = { a: [{id:'cod',label:'COD',unit:'mg/L'}], b: [{id:'cod',label:'COD',unit:'mg/L'}], c: [{id:'cod',label:'COD',unit:'mg/L'}] };
function fake(role = 'enterprise', records = readings, broken = false) {
  const profiles = [...companies.map(c => ({ ...c, role: 'enterprise' })), { id:'admin', user_id:'um', role:'admin', park_name:'园区甲' }];
  const db: Record<string, Record<string, unknown>[]> = { profiles, discharge_outlets: outlets.map(o => ({...o,status:'approved'})), monitoring_data: records, pollutant_applications: companies.map(c => ({id:c.id, company_id:c.id,status:'approved',pollutants:[{id:'cod',label:'COD',unit:'mg/L'}]})) };
  const accesses: {table:string; rows:Record<string,unknown>[]}[] = [];
  const client = { auth: { getUser: async (token: string) => ({ data: {user:token==='invalid'?null:{id:role==='admin'?'um':'ua'}},error:null}) }, from(table: string) {
    let rows = [...db[table]], first = 0, last = Infinity, single = false;
    const q = {select(){return q},eq(k:string,v:unknown){rows=rows.filter(r=>r[k]===v);return q},in(k:string,v:unknown[]){rows=rows.filter(r=>v.includes(r[k]));return q},gte(k:string,v:string){rows=rows.filter(r=>String(r[k])>=v);return q},lt(k:string,v:string){rows=rows.filter(r=>String(r[k])<v);return q},order(k:string){rows.sort((a,b)=>String(a[k]).localeCompare(String(b[k])));return q},range(f:number,l:number){first=f;last=l;return q},single(){single=true;return q},then(resolve:(r:unknown)=>unknown){const page=rows.slice(first,last+1);accesses.push({table,rows:page});return Promise.resolve(resolve({data:single?page[0]:page,error:broken&&table==='monitoring_data'?{message:'DB failure'}:null}))}};
    return q;
  }};
  return { client: client as unknown as SupabaseClient, accesses };
}
test('daily latest is 6+5, zero replaces old maximum, strict thresholds',()=>{ const result=analyze(companies.slice(0,2),outlets,readings,pollutants);assert.equal(result[0].daily.cod['2026-09-24'],11);assert.equal(exceeded(reading('eq','a1',10)),false);assert.equal(exceeded({...reading('none','a1',100),standard_limit:null}),false);const z=analyze(companies.slice(0,1),outlets,[reading('old','a1',20,'2026-09-24T09:00:00+08:00'),reading('new','a1',0)],pollutants);assert.equal(z[0].daily.cod['2026-09-24'],0);assert.equal(z[0].cdc,null); });
test('date boundaries are Chinese calendar dates',()=>{assert.equal(period('2026-09-24','2026-09-24').from,'2026-09-23T16:00:00.000Z');assert.equal(period('2026-09-24','2026-09-24').to,'2026-09-24T16:00:00.000Z');assert.throws(()=>period('2026-02-30','2026-03-01'));assert.throws(()=>period('2026-09-25','2026-09-24'));});
test('enterprise cannot export other enterprises; CDC references only own park',async()=>{const f=fake();const report=await reportData(f.client,'valid','enterprise','2026-09-24','2026-09-24');assert.deepEqual(report.companies.map(c=>c.id),['a']);assert(!JSON.stringify(report).includes('外园'));assert(f.accesses.filter(a=>a.table==='monitoring_data').every(a=>a.rows.every(r=>r.outlet_id!=='c1')));});
test('administrator exports own park only',async()=>{const f=fake('admin');const report=await reportData(f.client,'valid','admin','2026-09-24','2026-09-24');assert.deepEqual(report.companies.map(c=>c.id),['a','b']);});
test('invalid identity and wrong role fail before reading monitoring data',async()=>{for(const [token,role] of [['invalid','enterprise'],['valid','admin']] as const){const f=fake();await assert.rejects(reportData(f.client,token,role,'2026-09-24','2026-09-24'));assert(!f.accesses.some(a=>a.table==='monitoring_data'));}});
test('pagination includes records after first 500 and excludes next-day boundary',async()=>{const rows=Array.from({length:1101},(_,i)=>reading(String(i).padStart(5,'0'),'a1',i));rows.push(reading('outside','a1',999,'2026-09-25T00:00:00+08:00'));const f=fake('enterprise',rows);const r=await reportData(f.client,'valid','enterprise','2026-09-24','2026-09-24');assert.equal(r.companies[0].records.length,1101);});
test('empty data and database failure never create a normal report',async()=>{await assert.rejects(reportData(fake('enterprise',[]).client,'valid','enterprise','2026-09-24','2026-09-24'));await assert.rejects(reportData(fake('enterprise',readings,true).client,'valid','enterprise','2026-09-24','2026-09-24'));});
