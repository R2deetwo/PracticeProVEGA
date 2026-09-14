/**
 * TenantPortal Documents tab — lease agreements and documents shared by the property manager.
 *
 * Extracted from TenantPortal.tsx (P5 monolith split, 2026-09-14).
 * Body is verbatim from the original file — zero behavioral change.
 */
import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '../../../contexts/AuthContext';
import { EyeIcon, OfficeBuildingIcon, CheckIcon, ExclamationTriangleIcon, DocumentIcon } from '../../../constants';
import { Receipt as ReceiptIcon } from 'lucide-react';
import { XCircleIcon, PrinterIcon, FolderOpenIcon, ShieldCheckIcon, formatDate } from './shared';

export const DocumentsTab: React.FC<{ tenantInfo: any; effectiveFirmId?: string; addToast: (msg: React.ReactNode, opts?: any) => void }> = ({ tenantInfo, effectiveFirmId, addToast }) => {
  const { currentUser, bearerToken } = useAuth();
  const firmId = effectiveFirmId || currentUser?.firmId || '';
  const userId = currentUser?.id || '';
  const email = currentUser?.email || '';
  const resolvedTenantId = tenantInfo?.tenantId || userId;

  // Fetch lease details
  const leaseDetails = useQuery(
    api.portals.getTenantLeaseDetails,
    firmId && resolvedTenantId ? { firmId, tenantId: resolvedTenantId, email } : 'skip'
  );

  // Fetch consent records
  const consentRecords = useQuery(
    api.portals.getPortalUserConsentRecords,
    email ? { email } : 'skip'
  );

  // Fetch documents shared with the tenant
  const tenantDocs = useQuery(
    api.portals.getTenantDocuments,
    firmId && resolvedTenantId ? { firmId, tenantId: resolvedTenantId, email } : 'skip'
  );

  // Fetch payment proofs (they are also documents)
  const paymentProofs = useQuery(
    api.portals.getPaymentProofsByTenant,
    resolvedTenantId ? { tenantId: resolvedTenantId } : 'skip'
  );

  // View document content in a new window
  const handleViewDocument = (doc: any) => {
    if (doc.content) {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${doc.title || 'Document'}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1e293b; line-height: 1.7; }
            .header { border-bottom: 2px solid #10b981; padding-bottom: 16px; margin-bottom: 24px; }
            .header h1 { font-size: 20px; font-weight: 800; margin: 0 0 4px; color: #1e293b; }
            .header p { color: #64748b; font-size: 13px; margin: 0; }
            .content { white-space: pre-wrap; font-size: 14px; }
            .footer { text-align: center; color: #94a3b8; font-size: 11px; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            @media print { body { padding: 0; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${doc.title || 'Untitled Document'}</h1>
            <p>Property: ${tenantInfo?.primaryPropertyName || 'N/A'} ${tenantInfo?.primaryUnitName ? '· Unit: ' + tenantInfo.primaryUnitName : ''}</p>
          </div>
          <div class="content">${doc.content}</div>
          <div class="footer">
            <p>PracticePro Atrium · Document generated ${new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div class="no-print" style="position:fixed;bottom:20px;right:20px;display:flex;gap:8px;">
            <button onclick="window.print()" style="padding:10px 20px;background:#64748b;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;">Print</button>
          </div>
        </body>
        </html>
      `;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
      } else {
        addToast('Please allow popups to view this document.', { type: 'error' });
      }
    } else {
      addToast('This document has no viewable content.', { type: 'info' });
    }
  };

  // Preview lease details (readable view, not print-focused)
  const handleViewLease = (lease: any) => {
    handlePrintLease(lease); // Same content, opens in new window for reading
  };

  // Preview consent record (readable view)
  const handleViewConsent = (consent: any) => {
    handlePrintConsent(consent); // Same content, opens in new window for reading
  };

  // Print lease details
  const handlePrintLease = (lease: any) => {
    const rd = lease.rentalDetails || {};
    const ud = lease.unitDetails || {};
    const td = lease.tenancyDetails || {};
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lease Agreement - ${lease.propertyName || 'Property'}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 0 auto; padding: 40px 20px; color: #1e293b; line-height: 1.7; }
          .header { text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 24px; }
          .header h1 { font-size: 24px; font-weight: 800; margin: 0 0 4px; color: #1e293b; }
          .header .brand { color: #f59e0b; }
          .header p { color: #64748b; font-size: 13px; margin: 0; }
          .section { margin-bottom: 24px; }
          .section h2 { font-size: 16px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; }
          .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
          .detail-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
          .detail-label { color: #64748b; font-size: 13px; }
          .detail-value { font-weight: 600; font-size: 13px; }
          .footer { text-align: center; color: #94a3b8; font-size: 11px; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
          .badge { display: inline-block; background: #ecfdf5; color: #059669; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; }
          @media print { body { padding: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Practice<span class="brand">Pro</span> <span style="color:#8b5cf6;font-size:13px">ATRIUM</span></h1>
          <p>Lease Agreement Summary</p>
        </div>

        <div class="section">
          <h2>Property Information</h2>
          <div class="details-grid">
            <div class="detail-row"><span class="detail-label">Property</span><span class="detail-value">${lease.propertyName || 'N/A'}</span></div>
            <div class="detail-row"><span class="detail-label">Address</span><span class="detail-value">${lease.propertyAddress || 'N/A'}</span></div>
            ${lease.unitName ? `<div class="detail-row"><span class="detail-label">Unit</span><span class="detail-value">${lease.unitName}</span></div>` : ''}
            <div class="detail-row"><span class="detail-label">Type</span><span class="detail-value">${lease.propertyType || lease.category || 'N/A'}</span></div>
            <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="badge">${lease.status || 'Active'}</span></span></div>
          </div>
        </div>

        <div class="section">
          <h2>Tenancy Details</h2>
          <div class="details-grid">
            <div class="detail-row"><span class="detail-label">Tenant</span><span class="detail-value">${rd.tenantName || ud.tenantName || currentUser?.name || 'N/A'}</span></div>
            ${rd.rentAmount || ud.rentAmount ? `<div class="detail-row"><span class="detail-label">Rent Amount</span><span class="detail-value">₦${(rd.rentAmount || ud.rentAmount || 0).toLocaleString('en-NG')}</span></div>` : ''}
            ${rd.paymentFrequency || td.paymentFrequency ? `<div class="detail-row"><span class="detail-label">Payment Frequency</span><span class="detail-value">${rd.paymentFrequency || td.paymentFrequency || 'Monthly'}</span></div>` : ''}
            ${rd.leaseStart || ud.leaseStart || td.startDate ? `<div class="detail-row"><span class="detail-label">Lease Start</span><span class="detail-value">${rd.leaseStart || ud.leaseStart || td.startDate || 'N/A'}</span></div>` : ''}
            ${rd.leaseEnd || ud.leaseEnd || td.endDate ? `<div class="detail-row"><span class="detail-label">Lease End</span><span class="detail-value">${rd.leaseEnd || ud.leaseEnd || td.endDate || 'N/A'}</span></div>` : ''}
            ${rd.securityDeposit ? `<div class="detail-row"><span class="detail-label">Security Deposit</span><span class="detail-value">₦${rd.securityDeposit.toLocaleString('en-NG')}</span></div>` : ''}
          </div>
        </div>

        ${rd.landlordName ? `
        <div class="section">
          <h2>Landlord Information</h2>
          <div class="details-grid">
            <div class="detail-row"><span class="detail-label">Landlord</span><span class="detail-value">${rd.landlordName}</span></div>
            ${rd.landlordPhone ? `<div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${rd.landlordPhone}</span></div>` : ''}
            ${rd.landlordEmail ? `<div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${rd.landlordEmail}</span></div>` : ''}
          </div>
        </div>
        ` : ''}

        <div class="footer">
          <p>This is a summary of your lease details from PracticePro Atrium.</p>
          <p>PracticePro Systems Ltd · Lagos, Nigeria</p>
          <p>NDPA 2023 Compliant · AES-256 Encrypted</p>
        </div>
        <div class="no-print" style="position:fixed;bottom:20px;right:20px;">
          <button onclick="window.print()" style="padding:10px 20px;background:#10b981;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;">Print Lease</button>
        </div>
      </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    } else {
      addToast('Please allow popups to print your lease.', { type: 'error' });
    }
  };

  // Print consent record
  const handlePrintConsent = (consent: any) => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Terms Acceptance Record</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1e293b; line-height: 1.7; }
          .header { text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 24px; }
          .header h1 { font-size: 24px; font-weight: 800; margin: 0 0 4px; color: #1e293b; }
          .header .brand { color: #f59e0b; }
          .header p { color: #64748b; font-size: 13px; margin: 0; }
          .details { background: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; }
          .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
          .row:last-child { border-bottom: none; }
          .label { color: #64748b; font-size: 13px; }
          .value { font-weight: 600; font-size: 13px; }
          .badge { display: inline-block; background: #ecfdf5; color: #059669; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; }
          .footer { text-align: center; color: #94a3b8; font-size: 11px; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
          @media print { body { padding: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Practice<span class="brand">Pro</span> <span style="color:#8b5cf6;font-size:13px">ATRIUM</span></h1>
          <p>Terms & Conditions Acceptance Record</p>
        </div>
        <div class="details">
          <div class="row"><span class="label">User</span><span class="value">${consent.inviteeName || currentUser?.name || 'N/A'}</span></div>
          <div class="row"><span class="label">Email</span><span class="value">${consent.inviteeEmail || email}</span></div>
          <div class="row"><span class="label">Portal Type</span><span class="value">${consent.portalType === 'resident' ? "Residents' Portal" : 'Client Portal'}</span></div>
          <div class="row"><span class="label">Terms Accepted</span><span class="value">${consent.termsAcceptedAt ? new Date(consent.termsAcceptedAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span></div>
          <div class="row"><span class="label">Account Activated</span><span class="value">${consent.acceptedAt ? new Date(consent.acceptedAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span></div>
          <div class="row"><span class="label">Status</span><span class="value"><span class="badge">ACCEPTED</span></span></div>
        </div>
        <div class="footer">
          <p>This record confirms your acceptance of the PracticePro portal terms and conditions.</p>
          <p>PracticePro Systems Ltd · Lagos, Nigeria</p>
          <p>NDPA 2023 Compliant · ISO 27001 Aligned · AES-256 Encrypted</p>
        </div>
        <div class="no-print" style="position:fixed;bottom:20px;right:20px;">
          <button onclick="window.print()" style="padding:10px 20px;background:#10b981;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;">Print Record</button>
        </div>
      </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    } else {
      addToast('Please allow popups to print this record.', { type: 'error' });
    }
  };

  const isLoading = leaseDetails === undefined || consentRecords === undefined || tenantDocs === undefined;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-6 animate-pulse">
          <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-48 mb-4" />
          <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-full mb-2" />
          <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-3/4 mb-2" />
          <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-1/2" />
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-6 animate-pulse">
          <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-48 mb-4" />
          <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-full mb-2" />
          <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-3/4" />
        </div>
      </div>
    );
  }

  const hasLease = leaseDetails && leaseDetails.length > 0;
  const hasConsents = consentRecords && consentRecords.length > 0;
  const hasDocs = tenantDocs && tenantDocs.length > 0;
  const hasProofs = paymentProofs && paymentProofs.length > 0;
  const hasAnyContent = hasLease || hasConsents || hasDocs || hasProofs;

  return (
    <div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">My Documents</h3>
      <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
        View and print your lease agreement, accepted terms, consent records, and shared documents.
      </p>

      {!hasAnyContent && (
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-lg bg-slate-100 dark:bg-zinc-700 flex items-center justify-center mb-3">
            <FolderOpenIcon className="w-6 h-6 text-slate-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">No documents available yet</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Your lease agreement, consent records, and shared documents will appear here.
          </p>
        </div>
      )}

      {/* ─── Lease Agreement Section ───────────────────────────────────────
          MANAGEMENT-ONLY SUPPRESSION: When the property is marked
          'Management Only (No Rent)', the Lease Agreement link is hidden.
          This prevents residents from viewing lease terms for properties
          where rent is not collected through the portal. */}
      {hasLease && tenantInfo?.primaryRentCollectionMode !== 'Management Only (No Rent)' && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <OfficeBuildingIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Lease Agreement</h4>
          </div>
          <div className="space-y-3">
            {leaseDetails.map((lease: any, idx: number) => {
              const rd = lease.rentalDetails || {};
              const ud = lease.unitDetails || {};
              return (
                <div
                  key={lease.propertyId || idx}
                  className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
                        <OfficeBuildingIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-800 dark:text-zinc-200">
                          {lease.propertyName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          {lease.unitName ? `Unit: ${lease.unitName} · ` : ''}
                          {lease.propertyAddress || 'No address'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {lease.propertyType && (
                            <span className="text-2xs font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                              {lease.propertyType}
                            </span>
                          )}
                          {(rd.rentAmount || ud.rentAmount) && (
                            <span className="text-2xs font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                              ₦{(rd.rentAmount || ud.rentAmount || 0).toLocaleString()}/mo
                            </span>
                          )}
                          {(rd.leaseStart || ud.leaseStart) && (
                            <span className="text-2xs font-bold bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 px-2 py-0.5 rounded-full">
                              From {rd.leaseStart || ud.leaseStart}
                              {(rd.leaseEnd || ud.leaseEnd) ? ` to ${rd.leaseEnd || ud.leaseEnd}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleViewLease(lease)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                      >
                        <EyeIcon className="w-3.5 h-3.5" /> Preview
                      </button>
                      <button
                        onClick={() => handlePrintLease(lease)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-lg text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-600 transition-colors"
                      >
                        <PrinterIcon className="w-3.5 h-3.5" /> Print
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Terms & Consents Section ───────────────────────────────────── */}
      {hasConsents && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheckIcon className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Terms & Consents</h4>
          </div>
          <div className="space-y-3">
            {consentRecords.map((consent: any) => (
              <div
                key={String(consent._id)}
                className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center flex-shrink-0">
                      <ShieldCheckIcon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-800 dark:text-zinc-200">
                        {consent.portalType === 'resident' ? "Residents' Portal Terms & Conditions" : 'Client Portal Terms & Conditions'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Accepted on {consent.termsAcceptedAt
                          ? new Date(consent.termsAcceptedAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : 'N/A'}
                      </p>
                      <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                        <CheckIcon className="w-3 h-3" /> Accepted
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleViewConsent(consent)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 rounded-lg text-xs font-bold hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
                    >
                      <EyeIcon className="w-3.5 h-3.5" /> Preview
                    </button>
                    <button
                      onClick={() => handlePrintConsent(consent)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-lg text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-600 transition-colors"
                    >
                      <PrinterIcon className="w-3.5 h-3.5" /> Print
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Shared Documents Section ───────────────────────────────────── */}
      {hasDocs && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <DocumentIcon className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Shared Documents</h4>
          </div>
          <div className="space-y-3">
            {tenantDocs.map((doc: any) => (
              <div
                key={String(doc._id)}
                className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center flex-shrink-0">
                      <DocumentIcon className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-800 dark:text-zinc-200 truncate">
                        {doc.title || 'Untitled Document'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        {doc.dateFiled && `${doc.dateFiled} · `}
                        {doc.source && <span className="capitalize">{doc.source}</span>}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {doc.isSharedWithClient && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                            <CheckIcon className="w-3 h-3" /> Shared
                          </span>
                        )}
                        {doc.isSignatureRequested && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                            <ExclamationTriangleIcon className="w-3 h-3" /> Signature Requested
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleViewDocument(doc)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 rounded-lg text-xs font-bold hover:bg-sky-100 dark:hover:bg-sky-900/30 transition-colors"
                    >
                      <EyeIcon className="w-3.5 h-3.5" /> View
                    </button>
                    <button
                      onClick={() => handleViewDocument(doc)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-lg text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-600 transition-colors"
                    >
                      <PrinterIcon className="w-3.5 h-3.5" /> Print
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Payment Proof Records Section ──────────────────────────────── */}
      {hasProofs && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <ReceiptIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Payment Proofs</h4>
          </div>
          <div className="space-y-2">
            {paymentProofs.map((proof: any) => (
              <div
                key={proof._id}
                className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    proof.status === 'approved'
                      ? 'bg-emerald-50 dark:bg-emerald-900/20'
                      : proof.status === 'rejected'
                      ? 'bg-rose-50 dark:bg-rose-900/20'
                      : 'bg-amber-50 dark:bg-amber-900/20'
                  }`}>
                    <ReceiptIcon className={`w-4 h-4 ${
                      proof.status === 'approved'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : proof.status === 'rejected'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-800 dark:text-zinc-200 truncate">
                      {proof.description || 'Payment proof'}
                      {proof.amount && <span className="ml-2 text-emerald-600 dark:text-emerald-400">₦{proof.amount.toLocaleString()}</span>}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {proof.period && `${proof.period} · `}
                      {formatDate(proof.createdAt)}
                      {proof.storageIds?.length > 0 && <span className="ml-1">· {proof.storageIds.length} file(s)</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {proof.status === 'approved' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                      <CheckIcon className="w-3 h-3" /> Approved
                    </span>
                  )}
                  {proof.status === 'rejected' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400">
                      <XCircleIcon className="w-3 h-3" /> Rejected
                    </span>
                  )}
                  {proof.status === 'pending_review' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                      <ExclamationTriangleIcon className="w-3 h-3" /> Pending
                    </span>
                  )}
                  <button
                    onClick={() => {
                      const html = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                          <title>Payment Proof - ${proof.description || 'Receipt'}</title>
                          <style>
                            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1e293b; line-height: 1.7; }
                            .header { text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 20px; }
                            .header h1 { font-size: 24px; font-weight: 800; margin: 0 0 4px; color: #1e293b; }
                            .header .brand { color: #f59e0b; }
                            .header p { color: #64748b; font-size: 13px; margin: 0; }
                            .details { background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0; }
                            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
                            .row:last-child { border-bottom: none; }
                            .label { color: #64748b; font-size: 13px; }
                            .value { font-weight: 600; font-size: 13px; }
                            .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; }
                            .footer { text-align: center; color: #94a3b8; font-size: 11px; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
                            @media print { body { padding: 0; } .no-print { display: none; } }
                          </style>
                        </head>
                        <body>
                          <div class="header">
                            <h1>Practice<span class="brand">Pro</span> <span style="color:#8b5cf6;font-size:13px">ATRIUM</span></h1>
                            <p>Payment Proof Record</p>
                          </div>
                          <div class="details">
                            <div class="row"><span class="label">Description</span><span class="value">${proof.description || 'Payment proof'}</span></div>
                            ${proof.amount ? `<div class="row"><span class="label">Amount</span><span class="value">₦${proof.amount.toLocaleString('en-NG')}</span></div>` : ''}
                            ${proof.period ? `<div class="row"><span class="label">Period</span><span class="value">${proof.period}</span></div>` : ''}
                            <div class="row"><span class="label">Date Submitted</span><span class="value">${formatDate(proof.createdAt)}</span></div>
                            <div class="row"><span class="label">Status</span><span class="value"><span class="badge" style="background:${proof.status === 'approved' ? '#ecfdf5;color:#059669' : proof.status === 'rejected' ? '#fff1f2;color:#e11d48' : '#fffbeb;color:#d97706'}">${proof.status === 'approved' ? 'APPROVED' : proof.status === 'rejected' ? 'REJECTED' : 'PENDING REVIEW'}</span></span></div>
                            ${proof.adminNote ? `<div class="row"><span class="label">Admin Note</span><span class="value">${proof.adminNote}</span></div>` : ''}
                            <div class="row"><span class="label">Files Attached</span><span class="value">${proof.storageIds?.length || 0}</span></div>
                          </div>
                          <div class="footer">
                            <p>PracticePro Systems Ltd · Lagos, Nigeria</p>
                            <p>NDPA 2023 Compliant · AES-256 Encrypted</p>
                          </div>
                          <div class="no-print" style="position:fixed;bottom:20px;right:20px;">
                            <button onclick="window.print()" style="padding:10px 20px;background:#10b981;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;">Print</button>
                          </div>
                        </body>
                        </html>
                      `;
                      const printWindow = window.open('', '_blank');
                      if (printWindow) {
                        printWindow.document.write(html);
                        printWindow.document.close();
                      } else {
                        addToast('Please allow popups to print this record.', { type: 'error' });
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                  >
                    <PrinterIcon className="w-3.5 h-3.5" /> Print
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
