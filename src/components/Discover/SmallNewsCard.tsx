import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

interface DiscoverItem {
  title: string;
  content: string;
  url: string;
  thumbnail: string;
}

const SmallNewsCard = ({ item }: { item: DiscoverItem }) => {
  const imgSrc = (() => {
    try {
      const u = new URL(item.thumbnail);
      return u.origin + u.pathname + `?id=${u.searchParams.get('id')}`;
    } catch {
      return item.thumbnail;
    }
  })();

  const domain = (() => {
    try {
      return new URL(item.url).hostname.replace('www.', '');
    } catch {
      return '';
    }
  })();

  return (
    <Link
      href={`/?q=Summary: ${item.url}`}
      className="group rounded-2xl overflow-hidden border border-black/[0.05] dark:border-white/[0.05] hover:border-black/[0.1] dark:hover:border-white/[0.1] bg-white dark:bg-white/[0.02] hover:shadow-md transition-all duration-300 flex flex-col"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-black/[0.03] dark:bg-white/[0.03]">
        <img
          className="object-cover w-full h-full group-hover:scale-[1.03] transition-transform duration-500"
          src={imgSrc}
          alt={item.title}
        />
        <div className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-white/80 dark:bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
          <ArrowUpRight size={11} className="text-black/70 dark:text-white/70" />
        </div>
      </div>
      <div className="p-3.5 flex flex-col flex-1">
        <h3 className="font-medium text-[13px] mb-1.5 leading-snug line-clamp-2 text-black/85 dark:text-white/85 group-hover:text-bokari-600 dark:group-hover:text-bokari-400 transition-colors duration-300">
          {item.title}
        </h3>
        <p className="text-black/40 dark:text-white/35 text-[11.5px] leading-relaxed line-clamp-2 mb-3">
          {item.content}
        </p>
        {domain && (
          <div className="mt-auto flex items-center gap-1.5">
            <img
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
              alt=""
              className="w-3.5 h-3.5 rounded-sm"
            />
            <span className="text-[10px] text-black/30 dark:text-white/25 truncate max-w-[120px]">
              {domain}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
};

export default SmallNewsCard;
