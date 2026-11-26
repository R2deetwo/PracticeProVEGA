/**
 * GatehouseAccountsPanel — TASK 94 (2026-11-25)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Estate-admin provisioning for Sentry Pass gatehouse stations, mounted on
 * the Security & Access page. The owner's spec:
 *   • Admin Provisioning — an Estate Admin / Property Manager creates a
 *     Gatehouse Account / Guard Station (Main Gate, Gate 1…) with simple
 *     credentials (station + PIN, both revocable and resettable).
 *   • Easy Testing Path — the panel shows the ready-made /gatehouse
 *     terminal URL (copy button) so the owner can provision a station and
 *     walk straight to the gate tablet.
 *
 * PIN RULES: the PIN is shown ONCE at provision/reset time (never stored
* raw — only its salted SHA-256 hash, see convex/gatehouseAccounts.ts).
 *
 * THE LOCK FLIP: while a property has ZERO active stations its terminal
 * stays in the legacy anonymous mode; the first station locks that
 * property's gate endpoints to station sessions. Revoking the last
 * station unlocks the anonymous mode again (documented in the panel).
 */
import React, { useMemo, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Button, Input, Select } from '../ui';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { GateIcon, KeyIcon, ShieldCheckIcon, ClipboardIcon } from '../../constants';
import { useGatehouseProperties } from '../../hooks/useGatehouseProperties';

const fmtDT = (ms?: number | null) =>
    ms ? new Date(ms).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : '—';

