import supabase from '@/lib/db';
import { HttpError } from './require';

/**
 * Assert that `chatId` is usable by `userId`, creating it if it does not exist.
 * Runs with the service-role client, so authorisation is entirely on us: a chat
 * owned by someone else is reported as 404, never 403 (a 403 would confirm the
 * id exists).
 */
export async function assertChatAccess(
  chatId: string,
  userId: string | null,
  titleIfNew: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('chats')
    .select('id, user_id')
    .eq('id', chatId)
    .maybeSingle();

  if (error) throw new HttpError(500, 'CHAT_LOOKUP_FAILED');

  if (!data) {
    const { error: insertError } = await supabase
      .from('chats')
      .insert({ id: chatId, user_id: userId, title: titleIfNew });
    // A concurrent insert of the same id is fine; anything else is not.
    if (insertError && insertError.code !== '23505') {
      throw new HttpError(500, 'CHAT_CREATE_FAILED');
    }
    return;
  }

  if (data.user_id !== userId) throw new HttpError(404, 'NOT_FOUND');
}
