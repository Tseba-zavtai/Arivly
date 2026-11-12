import { supabase } from '@/lib/supabase';
import { normalizeHomePage, type HomePageContent } from './homePageContent';
export type HomePageRecord = { content: HomePageContent; revision: number; updatedAt: string | null };
export async function readHomePage(state: 'published' | 'draft'): Promise<HomePageRecord> {
  const { data, error } = await supabase.from('web_home_pages').select('content,revision,updated_at').eq('state', state).single();
  if (error) throw new Error(error.code === 'PGRST205' || error.code === '42P01' ? 'Нүүрийн удирдлагын сан хараахан холбогдоогүй байна.' : 'Нүүрийн агуулгыг уншиж чадсангүй. Нэвтрэлт болон холболтоо шалгаад дахин оролдоорой.');
  return { content: normalizeHomePage(data.content), revision: data.revision, updatedAt: data.updated_at };
}
export async function saveHomeDraft(content: HomePageContent, expectedRevision: number): Promise<number> {
  const { data, error } = await supabase.rpc('save_web_home_draft', { p_content: normalizeHomePage(content), p_expected_revision: expectedRevision });
  if (error) throw new Error(error.message.includes('CONTENT_CONFLICT') ? 'Өөр цонхонд өөрчлөлт хадгалсан байна. Хуудсаа дахин ачаалаад өөрчлөлтүүдээ нэгтгэнэ үү.' : error.message.includes('INVALID_CONTENT') ? 'Агуулгын хэмжээ эсвэл бүтэц тохирохгүй байна. Хэсгүүдээ шалгаарай.' : 'Нооргийг хадгалж чадсангүй. Нэвтрэлт болон холболтоо шалгаад дахин оролдоорой.');
  return data as number;
}
export async function publishHomeDraft(expectedRevision: number): Promise<void> {
  const { error } = await supabase.rpc('publish_web_home_draft', { p_expected_revision: expectedRevision });
  if (error) throw new Error(error.message.includes('CONTENT_CONFLICT') ? 'Ноорог өөрчлөгдсөн байна. Дахин ачаалж шалгаад нийтлээрэй.' : 'Нийтэлж чадсангүй. Нэвтрэлт болон холболтоо шалгаад дахин оролдоорой.');
}
export async function uploadHomeImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('PNG, JPG, WebP зураг сонгоно уу. Дээд хэмжээ 5 MB.');
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Нэвтэрнэ үү.');
  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'png';
  const path = `${auth.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const { error } = await supabase.storage.from('web-content').upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from('web-content').getPublicUrl(path).data.publicUrl;
}
