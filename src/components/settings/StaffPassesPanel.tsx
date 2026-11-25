/**
 * StaffPassesPanel — TASK 94 (2026-11-25), the QUIET in-house flow
 * ═══════════════════════════════════════════════════════════════════════
 *
 * The Sentry Pass request-a-pass capability repurposed per the owner's
 * spec: scoped to ESTATE ADMINISTRATION for in-house workers/service
 * staff — never a visitor-facing gate workflow. Two halves:
 *
 *   1. ISSUE — the admin issues a worker a 6-digit pass (same billing
 *      gate, uniqueness + passRef rules as resident passes). No WhatsApp:
 *      the worker is told their code offline. The gate shows a STAFF
 *      badge when they present it.
 *   2. ATTENDANCE — the movement log: every staff pass in a date range
 *      with arrival (check-in) / departure (check-out) stamps from the
 *      gate and per-worker-per-day rollup, so estate management sees when
 *      staff arrived and exited.
 *
 * Mounted on the Security & Access page (Atrium). All calls are
 * requireFirmUser-authenticated; every report pull is audit-logged
 * server-side.
 */
import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Button, Input, Select, Textarea } from '../ui';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { ClockIcon, UserIcon, CheckIcon } from '../../constants';

const today = () => new Date().toISOString().split('T')[0];
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const fmtT = (ms?: number | null) =>
    ms ? new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDT = (ms?: number | null) =>
    ms ? new Date(ms).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : '—';

const STAFF_ROLE_OPTIONS = [
    'Cleaner', 'Security', 'Technician', 'Gardener', 'Driver', 'Contractor', 'Other',
];

