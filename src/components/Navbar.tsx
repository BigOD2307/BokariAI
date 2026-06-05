import { ChevronLeft, Download, FileText, FileDown } from 'lucide-react';
import { useEffect, useState, Fragment } from 'react';
import DeleteChat from './DeleteChat';
import ShareButton from './MessageActions/ShareButton';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import jsPDF from 'jspdf';
import { useChat, Section } from '@/lib/hooks/useChat';
import { SourceBlock } from '@/lib/types';

const downloadFile = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
};

const exportAsMarkdown = (sections: Section[], title: string) => {
  const date = new Date(sections[0].message.createdAt || Date.now()).toLocaleString();
  let md = `# Chat Export: ${title}\n\n`;
  md += `*Exporte le: ${date}*\n\n---\n`;

  sections.forEach((section) => {
    md += `\n---\n`;
    md += `**Utilisateur**\n`;
    md += `*${new Date(section.message.createdAt).toLocaleString()}*\n\n`;
    md += `> ${section.message.query.replace(/\n/g, '\n> ')}\n`;

    if (section.message.responseBlocks.length > 0) {
      md += `\n---\n`;
      md += `**Bokari**\n`;
      md += `> ${section.message.responseBlocks
        .filter((b) => b.type === 'text')
        .map((block) => block.data)
        .join('\n')
        .replace(/\n/g, '\n> ')}\n`;
    }

    const sourceResponseBlock = section.message.responseBlocks.find(
      (block) => block.type === 'source',
    ) as SourceBlock | undefined;

    if (sourceResponseBlock && sourceResponseBlock.data && sourceResponseBlock.data.length > 0) {
      md += `\n**Sources:**\n`;
      sourceResponseBlock.data.forEach((src: any, i: number) => {
        const url = src.metadata?.url || '';
        md += `- [${i + 1}] [${url}](${url})\n`;
      });
    }
  });
  md += '\n---\n';
  downloadFile(`${title || 'chat'}.md`, md, 'text/markdown');
};

