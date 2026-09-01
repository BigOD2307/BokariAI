import { Check, ClipboardList } from 'lucide-react';
import { Message } from '../ChatWindow';
import { useState } from 'react';
import { Section } from '@/lib/hooks/useChat';
import { SourceBlock } from '@/lib/types';

const Copy = ({
  section,
  initialMessage,
}: {
  section: Section;
  initialMessage: string;
}) => {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        const sources = section.message.responseBlocks.filter(
          (b) => b.type === 'source' && b.data.length > 0,
        ) as SourceBlock[];

        const contentToCopy = `${initialMessage}${
          sources.length > 0
            ? `\n\nCitations:\n${sources
                .map((source) => source.data)
                .flat()
                .map(
                  (s, i) =>
                    `[${i + 1}] ${s.metadata.url.startsWith('file_id://') ? s.metadata.fileName || 'Uploaded File' : s.metadata.url}`,
                )
                .join(`\n`)}`
            : ''
        }`;

        navigator.clipboard.writeText(contentToCopy);

        setCopied(true);
        setTimeout(() => setCopied(false), 1000);
      }}
      className="p-2 text-black/50 dark:text-white/45 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all duration-200 hover:text-black/60 dark:hover:text-white/50"
    >
      {copied ? <Check size={16} /> : <ClipboardList size={16} />}
    </button>
  );
};

export default Copy;
