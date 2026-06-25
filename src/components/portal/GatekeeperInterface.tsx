/**
 * GatekeeperInterface — Lightweight Gate Verification Portal
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Designed for gate tablets/phones. Optimized for:
 *   - Low data usage (minimal queries, cached results)
 *   - Fast input (large 6-digit code field)
 *   - Clear visual feedback (green success / red error)
 *   - Offline fallback (caches last 100 verifications in localStorage)
 *
 * Accessible from the main app as a separate view, or from the
 * tenant portal via a "Gate Access" button.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useConvex } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { GateIcon, CheckIcon, XCircleIcon, ClockIcon, UserIcon, MapPinIcon } from '../../constants';

interface VerificationResult {
    valid: boolean;
    reason?: string;
    message?: string;
    tokenId?: string;
    visitorName?: string;
    visitorPhone?: string;
    estateName?: string;
    address?: string;
    unitName?: string;
    residentName?: string;
    expiresAt?: number;
    visitDate?: string;
    checkedInAt?: number;
    validFrom?: number;
    expiredAt?: number;
}

const OFFLINE_CACHE_KEY = 'practicepro_gatehouse_cache';
const MAX_CACHE_SIZE = 100;

export const GatekeeperInterface: React.FC<{ firmId: string; onBack?: () => void }> = ({ firmId, onBack }) => {
    const convex = useConvex();
    const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
    const [codeInput, setCodeInput] = useState('');
    const [verification, setVerification] = useState<VerificationResult | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [offlineCache, setOfflineCache] = useState<any[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    // ─── Queries ────────────────────────────────────────────────────────
    const properties = useQuery(api.visitorManagement.getGatekeeperProperties, firmId ? { firmId } : 'skip');
    const logs = useQuery(
        api.visitorManagement.getGatehouseLogs,
        selectedPropertyId ? { propertyId: selectedPropertyId } : 'skip'
    );

    // ─── Mutations ──────────────────────────────────────────────────────
    const checkIn = useMutation(api.visitorManagement.checkInVisitor);
    const checkOut = useMutation(api.visitorManagement.checkOutVisitor);

    // ─── Online/offline detection ───────────────────────────────────────
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // ─── Load offline cache ─────────────────────────────────────────────
    useEffect(() => {
        try {
            const cached = localStorage.getItem(OFFLINE_CACHE_KEY);
            if (cached) setOfflineCache(JSON.parse(cached));
        } catch {}
    }, []);

    // ─── Auto-select first property ─────────────────────────────────────
    useEffect(() => {
        if (properties && properties.length > 0 && !selectedPropertyId) {
            setSelectedPropertyId(properties[0].id);
        }
    }, [properties]);

    // ─── Verify code ────────────────────────────────────────────────────
    const handleVerify = async () => {
        if (codeInput.length !== 6 || !selectedPropertyId) return;
        setIsVerifying(true);
        setVerification(null);

        if (!isOnline) {
            // Offline fallback: check local cache
            const cached = offlineCache.find(c => c.tokenCode === codeInput && c.propertyId === selectedPropertyId);
            if (cached) {
                setVerification({
                    valid: true,
                    tokenId: cached.tokenId,
                    visitorName: cached.visitorName,
                    estateName: cached.estateName,
                    address: cached.address,
                    unitName: cached.unitName,
                    residentName: cached.residentName,
                    expiresAt: cached.expiresAt,
                    visitDate: cached.visitDate,
                });
            } else {
                setVerification({
                    valid: false,
                    reason: 'offline',
                    message: 'Cannot verify — device is offline and code not in cache. Try again when online.',
                });
            }
            setIsVerifying(false);
            return;
        }

        try {
            const result = await convex.query(api.visitorManagement.verifyToken, {
                tokenCode: codeInput,
                propertyId: selectedPropertyId,
            });
            setVerification(result as VerificationResult);

            // Cache successful verifications for offline fallback
            if ((result as any)?.valid) {
                const newCacheEntry = {
                    tokenId: (result as any).tokenId,
                    tokenCode: codeInput,
                    propertyId: selectedPropertyId,
                    visitorName: (result as any).visitorName,
                    estateName: (result as any).estateName,
                    address: (result as any).address,
                    unitName: (result as any).unitName,
                    residentName: (result as any).residentName,
                    expiresAt: (result as any).expiresAt,
                    visitDate: (result as any).visitDate,
                    cachedAt: Date.now(),
                };
                const updatedCache = [newCacheEntry, ...offlineCache].slice(0, MAX_CACHE_SIZE);
                setOfflineCache(updatedCache);
                localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(updatedCache));
            }
        } catch (err: any) {
            setVerification({
                valid: false,
                reason: 'error',
                message: err.message || 'Verification failed. Check your connection.',
            });
        } finally {
            setIsVerifying(false);
        }
    };

    // ─── Approve entry (check in) ───────────────────────────────────────
    const handleApproveEntry = async () => {
        if (!verification?.tokenId) return;
        try {
            await checkIn({
                tokenId: verification.tokenId as any,
                gatekeeperName: 'Gatekeeper',
            });
            setVerification({ ...verification, valid: false, reason: 'checked_in', message: `${verification.visitorName} checked in successfully.` });
            setCodeInput('');
            inputRef.current?.focus();
        } catch (err: any) {
            setVerification({ ...verification, valid: false, reason: 'error', message: err.message });
        }
    };

    // ─── Check out ──────────────────────────────────────────────────────
    const handleCheckOut = async (tokenId: string) => {
        try {
            await checkOut({ tokenId: tokenId as any });
        } catch (err: any) {
            console.error('Checkout failed:', err);
        }
    };

    // ─── Render ─────────────────────────────────────────────────────────
    return (
        <div className="min-h-[100dvh] bg-slate-100 dark:bg-zinc-950 flex flex-col">
            {/* Header */}
            <div className="flex-shrink-0 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-700 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {onBack && (
                        <button onClick={onBack} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    )}
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
                        <GateIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="font-black text-slate-900 dark:text-white text-base">Gatehouse</h1>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-400">Visitor Verification</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Online/offline indicator */}
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
                        isOnline ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'} ${isOnline ? '' : 'animate-pulse'}`} />
                        {isOnline ? 'Online' : 'Offline'}
                    </div>
                </div>
            </div>

            {/* Property selector */}
            {properties && properties.length > 1 && (
                <div className="flex-shrink-0 px-4 py-2 bg-white dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800">
                    <select
                        value={selectedPropertyId}
                        onChange={(e) => setSelectedPropertyId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/30"
                    >
                        {properties.map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Main content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Code input */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-soft p-6">
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2 text-center">
                        Enter 6-Digit Access Code
                    </label>
                    <input
                        ref={inputRef}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={codeInput}
                        onChange={(e) => {
                            setCodeInput(e.target.value.replace(/\D/g, ''));
                            setVerification(null);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                        placeholder="000000"
                        className="w-full text-center text-5xl font-black tracking-[0.4em] py-6 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-zinc-700 focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none transition-all"
                        autoFocus
                    />
                    <button
                        onClick={handleVerify}
                        disabled={codeInput.length !== 6 || isVerifying || !selectedPropertyId}
                        className="w-full mt-4 px-6 py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-base hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed transition-colors"
                    >
                        {isVerifying ? 'Verifying...' : 'Verify Code'}
                    </button>
                </div>

                {/* Verification result */}
                {verification && (
                    <div className={`rounded-2xl shadow-soft p-6 animate-in fade-in zoom-in duration-300 ${
                        verification.valid
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-300 dark:border-emerald-700'
                            : 'bg-rose-50 dark:bg-rose-900/20 border-2 border-rose-300 dark:border-rose-700'
                    }`}>
                        {verification.valid ? (
                            <>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
                                        <CheckIcon className="w-7 h-7 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-emerald-700 dark:text-emerald-400">Valid Entry</h2>
                                        <p className="text-sm text-emerald-600 dark:text-emerald-500">Code verified successfully</p>
                                    </div>
                                </div>
                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center gap-2 text-sm">
                                        <UserIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                        <span className="font-bold text-slate-900 dark:text-white">{verification.visitorName}</span>
                                    </div>
                                    {verification.unitName && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <MapPinIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                            <span className="text-slate-700 dark:text-zinc-300">Going to: {verification.unitName}</span>
                                        </div>
                                    )}
                                    {verification.residentName && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <UserIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                            <span className="text-slate-700 dark:text-zinc-300">Host: {verification.residentName}</span>
                                        </div>
                                    )}
                                    {verification.expiresAt && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <ClockIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                            <span className="text-slate-700 dark:text-zinc-300">Valid until: {new Date(verification.expiresAt).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={handleApproveEntry}
                                    className="w-full px-6 py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-base hover:bg-emerald-700 transition-colors"
                                >
                                    Approve Entry
                                </button>
                            </>
                        ) : (
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-rose-500 rounded-full flex items-center justify-center flex-shrink-0">
                                    <XCircleIcon className="w-7 h-7 text-white" />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-lg font-black text-rose-700 dark:text-rose-400">
                                        {verification.reason === 'expired' ? 'Code Expired' :
                                         verification.reason === 'revoked' ? 'Code Revoked' :
                                         verification.reason === 'used' ? 'Already Used' :
                                         verification.reason === 'already_inside' ? 'Already Inside' :
                                         verification.reason === 'not_yet_valid' ? 'Not Yet Valid' :
                                         verification.reason === 'offline' ? 'Offline Mode' :
                                         'Invalid Code'}
                                    </h2>
                                    <p className="text-sm text-rose-600 dark:text-rose-500">{verification.message}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Today's logs */}
                {logs && logs.length > 0 && (
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-soft p-4">
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-3">Today's Activity ({logs.length})</h3>
                        <div className="space-y-1.5 max-h-64 overflow-y-auto">
                            {logs.map((log: any) => (
                                <div key={log._id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{log.visitorName}</span>
                                            <span className="text-[10px] font-mono text-slate-400">{log.tokenCode}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                            {log.checkedInAt && <span>In: {new Date(log.checkedInAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
                                            {log.checkedOutAt && <span>Out: {new Date(log.checkedOutAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
                                            {!log.checkedInAt && <span className="text-amber-500">Pending</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                                            log.status === 'used' && log.checkedOutAt ? 'bg-slate-100 text-slate-500 dark:bg-zinc-700 dark:text-zinc-400' :
                                            log.status === 'used' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                            log.status === 'revoked' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                            'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                        }`}>
                                            {log.status === 'used' && log.checkedOutAt ? 'Completed' :
                                             log.status === 'used' ? 'Inside' :
                                             log.status === 'revoked' ? 'Revoked' :
                                             'Active'}
                                        </span>
                                        {log.status === 'used' && log.checkedInAt && !log.checkedOutAt && (
                                            <button
                                                onClick={() => handleCheckOut(log._id)}
                                                className="text-[9px] px-2 py-0.5 bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-full font-bold hover:bg-slate-200 dark:hover:bg-zinc-600"
                                            >
                                                Check Out
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
