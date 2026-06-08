import { notFound } from 'next/navigation';
import PublicChatView from '@/components/Public/PublicChatView';
import type { PublicChatView as PublicChatViewData } from '@/lib/types/shares';
import type { Metadata } from 'next';

const STRAPI = 'https://bokari.space';
const SITE_NAME = 'Bokari';
const SITE_TAGLINE = 'AI for Africa, with citations you can trust';

const fetchPublicChat = async (slug: string): Promise<PublicChatViewData | null> => {
  try {
    const url = `${STRAPI}/api/p/${encodeURIComponent(slug)}`;
    const response = await fetch(url, {
      next: { revalidate: 3600 },
      headers: { 'User-Agent': 'Bokari-Pages/1.0' },
    });
    if (!response.ok) return null;
    return (await response.json()) as PublicChatViewData;
  } catch {
    return null;
  }
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchPublicChat(slug);
  if (!data) {
    return { title: 'Page introuvable - Bokari' };
  }
  const question = data.firstUserMessage?.content.slice(0, 100) ?? data.chat.title;
  const description = data.answer.slice(0, 200) || data.chat.title;
  const ogImage = `${STRAPI}/api/og?slug=${encodeURIComponent(slug)}`;
  return {
    title: `${question} - Bokari`,
    description,
    openGraph: {
      title: question,
      description,
      url: `${STRAPI}/p/${slug}`,
      siteName: SITE_NAME,
      type: 'article',
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: question,
      description,
      images: [ogImage],
    },
    alternates: { canonical: `${STRAPI}/p/${slug}` },
    robots: data.share.isIndexed ? 'index,follow' : 'noindex,nofollow',
  };
}

export const revalidate = 3600;

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await fetchPublicChat(slug);
  if (!data) notFound();
  return <PublicChatView data={data} />;
}
