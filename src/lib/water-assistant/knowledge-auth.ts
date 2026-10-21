import { getSupabaseClient, getSupabaseServiceRoleKey } from '@/storage/database/supabase-client';
import { chinaDay } from '@/lib/china-time';

export type KnowledgeActor = { userId: string; role: 'admin' | 'enterprise'; park: string };
export type KnowledgeDocumentAccess = { visibility: 'public' | 'park' | 'enterprise'; park_name: string | null; company_user_id: string | null; uploaded_by: string; status: string; valid_from: string | null; valid_until: string | null };

export class KnowledgeError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function knowledgeActor(request: Request): Promise<KnowledgeActor> {
  const token = request.headers.get('x-auth-token');
  if (!token) throw new KnowledgeError('请先登录', 401);
  const client = getSupabaseClient(token);
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) throw new KnowledgeError('登录已失效', 401);
  const { data: profile, error: profileError } = await getSupabaseClient().from('profiles').select('role,park_name').eq('user_id', user.id).single();
  if (profileError || !profile || !['admin', 'enterprise'].includes(profile.role) || !profile.park_name) throw new KnowledgeError('账号未配置园区或无权限', 403);
  return { userId: user.id, role: profile.role, park: profile.park_name };
}

export function knowledgeAdminClient() {
  if (!getSupabaseServiceRoleKey()) throw new KnowledgeError('资料库服务端权限未配置', 503);
  return getSupabaseClient();
}

export function canReviewKnowledge(actor: KnowledgeActor, doc: KnowledgeDocumentAccess) {
  return actor.role === 'admin' && (doc.visibility === 'public' ? doc.uploaded_by === actor.userId : doc.park_name === actor.park);
}

export function canViewKnowledge(actor: KnowledgeActor, doc: KnowledgeDocumentAccess) {
  if (doc.status !== 'published') return false;
  const today = chinaDay(new Date());
  if (doc.valid_from && doc.valid_from > today || doc.valid_until && doc.valid_until < today) return false;
  return doc.visibility === 'public' || doc.park_name === actor.park &&
    (doc.visibility === 'park' || doc.company_user_id === actor.userId || actor.role === 'admin');
}

export function canOpenKnowledge(actor: KnowledgeActor, doc: KnowledgeDocumentAccess) {
  return doc.uploaded_by === actor.userId || canReviewKnowledge(actor, doc) || canViewKnowledge(actor, doc);
}