const exportAsPDF = (sections: Section[], title: string) => {
  const doc = new jsPDF();
  const date = new Date(sections[0]?.message?.createdAt || Date.now()).toLocaleString();
  let y = 15;
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(18);
  doc.text(`Chat: ${title}`, 10, y);
  y += 8;
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Exporte le: ${date}`, 10, y);
  y += 8;
  doc.setDrawColor(200);
  doc.line(10, y, 200, y);
  y += 6;
  doc.setTextColor(30);

  sections.forEach((section) => {
    if (y > pageHeight - 30) {
      doc.addPage();
      y = 15;
    }
    doc.setFont('helvetica', 'bold');
    doc.text('Utilisateur', 10, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
    doc.setFontSize(12);
    const userLines = doc.splitTextToSize(section.message.query, 180);
    for (let i = 0; i < userLines.length; i++) {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 15;
      }
      doc.text(userLines[i], 12, y);
      y += 6;
    }
    y += 4;
    doc.line(10, y, 200, y);
    y += 4;

    if (section.message.responseBlocks.length > 0) {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 15;
      }
      doc.setFont('helvetica', 'bold');
      doc.text('Bokari', 10, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      const assistantLines = doc.splitTextToSize(section.parsedTextBlocks.join('\n'), 180);
      for (let i = 0; i < assistantLines.length; i++) {
        if (y > pageHeight - 20) {
          doc.addPage();
          y = 15;
        }
        doc.text(assistantLines[i], 12, y);
        y += 6;
      }
      y += 6;
      doc.line(10, y, 200, y);
      y += 4;
    }
  });
  doc.save(`${title || 'chat'}.pdf`);
};

/**
 * Navbar — the chat top bar (active conversations). Perplexity-style, adapted to
 * Bokari Canvas: the thread title on the left; on the right a "Partager" button
 * (public link), a "Télécharger" menu (PDF / Markdown), and delete.
 */
const Navbar = () => {
  const [title, setTitle] = useState<string>('');
  const { sections, chatId } = useChat();

  useEffect(() => {
    if (sections.length > 0 && sections[0].message) {
      const q = sections[0].message.query;
      setTitle(q.length > 48 ? `${q.substring(0, 48).trim()}…` : q || 'Nouvelle conversation');
    }
  }, [sections]);

  const downloadBtn =
    'font-hand inline-flex items-center gap-1.5 rounded-[10px] border-2 border-[color:var(--bk-ink,#0f172a)]/15 px-3 py-1.5 text-[14px] uppercase tracking-wide text-[color:var(--bk-ink-soft,#334155)] transition-colors hover:border-[color:var(--bk-ink,#0f172a)] hover:text-[color:var(--bk-ink,#0f172a)] focus:outline-none';

  return (
    <div className="sticky -mx-4 top-0 z-40 border-b-2 border-[color:var(--bk-ink,#0f172a)] bg-[color:var(--bk-paper,#ffffff)]/85 backdrop-blur-md lg:mx-0">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 lg:px-5">
        {/* Left — back (mobile) + thread title */}
        <div className="flex min-w-0 items-center gap-2">
          <a
            href="/"
            className="-ml-1 rounded-[10px] p-1.5 text-[color:var(--bk-ink-soft,#334155)] transition-colors hover:bg-[color:var(--bk-mint,#c8f4e0)]/50 hover:text-[color:var(--bk-ink,#0f172a)] lg:hidden"
            aria-label="Retour"
          >
            <ChevronLeft size={18} strokeWidth={2.2} />
          </a>
          <h1 className="truncate text-[14px] font-medium text-[color:var(--bk-ink,#0f172a)]">
            {title || 'Nouvelle conversation'}
          </h1>
        </div>

        {/* Right — Partager · Télécharger · Supprimer */}
        <div className="flex flex-shrink-0 items-center gap-2">
          {chatId && <ShareButton chatId={chatId} variant="button" />}

          <Popover className="relative">
            <PopoverButton className={downloadBtn} aria-label="Télécharger la conversation">
              <Download size={15} strokeWidth={2.2} />
              <span className="hidden sm:inline">PDF</span>
            </PopoverButton>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-150"
              enterFrom="opacity-0 translate-y-1"
              enterTo="opacity-100 translate-y-0"
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-1"
            >
              <PopoverPanel className="absolute right-0 z-50 mt-2 w-52 origin-top-right overflow-hidden rounded-[12px] border-2 border-[color:var(--bk-ink,#0f172a)] bg-white shadow-[0_12px_28px_-12px_rgba(15,23,42,0.35)]">
                <div className="p-1.5">
                  <p className="font-hand px-2.5 py-1.5 text-[11px] uppercase tracking-wide text-[color:var(--bk-teal-700,#0f766e)]">
                    Télécharger
                  </p>
                  <button
                    className="font-hand flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] text-[color:var(--bk-ink,#0f172a)] transition-colors hover:bg-[color:var(--bk-mint,#c8f4e0)]/40"
                    onClick={() => exportAsPDF(sections, title || '')}
                  >
                    <FileDown size={15} strokeWidth={2.2} className="text-[color:var(--bk-teal-600,#0d9488)]" />
                    En PDF
                  </button>
                  <button
                    className="font-hand flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] text-[color:var(--bk-ink,#0f172a)] transition-colors hover:bg-[color:var(--bk-mint,#c8f4e0)]/40"
                    onClick={() => exportAsMarkdown(sections, title || '')}
                  >
                    <FileText size={15} strokeWidth={2.2} className="text-[color:var(--bk-teal-600,#0d9488)]" />
                    En Markdown
                  </button>
                </div>
              </PopoverPanel>
            </Transition>
          </Popover>

          <DeleteChat redirect chatId={chatId!} chats={[]} setChats={() => {}} />
        </div>
      </div>
    </div>
  );
};

export default Navbar;