export const StaffPassesPanel: React.FC = () => {
    const { currentUser, bearerToken } = useAuth();
    const { addToast } = useUI();
    const firmId = currentUser?.firmId || '';
    const sessionToken = bearerToken ?? undefined;
    const userEmail = currentUser?.email;

    // ── Issue form
    const [staffName, setStaffName] = useState('');
    const [staffRole, setStaffRole] = useState('Cleaner');
    const [propertyId, setPropertyId] = useState('');
    const [visitDate, setVisitDate] = useState(today());
    const [windowHours, setWindowHours] = useState(12);
    const [accessNote, setAccessNote] = useState('');
    const [issuing, setIssuing] = useState(false);
    const [issued, setIssued] = useState<{ staffName: string; tokenCode: string; passRef?: string; expiresAt: number } | null>(null);

    // ── Attendance report
    const [from, setFrom] = useState(daysAgo(7));
    const [to, setTo] = useState(today());
    const [attendance, setAttendance] = useState<any>(null);
    const [pulling, setPulling] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);

    const properties = useQuery(
        api.visitorManagement.getGatekeeperProperties,
        firmId ? { firmId } : 'skip'
    );

    const issuePass = useMutation(api.visitorManagement.issueStaffPass);
    const getAttendance = useMutation(api.visitorManagement.getStaffAttendance);

    const handleIssue = async () => {
        const name = staffName.trim();
        if (!name || !propertyId) {
            addToast('Pick the estate and enter the worker\u2019s name.', { type: 'error' });
            return;
        }
        setIssuing(true);
        try {
            const out: any = await issuePass({
                firmId,
                propertyId,
                staffName: name,
                staffRole: staffRole || undefined,
                visitDate,
                expiryWindowHours: windowHours,
                accessNote: accessNote.trim() || undefined,
                userEmail,
                sessionToken,
            });
            setIssued({ staffName: name, tokenCode: out.tokenCode, passRef: out.passRef, expiresAt: out.expiresAt });
            setStaffName('');
            setAccessNote('');
            addToast(`Staff pass ${out.tokenCode} issued for ${name}.`, { type: 'success' });
        } catch (err: any) {
            addToast(err.message || 'Could not issue the staff pass.', { type: 'error' });
        } finally {
            setIssuing(false);
        }
    };

    const handlePull = async () => {
        setPulling(true);
        setReportError(null);
        try {
            const out = await getAttendance({ firmId, from, to, userEmail, sessionToken });
            setAttendance(out);
        } catch (err: any) {
            setReportError(err.message || 'Could not pull the attendance log.');
        } finally {
            setPulling(false);
        }
    };

    return (
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-soft border border-slate-200 dark:border-zinc-700 p-5">
            <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 bg-sky-100 dark:bg-sky-900/30 rounded-lg flex items-center justify-center">
                    <ClockIcon className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Staff Passes — quiet time-tracking</h3>
                <span className="ml-auto text-2xs font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">in-house only</span>
            </div>
            <p className="text-2xs text-slate-500 dark:text-zinc-400 mb-4 leading-relaxed">
                Issue in-house workers (cleaners, technicians, security, contractors) a code they present at the gate. The gate stamps their arrival and departure — the attendance log below is the movement record for estate management. Visitor guests get their codes from their resident, not from here.
            </p>

            {/* Issue form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="block text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Worker name</label>
                    <Input value={staffName} onChange={(e: any) => setStaffName(e.target.value)} placeholder="e.g. Mama Ada (cleaner)" />
                </div>
                <div>
                    <label className="block text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Role</label>
                    <Select value={staffRole} onChange={(e: any) => setStaffRole(e.target.value)}>
                        {STAFF_ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </Select>
                </div>
                <div>
                    <label className="block text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Estate</label>
                    <Select value={propertyId} onChange={(e: any) => setPropertyId(e.target.value)}>
                        <option value="">Choose the estate…</option>
                        {(properties ?? []).map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Date</label>
                        <Input type="date" value={visitDate} onChange={(e: any) => setVisitDate(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Valid for</label>
                        <Select value={String(windowHours)} onChange={(e: any) => setWindowHours(parseInt(e.target.value))}>
                            <option value="2">2 h</option>
                            <option value="6">6 h</option>
                            <option value="12">12 h</option>
                            <option value="24">24 h</option>
                        </Select>
                    </div>
                </div>
                <div className="sm:col-span-2">
                    <label className="block text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Gate instructions (optional)</label>
                    <Textarea value={accessNote} onChange={(e: any) => setAccessNote(e.target.value)} rows={2} maxLength={120} placeholder="e.g. Pool maintenance — allow access to plant room" />
                </div>
            </div>
            <Button
                variant="primary"
                size="md"
                className="w-full mt-3"
                disabled={issuing || !staffName.trim() || !propertyId}
                onClick={handleIssue}
            >
                {issuing ? 'Issuing…' : 'Issue staff pass'}
            </Button>

            {/* Issued reveal */}
            {issued && (
                <div className="mt-3 p-3 rounded-lg bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-700 text-center">
                    <p className="text-2xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 mb-1">
                        {issued.staffName} — tell the worker this code
                    </p>
                    <p className="text-3xl font-black tracking-[0.3em] text-sky-700 dark:text-sky-400 select-all">{issued.tokenCode}</p>
                    {issued.passRef && (
                        <p className="text-2xs font-mono text-slate-500 dark:text-zinc-400 mt-1 select-all">Pass ID: {issued.passRef}</p>
                    )}
                    <p className="text-3xs text-slate-500 dark:text-zinc-400 mt-1">
                        Valid until {fmtDT(issued.expiresAt)} · the gate logs their arrival/departure automatically.
                    </p>
                    <Button size="sm" variant="ghost" className="mt-2 !text-2xs" onClick={() => setIssued(null)}>Done</Button>
                </div>
            )}

            {/* Attendance log */}
            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-zinc-700">
                <div className="flex items-center justify-between gap-2 mb-2">
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                        <ClockIcon className="w-3.5 h-3.5 text-slate-400" /> Attendance / movement log
                    </h4>
                    <div className="flex items-center gap-2">
                        <Input type="date" value={from} onChange={(e: any) => setFrom(e.target.value)} className="!w-32 !text-2xs !py-1" />
                        <span className="text-2xs text-slate-400">to</span>
                        <Input type="date" value={to} onChange={(e: any) => setTo(e.target.value)} className="!w-32 !text-2xs !py-1" />
                        <Button size="sm" variant="ghost" disabled={pulling} onClick={handlePull}>
                            {pulling ? '…' : 'Pull'}
                        </Button>
                    </div>
                </div>

                {reportError && <p className="text-2xs font-bold text-rose-600 dark:text-rose-400">{reportError}</p>}

                {attendance && (
                    <>
                        <p className="text-2xs text-slate-400 dark:text-zinc-500 mb-2">
                            {attendance.total} staff pass{attendance.total === 1 ? '' : 'es'} in range
                            {attendance.rollup?.length ? ` · ${attendance.rollup.length} worker-day${attendance.rollup.length === 1 ? '' : 's'}` : ''}.
                        </p>

                        {attendance.rollup && attendance.rollup.length > 0 && (
                            <div className="space-y-1.5 mb-3 max-h-40 overflow-y-auto">
                                {attendance.rollup.map((r: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 dark:bg-zinc-900/60">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <UserIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{r.staffName}</span>
                                            <span className="text-2xs text-slate-400">{r.visitDate}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-2xs text-slate-500 dark:text-zinc-400 flex-shrink-0">
                                            {r.firstArrivedAt
                                                ? <span className="text-emerald-600 dark:text-emerald-400 font-bold">in {fmtT(r.firstArrivedAt)}</span>
                                                : <span className="text-amber-500 font-bold">no arrival yet</span>}
                                            {r.lastDepartedAt && <span>· out {fmtT(r.lastDepartedAt)}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {attendance.records && attendance.records.length > 0 && (
                            <div className="space-y-1.5 max-h-64 overflow-y-auto">
                                {attendance.records.map((r: any, i: number) => (
                                    <div key={i} className="py-2 px-3 rounded-lg bg-slate-50 dark:bg-zinc-900/60 flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-bold text-slate-900 dark:text-white">{r.staffName}</span>
                                                {r.staffRole && <span className="text-2xs px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 font-bold">{r.staffRole}</span>}
                                                <span className="text-2xs font-mono text-slate-400">{r.tokenCode}</span>
                                            </div>
                                            <div className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                                {r.propertyName} · {r.visitDate} · issued by {r.issuedByName}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-2xs flex-shrink-0">
                                            {r.arrivedAt
                                                ? <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1"><CheckIcon className="w-3 h-3" /> {fmtT(r.arrivedAt)}</span>
                                                : <span className="text-amber-500 font-bold">arrives —</span>}
                                            {r.departedAt
                                                ? <span className="text-slate-500 dark:text-zinc-400 font-bold">→ {fmtT(r.departedAt)}</span>
                                                : <span className="text-slate-400">→ —</span>}
                                            {r.durationMinutes != null && <span className="text-slate-400">({r.durationMinutes}m)</span>}
                                            {r.revoked && <span className="text-rose-500 font-bold">revoked</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default StaffPassesPanel;
