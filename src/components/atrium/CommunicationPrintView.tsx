import React, { useEffect, useRef } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { AuditTrailEntry } from '../../types';
import { X as XIcon, Printer as PrinterIcon } from 'lucide-react';

interface CommunicationPrintViewProps {
  firmId: string;
  unitId?: string;
  tenantContact?: string;
  tenantName?: string;
  unitLabel?: string;
  onClose: () => void;
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  sms: 'SMS',
  portal: 'Portal',
};

const DIRECTION_LABELS: Record<string, string> = {
  outbound: 'Sent',
  inbound: 'Received',
};

const STATUS_COLORS: Record<string, string> = {
  sent: '#16a34a',
  failed: '#dc2626',
  simulated: '#d97706',
};

export const CommunicationPrintView: React.FC<CommunicationPrintViewProps> = ({
  firmId,
  unitId,
  tenantContact,
  tenantName,
  unitLabel,
  onClose,
}) => {
  const { currentUser } = useAuth();
  const { coreState } = useCoreState();
  const printRef = useRef<HTMLDivElement>(null);

  const firmName = coreState.firmDetails?.name || 'Property Management Firm';
  const firmAddress = coreState.firmDetails?.address || '';
  const firmPhone = (coreState.firmDetails as any)?.phone || '';
  const firmEmail = (coreState.firmDetails as any)?.email || '';

  const communications = useQuery(
    api.sentry.getCommunicationsForPrint,
    firmId ? { firmId, unitId, tenantContact } : 'skip'
  );

  // Merge and sort all communications chronologically (oldest first for print)
  const allComms: AuditTrailEntry[] = React.useMemo(() => {
    if (!communications) return [];
    const outbound: AuditTrailEntry[] = (communications.outbound || []).map((l: any) => ({
      _id: l._id,
      direction: l.direction || 'outbound',
      channel: l.channel,
      messageType: l.messageType,
      recipient: l.recipient,
      senderName: l.senderName,
      content: l.content,
      timestamp: l.timestamp,
      status: l.status,
      triggeredBy: l.triggeredBy,
      unitId: l.unitId,
      tenantId: l.tenantId,
    }));
    const inbound: AuditTrailEntry[] = (communications.inbound || []).map((m: any) => ({
      _id: m._id,
      direction: 'inbound',
      channel: m.channel,
      senderName: m.senderName,
      senderContact: m.senderContact,
      content: m.content,
      timestamp: m.timestamp,
      unitId: m.unitId,
      tenantId: m.tenantId,
    }));
    return [...outbound, ...inbound].sort((a, b) => a.timestamp - b.timestamp);
  }, [communications]);

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatMessageType = (type?: string) => {
    if (!type) return '';
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center print:bg-white print:backdrop-blur-none">
      {/* Screen-only header bar */}
      <div className="print:hidden absolute top-0 left-0 right-0 bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PrinterIcon className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold text-white">Print Communications</h2>
          <span className="text-xs text-slate-500">{allComms.length} messages</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2"
          >
            <PrinterIcon className="w-3.5 h-3.5" /> Print
          </button>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Printable content */}
      <div
        ref={printRef}
        className="print-content bg-white text-slate-900 w-full max-w-3xl mx-auto mt-16 mb-4 rounded-xl overflow-y-auto max-h-[calc(100vh-5rem)] print:max-h-none print:rounded-none print:m-0 print:shadow-none shadow-2xl"
      >
        {/* Letterhead */}
        <div className="print-letterhead border-b-2 border-slate-200 px-8 py-6 print:px-12 print:py-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight print:text-2xl">{firmName}</h1>
              {firmAddress && <p className="text-xs text-slate-500 mt-0.5 print:text-sm">{firmAddress}</p>}
              <div className="flex gap-4 mt-1">
                {firmPhone && <p className="text-[10px] text-slate-400 print:text-xs">Tel: {firmPhone}</p>}
                {firmEmail && <p className="text-[10px] text-slate-400 print:text-xs">Email: {firmEmail}</p>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold print:text-xs">Communication Record</p>
              <p className="text-[10px] text-slate-400 print:text-xs">
                Generated: {new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Recipient Info */}
        <div className="px-8 py-4 print:px-12 print:py-6 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-0.5 print:text-[10px]">Tenant / Recipient</p>
              <p className="text-sm font-bold text-slate-800 print:text-base">{tenantName || tenantContact || 'All Tenants'}</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-0.5 print:text-[10px]">Unit / Property</p>
              <p className="text-sm font-bold text-slate-800 print:text-base">{unitLabel || unitId || 'All Units'}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-4 text-xs text-slate-500 print:text-sm">
            <span>Total Communications: <strong className="text-slate-700">{allComms.length}</strong></span>
            <span>Outbound: <strong className="text-slate-700">{allComms.filter(c => c.direction === 'outbound').length}</strong></span>
            <span>Inbound: <strong className="text-slate-700">{allComms.filter(c => c.direction === 'inbound').length}</strong></span>
          </div>
        </div>

        {/* Communications Timeline */}
        <div className="px-8 py-6 print:px-12 print:py-8">
          {allComms.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 text-sm">No communications found for this tenant/unit.</p>
            </div>
          ) : (
            <div className="space-y-0">
              {allComms.map((comm, idx) => (
                <div key={comm._id} className="print-comm-entry relative flex gap-4 pb-6 print:pb-8">
                  {/* Timeline connector */}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 mt-1.5 ${
                      comm.direction === 'outbound'
                        ? 'bg-emerald-500 border-emerald-300'
                        : 'bg-blue-500 border-blue-300'
                    }`} />
                    {idx < allComms.length - 1 && (
                      <div className="w-px flex-1 bg-slate-200 mt-1" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-2">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                        comm.direction === 'outbound'
                          ? 'bg-emerald-100 text-emerald-700 print:bg-emerald-50'
                          : 'bg-blue-100 text-blue-700 print:bg-blue-50'
                      }`}>
                        {DIRECTION_LABELS[comm.direction] || comm.direction}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 print:bg-slate-50">
                        {CHANNEL_LABELS[comm.channel] || comm.channel}
                      </span>
                      {comm.messageType && comm.messageType !== 'custom' && (
                        <span className="text-[10px] text-slate-400">
                          ({formatMessageType(comm.messageType)})
                        </span>
                      )}
                      {comm.status && comm.direction === 'outbound' && (
                        <span
                          className="text-[10px] font-semibold"
                          style={{ color: STATUS_COLORS[comm.status] || '#64748b' }}
                        >
                          [{comm.status}]
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mb-1.5 print:text-xs">
                      {formatDate(comm.timestamp)}
                      {comm.direction === 'outbound' && comm.recipient && (
                        <span> &middot; To: {comm.recipient}</span>
                      )}
                      {comm.direction === 'inbound' && comm.senderName && (
                        <span> &middot; From: {comm.senderName}</span>
                      )}
                      {comm.direction === 'inbound' && comm.senderContact && (
                        <span> ({comm.senderContact})</span>
                      )}
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap print:text-sm print:leading-relaxed">
                      {comm.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 print:px-12 print:py-6 border-t border-slate-200 bg-slate-50">
          <p className="text-[9px] text-slate-400 print:text-[10px]">
            This document is a record of all communications between {firmName} and {tenantName || tenantContact || 'the tenant'}.
            It was auto-generated by PracticePro Atrium OS on {new Date().toLocaleString()}.
          </p>
          <p className="text-[9px] text-slate-300 mt-1 print:text-[10px]">
            Page 1 of 1
          </p>
        </div>
      </div>
    </div>
  );
};
