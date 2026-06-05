import { redirect } from 'next/navigation';

/**
 * Chat shape — kept here because components still import this type (DeleteChat).
 */
export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  sources: string[];
  files: { fileId: string; name: string }[];
}

// The Bibliothèque page is gone — the chat history now lives directly in the
// sidebar. Any old /library link just bounces to the app.
export default function LibraryPage() {
  redirect('/');
}
