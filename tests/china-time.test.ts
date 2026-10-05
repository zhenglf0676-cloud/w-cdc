import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { chinaDay, chinaPeriod, recentChinaDays } from '../src/lib/china-time';
import { period, dailyLatest, type Reading } from '../src/lib/water-reports/model';
test('Beijing midnight includes the first instant and excludes next midnight without overlap', () => {
  const r = chinaPeriod('2026-10-05', '2026-10-05');
  const samples = ['2026-10-04T15:59:59.999Z','2026-10-04T16:00:00.000Z','2026-10-04T18:00:00.000Z','2026-10-05T15:59:59.999Z','2026-10-05T16:00:00.000Z'];
  assert.deepEqual(samples.filter(s => s >= r.from && s < r.to), samples.slice(1,4));
  assert.equal(chinaPeriod('2026-10-06','2026-10-06').from, r.to);
  assert.deepEqual(period('2026-10-05','2026-10-05'),r);
});
test('seven calendar days include today; UTC afternoon is already next Beijing day', () => {
  const r = recentChinaDays(7,new Date('2026-10-04T18:00:00Z'));
  assert.equal(r.start,'2026-09-29'); assert.equal(r.end,'2026-10-05');
  assert.equal(Date.parse(r.to)-Date.parse(r.from),7*86400000);
  assert.equal(chinaDay('2026-10-04T18:00:00Z'),'2026-10-05');
});
test('leap day, year transition and invalid date inputs', () => {
  assert.equal(recentChinaDays(7,new Date('2026-01-01T00:00:00+08:00')).start,'2025-12-26');
  assert.equal(chinaPeriod('2024-02-29','2024-02-29').to,'2024-02-29T16:00:00.000Z');
  for (const bad of ['2026-02-29','2026-02-30','2026-13-01','garbage',null]) assert.throws(()=>chinaPeriod(bad,'2026-10-05'));
  assert.throws(()=>chinaPeriod('2026-10-06','2026-10-05'));
  for (const n of [0,-1,NaN,1.5]) assert.throws(()=>recentChinaDays(n));
});
test('daily latest groups midnight readings into the same days as query boundaries', () => {
  const row = (id:string,outlet_id:string,value:number,monitored_at:string):Reading => ({id,outlet_id,value,monitored_at,pollutant_type:'cod',unit:'mg/L',standard_limit:10});
  const result=dailyLatest([row('old','a',20,'2026-10-04T15:59:59Z'),row('new','a',6,'2026-10-04T16:00:00Z'),row('other','b',5,'2026-10-04T18:00:00Z')]);
  assert.equal(result.cod['2026-10-04'],20);assert.equal(result.cod['2026-10-05'],11);
});
