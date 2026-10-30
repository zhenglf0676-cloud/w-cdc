import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { assistantImageInput, imageHasUsableDimensions } from '../src/lib/water-assistant/image-input';

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

test('accepts a PNG data URI and rejects disguised or oversized payloads', () => {
  assert.equal(assistantImageInput.safeParse({ name: 'chart.png', dataUrl: `data:image/png;base64,${png.toString('base64')}` }).success, true);
  assert.equal(assistantImageInput.safeParse({ name: 'chart.png', dataUrl: `data:image/jpeg;base64,${png.toString('base64')}` }).success, false);
  assert.equal(assistantImageInput.safeParse({ name: 'chart.png', dataUrl: 'https://private-server/image.png' }).success, false);
  assert.equal(assistantImageInput.safeParse({ name: 'chart.png', dataUrl: `data:image/png;base64,${Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024)]).toString('base64')}` }).success, false);
});

test('rejects truncated images and tiny screenshots before calling the model', async () => {
  assert.equal(await imageHasUsableDimensions({ name: 'broken.png', dataUrl: `data:image/png;base64,${png.toString('base64')}` }), false);
  const valid = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#147d81' } }).png().toBuffer();
  assert.equal(await imageHasUsableDimensions({ name: 'valid.png', dataUrl: `data:image/png;base64,${valid.toString('base64')}` }), true);
});
