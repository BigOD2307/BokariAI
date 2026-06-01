import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

interface DiscoverItem {
  title: string;
  content: string;
  url: string;
  thumbnail: string;
}

const MajorNewsCard = ({
  item,
  isLeft = true,
}: {
  item: DiscoverItem;
  isLeft?: boolean;
}) => {
  const imgSrc = (() => {
    try {
      const u = new URL(item.thumbnail);
      return u.origin + u.pathname + `?id=${u.searchParams.get('id')}`;
    } catch {
      return item.thumbnail;
    }
  })();

  return (
    <Link
      href={`/?q=Summary: ${item.url}`}
      className="w-full group flex flex-row items-stretch gap-6 h-56 py-2"
      target="_blank"
    >
      {isLeft ? (
        <>
          <div className="relative w-72 h-full overflow-hidden rounded-2xl flex-shrink-0 bg-black/[0.03] dark:bg-white/[0.03]">
            <img
              className="object-cover w-full h-full group-hover:scale-[1.03] transition-transform duration-500"
              src={imgSrc}
              alt={item.title}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
          <div className="flex flex-col justify-center flex-1 py-2">
            <h2
              className="text-2xl font-normal mb-2.5 leading-snug line-clamp-3 text-black/85 dark:text-white/85 group-hover:text-bokari-600 dark:group-hover:text-bokari-400 transition-colors duration-300"
              style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}
            >
              {item.title}
            </h2>
            <p className="text-black/45 dark:text-white/40 text-sm leading-relaxed line-clamp-3">
              {item.content}
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-bokari-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span className="text-xs font-medium">Lire avec Bokari</span>
              <ArrowUpRight size={12} />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col justify-center flex-1 py-2">
            <h2
              className="text-2xl font-normal mb-2.5 leading-snug line-clamp-3 text-black/85 dark:text-white/85 group-hover:text-bokari-600 dark:group-hover:text-bokari-400 transition-colors duration-300"
              style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}
            >
              {item.title}
            </h2>
            <p className="text-black/45 dark:text-white/40 text-sm leading-relaxed line-clamp-3">
              {item.content}
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-bokari-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span className="text-xs font-medium">Lire avec Bokari</span>
              <ArrowUpRight size={12} />
            </div>
          </div>
          <div className="relative w-72 h-full overflow-hidden rounded-2xl flex-shrink-0 bg-black/[0.03] dark:bg-white/[0.03]">
            <img
              className="object-cover w-full h-full group-hover:scale-[1.03] transition-transform duration-500"
              src={imgSrc}
              alt={item.title}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        </>
      )}
    </Link>
  );
};

export default MajorNewsCard;
