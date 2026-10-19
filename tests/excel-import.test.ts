import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseExcelChinaTime } from '../src/lib/water-assistant/excel-time';

test('Excel serial and Beijing local string are stored as the same UTC instant', () => {
  assert.equal(parseExcelChinaTime(46308.375)?.toISOString(), '2026-10-13T01:00:00.000Z');
  assert.equal(parseExcelChinaTime('2026-10-13 09:00')?.toISOString(), '2026-10-13T01:00:00.000Z');
  assert.equal(parseExcelChinaTime('2026-10-13T09:00')?.toISOString(), '2026-10-13T01:00:00.000Z');
  assert.equal(parseExcelChinaTime('2026-02-30 09:00'), null);
});

