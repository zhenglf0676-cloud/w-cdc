import { z } from 'zod';
import sharp from 'sharp';

export const MAX_ASSISTANT_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = Math.ceil(MAX_ASSISTANT_IMAGE_BYTES * 4 / 3) + 64;

export const assistantImageInput = z.object({
  name: z.string().min(1).max(120),
  dataUrl: z.string().max(MAX_DATA_URL_LENGTH),
}).strict().superRefine((image, ctx) => {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image.dataUrl);
  if (!match) {
    ctx.addIssue({ code: 'custom', message: '仅支持 PNG、JPG、WEBP 图片' });
    return;
  }
  const bytes = Buffer.from(match[2], 'base64');
  const valid = bytes.length > 0 && bytes.length <= MAX_ASSISTANT_IMAGE_BYTES
    && bytes.toString('base64') === match[2]
    && (match[1] === 'png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      || match[1] === 'jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      || match[1] === 'webp' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP');
  if (!valid) ctx.addIssue({ code: 'custom', message: '图片格式不符或超过 2MB' });
});

export type AssistantImageInput = z.infer<typeof assistantImageInput>;

/** Reject truncated images and unusually large dimensions before invoking the vision model. */
export async function imageHasUsableDimensions(image: AssistantImageInput): Promise<boolean> {
  try {
    const bytes = Buffer.from(image.dataUrl.slice(image.dataUrl.indexOf(',') + 1), 'base64');
    const { width, height } = await sharp(bytes, { limitInputPixels: 20_000_000 }).metadata();
    return !!width && !!height && width > 10 && height > 10 && Math.max(width / height, height / width) <= 200;
  } catch {
    return false;
  }
}
