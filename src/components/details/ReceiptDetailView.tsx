import React, { useState } from 'react';
import { Invoice, FirmDetails, Contact } from '../../types';
import { PrinterIcon, ZoomInIcon, ZoomOutIcon } from '../../constants';
import { generateReceiptPdf } from '../../services/reportGenerator';
import { formatNaira } from '../../utils/formatting';
import NairaSymbol from '../NairaSymbol';
import Tooltip from '../Tooltip';
import { Breadcrumbs } from '../Breadcrumbs';
import { useUI } from '../../contexts/UIContext';
import { useFinanceState } from '../../contexts/FinanceContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useMatterState } from '../../contexts/MatterContext';
import ErrorBoundary from '../ErrorBoundary';

const ReceiptDetailViewContent: React.FC = () => {
  const { financeState } = useFinanceState();
  const { coreState } = useCoreState();
  const { matterState } = useMatterState();
  const { navigateTo, selectedId: invoiceId } = useUI();

  const invoice = financeState.invoices.find((i: any) => i.id === invoiceId);
  const firmDetails = coreState.firmDetails;
  const client = invoice ? (matterState.contacts.find((c: any) => c.id === invoice.client?.id) || invoice.client) : null;

  if (!invoice) return (
    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
      <p className="text-lg font-medium">Receipt not found</p>
    </div>
  );

  const onGoBack = () => navigateTo('invoiceDetail', invoice.id);
  const totalAmount = invoice.lineItems.reduce((sum: number, item: any) => sum + item.total, 0);


  const headerTextColor = firmDetails.headerTextColor || '#111827';

  const [zoom, setZoom] = useState(0.85);
  const handleZoomIn = () => setZoom(z => Math.min(z + 0.05, 1.5));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.05, 0.5));

  const handleDownloadPdf = () => {
    if (client) {
      generateReceiptPdf(invoice, firmDetails, client as any);
    } else {
      alert("Client details could not be found to generate the PDF.");
    }
  };

  const dateOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  const formattedPaidDate = invoice.paidDate ? new Date(invoice.paidDate).toLocaleDateString('en-GB', dateOptions) : 'N/A';
  const formattedIssueDate = new Date(invoice.issueDate).toLocaleDateString('en-GB', dateOptions);

  return (
    <div className="h-full flex flex-col bg-slate-100 dark:bg-zinc-900 relative overflow-hidden">
      {/* Top Bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700 z-20">
        <Breadcrumbs items={[
          { label: 'Billing', onClick: () => navigateTo('billing') },
          { label: invoice.invoiceNumber, onClick: onGoBack },
          { label: 'Receipt' }
        ]} />
        <div className="flex items-center gap-2">
          <Tooltip text="Zoom Out"><button onClick={handleZoomOut} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500"><ZoomOutIcon className="w-5 h-5" /></button></Tooltip>
          <span className="text-xs font-mono text-slate-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Tooltip text="Zoom In"><button onClick={handleZoomIn} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500"><ZoomInIcon className="w-5 h-5" /></button></Tooltip>
          <div className="h-6 w-px bg-slate-200 dark:border-zinc-700 mx-2"></div>
          <button onClick={handleDownloadPdf} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-600 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-600 rounded-lg font-medium text-sm transition-colors shadow-sm">
            <PrinterIcon className="w-4 h-4" />
            PDF
          </button>
          <div className="h-6 w-px bg-slate-200 dark:border-zinc-700 mx-2"></div>
          <button onClick={onGoBack} className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors">
            Back to Invoice
          </button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-grow overflow-auto bg-slate-200/50 dark:bg-zinc-900 flex justify-center p-8">
        <div
          className="bg-white text-black shadow-2xl transition-transform duration-200 origin-top relative"
          style={{
            width: '210mm',
            minHeight: '297mm',
            transform: `scale(${zoom})`,
          }}
        >
          {/* Letterhead Background Image (Absolute Positioned) */}
          {firmDetails.letterheadUrl && (
            <img
              src={firmDetails.letterheadUrl}
              alt="Letterhead"
              className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
            />
          )}

          <div className="relative z-10 p-[15mm] h-full flex flex-col">
            {/* Header Section */}
            <header className="mb-8">
              <div className="flex justify-between items-start">
                <div>
                  {firmDetails.logoUrl && !firmDetails.letterheadUrl && (
                    <img src={firmDetails.logoUrl} alt="Firm Logo" className="h-24 w-auto object-contain" />
                  )}
                </div>
                <div className="text-right ml-auto" style={{ color: headerTextColor }}>
                  <h2 className="text-3xl font-bold mb-1" style={{ color: 'inherit' }}>{firmDetails.name}</h2>
                  <p className="text-xs whitespace-pre-line" style={{ color: 'inherit', opacity: 0.9 }}>{firmDetails.address}</p>
                </div>
              </div>
              <div className="py-6 border-b border-gray-200"></div>
            </header>

            <div className="flex justify-between mb-12">
              <div className="max-w-[50%]">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Received From</p>
                <p className="font-bold text-gray-900 text-lg truncate">{client?.name}</p>
                {(client as any)?.address && <p className="text-sm text-gray-600 whitespace-pre-line mt-1">{(client as any).address}</p>}
              </div>
              <div className="text-right">
                <h1 className="text-4xl font-bold text-gray-900 mb-2">RECEIPT</h1>
                <p className="text-sm text-gray-500">For Invoice: <span className="font-semibold text-gray-900">{invoice.invoiceNumber}</span></p>
              </div>
            </div>

            <div className="mb-8">
              <table className="min-w-full text-sm">
                <tbody>
                  <tr className="border-y border-gray-100">
                    <td className="py-4 font-semibold text-gray-500 w-1/3">Payment Date</td>
                    <td className="py-4 text-left font-medium text-gray-900">{formattedPaidDate}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-4 font-semibold text-gray-500">Original Invoice Date</td>
                    <td className="py-4 text-left font-medium text-gray-900">{formattedIssueDate}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-4 font-semibold text-gray-500">For Matter</td>
                    <td className="py-4 text-left font-medium text-gray-900">{invoice.matter.title}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 p-8 rounded-lg text-center border border-slate-100 my-8">
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Total Amount Paid</p>
              <p className="text-4xl font-bold text-slate-900"><NairaSymbol />{formatNaira(totalAmount)}</p>
            </div>

            <div className="mt-auto pt-12">
              <div className="text-center">
                <hr className="border-gray-100 mb-8 w-1/2 mx-auto" />
                <p className="text-sm text-gray-400 italic">
                  Thank you for your payment. This receipt confirms that the balance for invoice {invoice.invoiceNumber} has been paid in full.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ReceiptDetailView: React.FC = () => (
    <ErrorBoundary>
        <ReceiptDetailViewContent />
    </ErrorBoundary>
);
