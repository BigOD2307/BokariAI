/**
 * @module lib/export/chatExport
 * @description Client-side chat export helpers (Markdown + PDF), shared by the
 *   desktop Navbar and the mobile actions menu so both produce identical files.
 */
import jsPDF from 'jspdf';
import type { Section } from '@/lib/hooks/useChat';
import type { SourceBlock } from '@/lib/types';

function downloadFile(filename: string, content: string, type: string) {
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
}

export function exportChatAsMarkdown(sections: Section[], title: string) {
  if (sections.length === 0) return;
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
}

export function exportChatAsPDF(sections: Section[], title: string) {
  if (sections.length === 0) return;
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
      const assistantLines = doc.splitTextToSize(
        section.parsedTextBlocks.join('\n'),
        180,
      );
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
}
