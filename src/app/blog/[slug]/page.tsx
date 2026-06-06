import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BkArticle from '@/components/blog/BkArticle';
import { getArticle, getArticleSlugs, getRelatedArticles } from '@/lib/blog/articles';
import { getCategory } from '@/lib/blog/categories';

const SITE = 'https://bokari.dev';

export const dynamic = 'force-dynamic';

// Articles are generated at runtime; don't pre-render at build (the DB is empty
// then). dynamicParams renders each slug on first request.
export async function generateStaticParams() {
  return [] as { slug: string }[];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: 'Article introuvable — Bokari' };

  const url = `${SITE}/blog/${article.slug}`;
  return {
    title: `${article.title} — Bokari`,
    description: article.excerpt,
    alternates: { canonical: url },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      url,
      type: 'article',
      siteName: 'Bokari',
      locale: 'fr_FR',
      publishedTime: article.publishedAt,
    },
    twitter: { card: 'summary_large_image', title: article.title, description: article.excerpt },
    robots: 'index,follow',
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const related = await getRelatedArticles(article.slug, article.category);
  const category = getCategory(article.category);

  const url = `${SITE}/blog/${article.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.excerpt,
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    articleSection: category?.label,
    author: { '@type': 'Organization', name: 'Bokari', url: SITE },
    publisher: { '@type': 'Organization', name: 'Dicken AI' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: 'fr',
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BkArticle article={article} related={related} />
    </>
  );
}
