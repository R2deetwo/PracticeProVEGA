/**
 * PrintPreviewDrawer — a slide-in panel that shows a live print-ready
 * preview of the DraftPro document. Renders an iframe with the document
 * HTML styled for print (A4 page, proper margins, letterhead, etc.).
 *
 * The user can:
 * - See margins, typography, page breaks, headers, and footers
 * - Download as PDF (via browser print)
 * - Export as DOCX
 * - Print directly
 * - Assign to a matter/property
 *
 * On mobile, the drawer becomes a full-screen overlay.
 */
import React, { useMemo, useRef, useState } from 'react';
import { exportHtmlToDocxBlob } from '../../../utils/docxExport';
import { PAGE_CSS_PRINT } from '../../../utils/pageFormat';
import { useUI } from '../../../contexts/UIContext';

interface PrintPreviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  html: string;
  title: string;
  letterheadHtml?: string;
  authorName?: string;
  firmName?: string;
  onPrint?: () => void;
}

const PrintPreviewDrawer: React.FC<PrintPreviewDrawerProps> = ({
  isOpen,
  onClose,
  html,
  title,
  letterheadHtml,
  authorName,
  firmName,
  onPrint,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { addToast } = useUI();
  const [isExporting, setIsExporting] = useState(false);

  // Build the print-ready HTML document.
  // V4 (V-DOC-11): the base page contract (A4, 25mm, Times 12pt/1.5) comes
  // from utils/pageFormat.ts — the SAME contract as the print pipeline and
  // the DOCX export, so the preview IS the print. The pre-V4 drawer carried
  // its own third copy of the rules.
  const previewHtml = useMemo(() => {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
${PAGE_CSS_PRINT}
  /* Drawer-specific on-screen sheet chrome (print media resets it) */
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 25mm;
    margin: 0 auto;
    background: white;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    box-sizing: border-box;
  }
  @media print {
    .page { box-shadow: none; margin: 0; width: auto; padding: 0; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <div class="page">
    ${letterheadHtml || ''}
    ${html}
  </div>
</body>
</html>`;
  }, [html, title, letterheadHtml]);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    }
  };

  const handleDocxExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      // V4 (V-DOC-11): the pre-V4 path called exportHtmlToDocx, which wrote
      // RAW XML with a .docx extension — a file Word could not open. The
      // real pipeline (OOXML ZIP, A4, proper runs/lists) is used instead,
      // and success is only reported after the download is dispatched.
      const blob = await exportHtmlToDocxBlob(html, {
        title,
        author: authorName || 'PracticePro',
        firmName: firmName || '',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(title || 'document').replace(/[^a-zA-Z0-9-_]/g, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast('DOCX exported — check your downloads.', { type: 'success' });
    } catch (e: any) {
      console.error('[PrintPreviewDrawer] DOCX export failed:', e);
      addToast(`DOCX export failed: ${e?.message || 'please try again.'}`, { type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9000] transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[600px] md:w-[700px] bg-slate-50 dark:bg-zinc-900 z-[9001] flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Print Preview</h3>
              <p className="text-2xs text-slate-400 dark:text-zinc-500 truncate max-w-[200px]">{title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700 flex-shrink-0">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-xs font-semibold rounded-lg hover:bg-primary-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / PDF
          </button>
          <button
            onClick={handleDocxExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            DOCX
          </button>
          <div className="flex-1" />
          <span className="text-2xs text-slate-400 dark:text-zinc-500">A4 · 12pt Times New Roman · 1" margins</span>
        </div>

        {/* Preview iframe */}
        <div className="flex-1 overflow-auto bg-slate-200 dark:bg-zinc-800 p-4">
          <iframe
            ref={iframeRef}
            srcDoc={previewHtml}
            className="w-full h-full bg-white rounded-lg shadow-xl border-0"
            title="Document Preview"
            style={{ minHeight: '600px' }}
          />
        </div>
      </div>
    </>
  );
};

export default PrintPreviewDrawer;
