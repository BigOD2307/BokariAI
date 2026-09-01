import { ArrowLeftRight, Repeat } from 'lucide-react';

const Rewrite = ({
  rewrite,
  messageId,
}: {
  rewrite: (messageId: string) => void;
  messageId: string;
}) => {
  return (
    <button
      onClick={() => rewrite(messageId)}
      className="p-2 text-black/50 dark:text-white/45 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all duration-200 hover:text-black/60 dark:hover:text-white/50 flex items-center gap-1"
    >
      <Repeat size={16} />
    </button>
  );
};
1;
export default Rewrite;