export const GatehouseAccountsPanel: React.FC = () => {
    const { currentUser, bearerToken } = useAuth();
    const { addToast } = useUI();
    const firmId = currentUser?.firmId || '';
    const sessionToken = bearerToken ?? undefined;
    const userEmail = currentUser?.email;

    const [stationName, setStationName] = useState('');
    const [propertyId, setPropertyId] = useState('');
    const [pinChoice, setPinChoice] = useState('');      // optional admin-chosen PIN
    const [provisioning, setProvisioning] = useState(false);
    const [revealedPin, setRevealedPin] = useState<{ station: string; pin: string } | null>(null);
    const [resettingId, setResettingId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const accounts = useQuery(
        api.gatehouseAccounts.listGatehouseAccounts,
        // ROUND 20: only subscribe with a verified session. requireFirmUser
        // rejects tokenless callers (demo mode / signed-out views) and a
        // throwing useQuery takes the whole Security & Access page into
        // the error boundary — skip instead, the panel renders empty.
        firmId && sessionToken ? { firmId, userEmail, sessionToken } : 'skip'
    );

    // The firm's properties for the station's estate dropdown — the same
    // id+name picker the gate terminal uses (public, throttled, names only).
    // ROUND 20: mutation directory (write-throttled) — loaded once via the
    // shared hook instead of useQuery.
    const properties = useGatehouseProperties(firmId);

    const provision = useMutation(api.gatehouseAccounts.provisionGatehouseAccount);
    const revoke = useMutation(api.gatehouseAccounts.revokeGatehouseAccount);
    const resetPin = useMutation(api.gatehouseAccounts.resetGatehousePin);

    const terminalUrl = useMemo(() => {
        if (!firmId) return '';
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        return `${origin}/gatehouse?firmId=${firmId}`;
    }, [firmId]);

    const handleProvision = async () => {
        const name = stationName.trim();
        if (!name || !propertyId) {
            addToast('Pick the estate and name the station (e.g. Main Gate).', { type: 'error' });
            return;
        }
        setProvisioning(true);
        try {
            const out: any = await provision({
                firmId,
                propertyId,
                stationName: name,
                pin: pinChoice.trim() || undefined,
                userEmail,
                sessionToken,
            });
            setRevealedPin({ station: out.stationName, pin: out.pin });
            setStationName('');
            setPinChoice('');
            addToast(`Station "${out.stationName}" created — give the guard the PIN below.`, { type: 'success' });
        } catch (err: any) {
            addToast(err.message || 'Could not create the station.', { type: 'error' });
        } finally {
            setProvisioning(false);
        }
    };

    const handleResetPin = async (accountId: string) => {
        setResettingId(accountId);
        try {
            const out: any = await resetPin({ firmId, accountId: accountId as any, userEmail, sessionToken });
            setRevealedPin({ station: out.stationName, pin: out.pin });
        } catch (err: any) {
            addToast(err.message || 'Could not reset the PIN.', { type: 'error' });
        } finally {
            setResettingId(null);
        }
    };

    const handleRevoke = async (accountId: string, station: string) => {
        try {
            await revoke({ firmId, accountId: accountId as any, reason: 'Revoked by estate admin', userEmail, sessionToken });
            addToast(`Station "${station}" revoked — its tablets log out instantly.`, { type: 'success' });
        } catch (err: any) {
            addToast(err.message || 'Could not revoke the station.', { type: 'error' });
        }
    };

    const copyUrl = async () => {
        try {
            await navigator.clipboard.writeText(terminalUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            addToast('Copy failed — select the URL text manually.', { type: 'error' });
        }
    };

    const activeCount = (accounts ?? []).filter((a: any) => a.status === 'active').length;

    return (
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-soft border border-slate-200 dark:border-zinc-700 p-5">
            <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 bg-sky-100 dark:bg-sky-900/30 rounded-lg flex items-center justify-center">
                    <GateIcon className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Gatehouse Stations</h3>
                {activeCount > 0 && (
                    <span className="ml-auto text-2xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        {activeCount} active — gate terminal LOCKED
                    </span>
                )}
                {activeCount === 0 && accounts && accounts.length > 0 && (
                    <span className="ml-auto text-2xs font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
                        all revoked — terminal in open mode
                    </span>
                )}
            </div>
            <p className="text-2xs text-slate-500 dark:text-zinc-400 mb-4 leading-relaxed">
                Each station is one guard post with a PIN. While a station is active, the gate terminal at <code className="px-1 bg-slate-100 dark:bg-zinc-700 rounded">/gatehouse</code> requires the PIN before verifying codes — and can see nothing beyond the verification screen. Zero active stations = the terminal stays in its legacy open mode.
            </p>

            {/* The ready-made terminal URL — the owner's easy test path */}
            {firmId && (
                <div className="mb-4 p-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 flex items-center gap-2">
                    <KeyIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <code className="text-2xs text-slate-600 dark:text-zinc-300 truncate flex-1">{terminalUrl}</code>
                    <Button size="sm" variant={copied ? 'primary' : 'ghost'} className="!text-2xs" onClick={copyUrl}>
                        <ClipboardIcon className="w-3 h-3" /> {copied ? 'Copied' : 'Copy terminal URL'}
                    </Button>
                </div>
            )}

            {/* Provision form */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <div>
                    <label className="block text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Estate</label>
                    <Select value={propertyId} onChange={(e: any) => setPropertyId(e.target.value)}>
                        <option value="">Choose the estate…</option>
                        {(properties ?? []).map((p: any) => (
                            <option key={p.id ?? p._id} value={p.id ?? p._id}>{p.name}</option>
                        ))}
                    </Select>
                </div>
                <div>
                    <label className="block text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Station name</label>
                    <Input value={stationName} onChange={(e: any) => setStationName(e.target.value)} placeholder="e.g. Main Gate / Gate 1" />
                </div>
                <Button
                    variant="primary"
                    size="md"
                    disabled={provisioning || !stationName.trim() || !propertyId}
                    onClick={handleProvision}
                >
                    {provisioning ? 'Creating…' : 'Add station'}
                </Button>
            </div>
            <div className="mt-2">
                <Input
                    value={pinChoice}
                    onChange={(e: any) => setPinChoice(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="Station PIN (optional — leave blank and we generate a 6-digit PIN)"
                    className="!text-sm"
                />
            </div>

            {/* The one-time PIN reveal */}
            {revealedPin && (
                <div className="mt-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 text-center">
                    <p className="text-2xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">
                        {revealedPin.station} — PIN shown once, copy it now
                    </p>
                    <p className="text-3xl font-black tracking-[0.3em] text-emerald-700 dark:text-emerald-400 select-all">{revealedPin.pin}</p>
                    <p className="text-3xs text-slate-500 dark:text-zinc-400 mt-1">
                        The PIN is never stored readable — reset it any time if a guard forgets it.
                    </p>
                    <Button size="sm" variant="ghost" className="mt-2 !text-2xs" onClick={() => setRevealedPin(null)}>Done</Button>
                </div>
            )}

            {/* Station list */}
            {accounts && accounts.length > 0 && (
                <div className="mt-4 space-y-1.5">
                    {accounts.map((a: any) => (
                        <div key={a.accountId} className={`flex items-center justify-between gap-2 py-2.5 px-3 rounded-lg ${
                            a.status === 'active'
                                ? 'bg-slate-50 dark:bg-zinc-900/60'
                                : 'bg-slate-50/50 dark:bg-zinc-900/30 opacity-60'
                        }`}>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <ShieldCheckIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{a.stationName}</span>
                                    <span className="text-2xs text-slate-500 dark:text-zinc-400 truncate">{a.propertyName}</span>
                                    <span className={`text-3xs px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                                        a.status === 'active'
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                            : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'
                                    }`}>
                                        {a.status === 'active' ? 'Active' : 'Revoked'}
                                    </span>
                                </div>
                                <div className="text-2xs text-slate-400 dark:text-zinc-500 mt-0.5">
                                    Created by {a.createdByName} · last login {fmtDT(a.lastLoginAt)}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                {a.status === 'active' && (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="!text-2xs"
                                            disabled={resettingId === a.accountId}
                                            onClick={() => handleResetPin(a.accountId)}
                                        >
                                            {resettingId === a.accountId ? '…' : 'Reset PIN'}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="danger-soft"
                                            className="!text-2xs"
                                            onClick={() => handleRevoke(a.accountId, a.stationName)}
                                        >
                                            Revoke
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default GatehouseAccountsPanel;
