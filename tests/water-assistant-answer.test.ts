import { test } from 'node:test';
import assert from 'node:assert/strict';
import { presentAnswer } from '../src/lib/water-assistant/answer';

test('structured answer separates the main result while keeping the caveat visible and details intact', () => {
  const answer = presentAnswer('【结论】10 月 19 日有 2 条超过审批上限。\n【要点】\n- **COD** 650 / 500 mg/L\n- TP 1.6 / 1 mg/L\n【提醒】审批上限不等于法定排放限值。\n【展开】\n完整逐条记录可查看证据。');
  assert.equal(answer.summary, '10 月 19 日有 2 条超过审批上限。');
  assert.deepEqual(answer.points, ['**COD** 650 / 500 mg/L', 'TP 1.6 / 1 mg/L']);
  assert.equal(answer.caution, '审批上限不等于法定排放限值。');
  assert.equal(answer.detail, '完整逐条记录可查看证据。');
});

test('older paragraph replies remain completely readable after collapsing', () => {
  const original = '您企业的审批配置如下。已审批排污口 cqust-1、cqust-2、cqust-3。COD 审批上限 500 mg/L。'.repeat(6);
  const answer = presentAnswer(original);
  assert.ok(answer.summary.length > 0);
  assert.ok(answer.detail.length > 0);
  assert.equal(answer.summary + answer.detail, original);
});
