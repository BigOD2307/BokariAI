import { Clock, Edit, Share, FileText, FileDown, ChevronLeft } from 'lucide-react';
import { Message } from './ChatWindow';
import { useEffect, useState, Fragment } from 'react';
import { formatTimeDifference } from '@/lib/utils';
import DeleteChat from './DeleteChat';
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
  const date = new Date(
    sections[0].message.createdAt || Date.now(),
  ).toLocaleString();
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

    if (
      sourceResponseBlock &&
      sourceResponseBlock.data &&
      sourceResponseBlock.data.length > 0
    ) {
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
  const date = new Date(
    sections[0]?.message?.createdAt || Date.now(),
  ).toLocaleString();
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
    if (y > pageHeight - 30) { doc.addPage(); y = 15; }
    doc.setFont('helvetica', 'bold');
    doc.text('Utilisateur', 10, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
    doc.setFontSize(12);
    const userLines = doc.splitTextToSize(section.message.query, 180);
    for (let i = 0; i < userLines.length; i++) {
      if (y > pageHeight - 20) { doc.addPage(); y = 15; }
      doc.text(userLines[i], 12, y);
      y += 6;
    }
    y += 4;
    doc.line(10, y, 200, y);
    y += 4;

    if (section.message.responseBlocks.length > 0) {
      if (y > pageHeight - 30) { doc.addPage(); y = 15; }
      doc.setFont('helvetica', 'bold');
      doc.text('Bokari', 10, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      const assistantLines = doc.splitTextToSize(
        section.parsedTextBlocks.join('\n'),
        180,
      );
      for (let i = 0; i < assistantLines.length; i++) {
        if (y > pageHeight - 20) { doc.addPage(); y = 15; }
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

const Navbar = () => {
  const [title, setTitle] = useState<string>('');
  const [timeAgo, setTimeAgo] = useState<string>('');

  const { sections, chatId } = useChat();

  useEffect(() => {
    if (sections.length > 0 && sections[0].message) {
      const newTitle =
        sections[0].message.query.length > 40
          ? `${sections[0].message.query.substring(0, 40).trim()}...`
          : sections[0].message.query || 'Nouvelle conversation';

      setTitle(newTitle);
      const newTimeAgo = formatTimeDifference(
        new Date(),
        sections[0].message.createdAt,
      );
      setTimeAgo(newTimeAgo);
    }
  }, [sections]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (sections.length > 0 && sections[0].message) {
        const newTimeAgo = formatTimeDifference(
          new Date(),
          sections[0].message.createdAt,
        );
        setTimeAgo(newTimeAgo);
      }
    }, 1000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="sticky -mx-4 lg:mx-0 top-0 z-40 border-b-2 border-[color:var(--bk-ink,#0f172a)] bg-[color:var(--bk-paper,#ffffff)]/85 backdrop-blur-md">
      <div className="px-4 lg:px-2 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center min-w-0">
            <a
              href="/"
              className="lg:hidden mr-2 p-2 -ml-2 rounded-xl hover:bg-[color:var(--bk-mint,#c8f4e0)]/50 transition-colors duration-200"
            >
              <ChevronLeft size={18} className="text-[color:var(--bk-ink-soft,#334155)]" />
            </a>
            <div className="hidden lg:flex items-center gap-2 text-[color:var(--bk-ink,#0f172a)]/40">
              <Clock size={12} />
              <span className="text-[11px]">{timeAgo}</span>
            </div>
          </div>

          <div className="flex-1 mx-4 min-w-0">
            <h1 className="truncate text-center text-[13px] font-medium text-[color:var(--bk-ink,#0f172a)]/75">
              {title || 'Nouvelle conversation'}
            </h1>
          </div>

          <div className="flex items-center gap-0.5 min-w-0">
            <Popover className="relative">
              <PopoverButton className="p-2 rounded-xl hover:bg-[color:var(--bk-mint,#c8f4e0)]/50 transition-colors duration-200 outline-none">
                <Share size={15} className="text-[color:var(--bk-ink-soft,#334155)]" />
              </PopoverButton>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="opacity-0 translate-y-1"
                enterTo="opacity-100 translate-y-0"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 translate-y-1"
              >
                <PopoverPanel className="absolute right-0 z-50 mt-2 w-52 origin-top-right overflow-hidden rounded-[14px] border-2 border-[color:var(--bk-ink,#0f172a)] bg-white shadow-[0_12px_28px_-12px_rgba(15,23,42,0.35)]">
                  <div className="p-1.5">
                    <p className="font-hand px-2.5 py-2 text-[11px] uppercase tracking-wide text-[color:var(--bk-teal-700,#0f766e)]">
                      Exporter
                    </p>
                    <button
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left rounded-lg hover:bg-[color:var(--bk-mint,#c8f4e0)]/50 transition-colors duration-200"
                      onClick={() => exportAsMarkdown(sections, title || '')}
                    >
                      <FileText size={14} className="text-bokari-500" />
                      <span className="text-[13px] text-[color:var(--bk-ink,#0f172a)]">
                        Markdown
                      </span>
                    </button>
                    <button
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left rounded-lg hover:bg-[color:var(--bk-mint,#c8f4e0)]/50 transition-colors duration-200"
                      onClick={() => exportAsPDF(sections, title || '')}
                    >
                      <FileDown size={14} className="text-bokari-500" />
                      <span className="text-[13px] text-[color:var(--bk-ink,#0f172a)]">
                        PDF
                      </span>
                    </button>
                  </div>
                </PopoverPanel>
              </Transition>
            </Popover>
            <DeleteChat
              redirect
              chatId={chatId!}
              chats={[]}
              setChats={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
