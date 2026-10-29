import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

export class AssistantSessionError extends Error {
  constructor() {
    super('登录状态已失效，请重新登录后继续。');
    this.name = 'AssistantSessionError';
  }
}

async function accessToken(refresh: boolean): Promise<string> {
  const auth = getSupabaseBrowserClient().auth;
  const { data, error } = refresh ? await auth.refreshSession() : await auth.getSession();
  if (error) throw new Error('登录状态暂时无法更新，请稍后重试；若持续出现，请重新登录。');
  if (!data.session) throw new AssistantSessionError();
  return data.session.access_token;
}

/** Read the current browser session before each request; retry an auth rejection once. */
export async function assistantFetch(request: (token: string) => Promise<Response>, signal?: AbortSignal): Promise<Response> {
  return requestWithTokenRetry(request, () => accessToken(false), () => accessToken(true), signal);
}

export async function requestWithTokenRetry(
  request: (token: string) => Promise<Response>,
  currentToken: () => Promise<string>,
  refreshToken: () => Promise<string>,
  signal?: AbortSignal,
): Promise<Response> {
  signal?.throwIfAborted();
  let response = await request(await currentToken());
  if (response.status !== 401) return response;

  signal?.throwIfAborted();
  response = await request(await refreshToken());
  if (response.status === 401) throw new AssistantSessionError();
  return response;
}
