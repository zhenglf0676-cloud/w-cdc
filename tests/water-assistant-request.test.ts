import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AssistantSessionError, requestWithTokenRetry } from '../src/lib/water-assistant/request';

test('a rejected access token is refreshed and the request is retried once', async () => {
  const used: string[] = [];
  const response = await requestWithTokenRetry(
    async token => { used.push(token); return new Response(null, { status: token === 'old' ? 401 : 200 }); },
    async () => 'old', async () => 'new',
  );
  assert.equal(response.status, 200);
  assert.deepEqual(used, ['old', 'new']);
});

test('other failures are not retried and a second 401 asks the user to sign in', async () => {
  let refreshes = 0;
  const unavailable = await requestWithTokenRetry(
    async () => new Response(null, { status: 503 }),
    async () => 'current', async () => { refreshes++; return 'new'; },
  );
  assert.equal(unavailable.status, 503);
  assert.equal(refreshes, 0);
  await assert.rejects(() => requestWithTokenRetry(
    async () => new Response(null, { status: 401 }),
    async () => 'old', async () => { refreshes++; return 'new'; },
  ), AssistantSessionError);
  assert.equal(refreshes, 1);
});
