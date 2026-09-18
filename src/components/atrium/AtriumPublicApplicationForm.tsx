import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Building2 as BuildingOfficeIcon, User as UserIcon, DollarSign as CurrencyDollarIcon, FileText as DocumentTextIcon, CheckCircle as CheckCircleIcon, Receipt as ReceiptIcon } from 'lucide-react';
import { buildMoveInBreakdown, MoveInBreakdownRow, rentCycleLabel } from '../../utils/propertyPayload';

/**
 * Public facing component for prospective tenants to apply for vacant units.
 * Wired to the addLeadToPipeline mutation in convex/sentry.ts.
 *
 * When a lead is submitted:
 *   1. A new row is inserted into the `leads_pipeline` table with stage "Inquiry"
 *   2. The property manager sees the lead in the VacancyPipeline Kanban board
 *   3. They can advance the lead through: Inquiry → Vetted → Lease_Generated → Closed
 */
export const AtriumPublicApplicationForm: React.FC<{ propertyId: string; propertyName: string }> = ({ propertyId, propertyName }) => {
    // SIMPLIFY FIX: shared links may carry ?unit=<name> from the property
    // unit card's Share button — show it and attach it to the lead notes so
    // the manager knows which unit the applicant means.
    const [unitHint] = useState(() => {
        try { return new URLSearchParams(window.location.search).get('unit') || ''; } catch { return ''; }
    });
    const [applicantName, setApplicantName] = useState('');
    const [contactInfo, setContactInfo] = useState('');
    const [proposedRent, setProposedRent] = useState('');
    const [notes, setNotes] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // SECURITY: submitPublicLead derives the firmId SERVER-SIDE from the
    // property record (the client never supplies it) and rate-limits spam.
    // The old path (addLeadToPipeline) now requires an authenticated firm user.
    const addLead = useMutation(api.sentry.submitPublicLead);

    // Fetch the property to get its firmId (required for the lead pipeline)
    const property = useQuery(api.myFunctions.getPropertyById, { propertyId });

    // ── Move-in cost disclosure (Task 59 follow-up: application-side
    // enforcement) ────────────────────────────────────────────────────
    // The Lease & Rent Configuration sets what a new resident pays — rent
    // per cycle, service charge per cycle (+ months payable in advance),
    // one-time legal/agency fees and the refundable caution deposit. The
    // applicant sees exactly the same itemised categories the manager
    // configured — before they apply, not at offer stage. No lump-sum
    // total: recurring, one-time and refundable money is never added
    // together (Task 59 policy).
    const disclosure = useMemo(() => {
        const p = property as any;
        if (!p) return null;
        const units: any[] = Array.isArray(p.units) ? p.units : [];
        // Which unit is this application about? The share link carries
        // ?unit=<name> from the unit card's Share button; a single-unit
        // property is unambiguous; otherwise prefer VACANT units for the
        // range summary (occupied units' figures are not the applicant's).
        let target: any = null;
        if (unitHint) {
            const hint = unitHint.trim().toLowerCase();
            target = units.find(u => String(u.unitName || u.id || '').toLowerCase() === hint) || null;
        } else if (units.length === 1) {
            target = units[0];
        }
        const opts = {
            scActive: p.coreServices?.serviceCharge !== false,
            rentCollecting: p.rentCollectionMode !== 'Management Only (No Rent)',
        };
        if (target) {
            const { rows, hasAny } = buildMoveInBreakdown(target, opts);
            return { kind: 'itemised' as const, rows, hasAny, unitName: String(target.unitName || '') };
        }
        // Multi-unit, no hint — honest range across vacant units only.
        const vacant = units.filter(u => !u.tenantName || String(u.status || '').toLowerCase() === 'vacant');
        const rents = (vacant.length > 0 ? vacant : units)
            .map(u => Number(u.rentAmount) || 0)
            .filter(n => n > 0);
        if (rents.length === 0) return { kind: 'none' as const };
        const min = Math.min(...rents);
        const max = Math.max(...rents);
        const freq = rentCycleLabel((vacant.length > 0 ? vacant : units).find(u => (Number(u.rentAmount) || 0) === min)?.rentFrequency);
        return { kind: 'range' as const, min, max, single: min === max, freq };
    }, [property, unitHint]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!applicantName.trim() || !contactInfo.trim()) {
            setError('Please enter your name and contact information.');
            return;
        }

        setIsSubmitting(true);
        try {
            // firmId is derived server-side by submitPublicLead — no client
            // trust needed. We still show a friendly error if the property
            // hasn't loaded yet (offline / bad id).
            if (!(property as any)?.firmId) {
                setError('Unable to determine the property manager. Please try again later.');
                setIsSubmitting(false);
                return;
            }

            await addLead({
                propertyId,
                applicantName: applicantName.trim(),
                contactInfo: contactInfo.trim(),
                proposedRent: proposedRent ? parseFloat(proposedRent) : undefined,
                notes: [notes.trim(), unitHint ? `Applying for unit: ${unitHint}` : ''].filter(Boolean).join('\n') || undefined,
            });
            setSubmitted(true);
        } catch (err: any) {
            setError(err?.message || 'Failed to submit application. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="max-w-md mx-auto mt-10 p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 text-center">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircleIcon className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Application Received</h2>
                <p className="text-slate-600 dark:text-slate-400">
                    Thank you for your interest in {propertyName}. The property manager has been notified and will contact you shortly.
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-xl mx-auto mt-10 p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 rounded-lg">
                    <BuildingOfficeIcon className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Tenancy Application</h2>
                    <p className="text-sm text-slate-500">Applying for: <span className="font-semibold text-slate-700 dark:text-slate-300">{propertyName}{unitHint ? ` — Unit ${unitHint}` : ''}</span></p>
                </div>
            </div>

            {/* ── Move-in Costs (Task 59 follow-up) ─────────────────────────
                The same itemised categories the property manager configured
                in Lease & Rent Configuration: recurring rent + service charge
                keep their own cycle, months of service charge payable in
                advance are their own line, legal/agency are one-time and the
                caution deposit is refundable. No lump-sum total by design. */}
            {disclosure?.kind === 'itemised' && disclosure.hasAny && (
                <div className="mb-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
                    <p className="flex items-center gap-1.5 text-2xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest leading-none mb-1">
                        <ReceiptIcon className="w-3.5 h-3.5" />
                        Move-in Costs{disclosure.unitName ? ` — Unit ${disclosure.unitName}` : ''}
                    </p>
                    <p className="text-3xs text-slate-400 dark:text-slate-500 mb-2.5">What this unit costs when your lease starts, listed by category.</p>
                    <div className="space-y-1.5">
                        {disclosure.rows.map((row: MoveInBreakdownRow) => (
                            <div key={row.key} className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5 min-w-0">
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                        row.key === 'rent' ? 'bg-indigo-500'
                                          : row.key === 'serviceCharge' || row.key === 'scAdvance' ? 'bg-amber-500'
                                          : row.key === 'cautionDeposit' ? 'bg-emerald-500'
                                          : 'bg-sky-500'
                                    }`} />
                                    {row.label}
                                    <span className={`text-3xs font-bold uppercase tracking-wider ${row.kind === 'refundable' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>{row.kind}</span>
                                </span>
                                <span className="font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                    ₦{row.amount.toLocaleString('en-NG')}
                                    {row.period && <span className="text-3xs font-semibold text-slate-400"> {row.period}</span>}
                                </span>
                            </div>
                        ))}
                    </div>
                    <p className="text-3xs text-slate-400 dark:text-slate-500 mt-2.5 leading-relaxed">
                        Figures from the property manager&apos;s current configuration — the manager confirms final amounts with your offer. Items are not added together.
                    </p>
                </div>
            )}
            {disclosure?.kind === 'range' && (
                <div className="mb-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
                    <p className="flex items-center gap-1.5 text-2xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest leading-none mb-1">
                        <ReceiptIcon className="w-3.5 h-3.5" />
                        Rent at this property
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        {disclosure.single
                            ? <>All available units: <span className="font-bold text-slate-800 dark:text-slate-200">₦{disclosure.min.toLocaleString('en-NG')}</span> <span className="text-slate-400">{disclosure.freq}</span></>
                            : <>From <span className="font-bold text-slate-800 dark:text-slate-200">₦{disclosure.min.toLocaleString('en-NG')}</span> to <span className="font-bold text-slate-800 dark:text-slate-200">₦{disclosure.max.toLocaleString('en-NG')}</span> <span className="text-slate-400">{disclosure.freq}</span></>}
                        <span className="block text-3xs text-slate-400 dark:text-slate-500 mt-1">Service charge and move-in fees are confirmed per unit during review.</span>
                    </p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <UserIcon className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            required
                            type="text"
                            value={applicantName}
                            onChange={e => setApplicantName(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="John Doe"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email or Phone</label>
                    <div className="relative">
                        <input
                            required
                            type="text"
                            value={contactInfo}
                            onChange={e => setContactInfo(e.target.value)}
                            className="block w-full pl-3 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="john@example.com or +234..."
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Proposed Annual Rent (₦)</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <CurrencyDollarIcon className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            required
                            type="number"
                            value={proposedRent}
                            onChange={e => setProposedRent(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="e.g. 2500000"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Additional Notes / Employment Info</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 pt-3 pointer-events-none">
                            <DocumentTextIcon className="h-5 w-5 text-slate-400" />
                        </div>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={3}
                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="Briefly describe your employment status and intended use of the property..."
                        />
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">
                        {error}
                    </div>
                )}

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Application'}
                    </button>
                    <p className="mt-3 text-xs text-center text-slate-500">
                        By submitting, your data flows securely into the property manager's CRM for review.
                    </p>
                </div>
            </form>
        </div>
    );
};
