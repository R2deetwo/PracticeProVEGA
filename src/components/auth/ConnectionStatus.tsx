
import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheckIcon, DismissIcon, RevertIcon, ZapIcon, OfficeBuildingIcon, CheckCircleIcon, SearchIcon, TrashIcon } from '../../constants';
import { useAuth } from '../../contexts/AuthContext';
import { useMatterState } from '../../contexts/MatterContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

const ConnectionStatus: React.FC = () => {
    const { currentUser, refreshUser } = useAuth();
    const { matterState } = useMatterState();
    const { coreState, isDataLoaded } = useCoreState();
    const { addToast, isOnline: deviceOnline } = useUI();
    const diagnoseMutation = useMutation(api.myFunctions.diagnoseConnectivity);
    const repairMutation = useMutation(api.myFunctions.repairAccountConnection);
    const deleteFirmMutation = useMutation(api.myFunctions.deleteFirm);

    // Status now includes 'network-offline' — distinct from 'offline' (offline MODE)
    // 'connected' = account is linked AND device has network
    // 'network-offline' = device has no network (green dot turns grey)
    // 'offline' = user is in offline MODE (account-level)
    // 'orphaned' = account has no firm
    const [status, setStatus] = useState<'connected' | 'network-offline' | 'offline' | 'orphaned'>('connected');

    // Diagnostic Modal State
    const [showDiagnostics, setShowDiagnostics] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<any>(null);

    // Deletion State
    const [firmToDelete, setFirmToDelete] = useState<any>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    const isOfflineMode = currentUser?.id?.startsWith('offline_');
    const isOrphaned = currentUser && !currentUser.firmId && !isOfflineMode;

    useEffect(() => {
        if (isOfflineMode) {
            setStatus('offline');
        } else if (isOrphaned) {
            setStatus('orphaned');
        } else if (!deviceOnline) {
            // Device has no network — show grey "Offline" indicator.
            // This is the KEY fix: previously this check was missing, so the
            // green "Online" dot stayed green even when data was turned off.
            setStatus('network-offline');
        } else if (isDataLoaded && matterState.matters) {
            setStatus('connected');
        } else {
            setStatus('connected');
        }
    }, [isDataLoaded, currentUser, isOfflineMode, isOrphaned, matterState.matters, deviceOnline]);

    // Auto-Scan whenever the modal is opened
    useEffect(() => {
        if (showDiagnostics && currentUser?.email) {
            runScan();
        } else {
            // Reset states when closed
            setFirmToDelete(null);
            setDeleteConfirmation("");
        }
    }, [showDiagnostics]);

    const runScan = async () => {
        if (!currentUser?.email) {
            window.location.reload();
            return;
        }
        setIsScanning(true);
        setScanResult(null);
        try {
            const result = await diagnoseMutation({ email: currentUser.email });
            setScanResult(result);
        } catch (e) {
            console.error("Scan failed", e);
        } finally {
            setIsScanning(false);
        }
    };

    const handleConnectFirm = async (firmId: string) => {
        if (!currentUser?.email) return;
        setIsScanning(true);
        try {
            await repairMutation({ email: currentUser.email, targetFirmId: firmId });
            await refreshUser();
            setTimeout(() => {
                setShowDiagnostics(false);
                window.location.reload();
            }, 1000);
        } catch (e) {
            addToast("Failed to connect. Please try again.", { type: 'error' });
            setIsScanning(false);
        }
    };

    const handleDeleteFirm = async () => {
        if (!firmToDelete || !currentUser?.email) return;

        setIsDeleting(true);
        try {
            await deleteFirmMutation({ firmId: firmToDelete.id, confirmed: true });
            setFirmToDelete(null);
            setDeleteConfirmation("");
            // Re-scan to update list
            await runScan();
        } catch (e) {
            addToast("Failed to delete workspace.", { type: 'error' });
        } finally {
            setIsDeleting(false);
        }
    };

    // Prepare list with visual disambiguation for duplicates
    const displayFirms = useMemo(() => {
        if (!scanResult?.availableFirms) return [];

        const firms = [...scanResult.availableFirms];
        const nameCounts: Record<string, number> = {};

        // Sort by creation time if available (oldest first)
        firms.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

        return firms.map(firm => {
            const baseName = firm.name;
            if (!nameCounts[baseName]) {
                nameCounts[baseName] = 1;
                return { ...firm, displayName: baseName }; // First one keeps original name
            } else {
                const count = nameCounts[baseName];
                nameCounts[baseName]++;
                return { ...firm, displayName: `${baseName} (${count})` }; // Subsequent get numbered
            }
        });
    }, [scanResult]);

    const handleButtonClick = () => {
        // When the device is offline, show a simple toast — NOT the workspace
        // diagnostics modal. The user just needs to know they're offline.
        if (status === 'network-offline') {
            addToast('You are currently offline. Some features may be unavailable.', { type: 'warning' });
            return;
        }
        setShowDiagnostics(true);
    };

    // Render Status Badge
    const renderBadge = () => {
        if (status === 'connected') {
            return (
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors group">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest hidden sm:inline">Online</span>
                </div>
            );
        }

        if (status === 'network-offline') {
            // Grey indicator — device has no network connection.
            // This is what shows when the user turns off their data.
            return (
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
                    <div className="w-2 h-2 bg-slate-400 dark:bg-zinc-500 rounded-full"></div>
                    <span className="text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest hidden sm:inline">Offline</span>
                </div>
            );
        }

        if (status === 'offline') {
            return (
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-colors">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">Offline Mode</span>
                </div>
            );
        }

        return (
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-colors">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-[10px] font-black text-purple-700 dark:text-purple-400 uppercase tracking-widest">Setup Needed</span>
            </div>
        );
    };

    if (!showDiagnostics && (status === 'connected' || status === 'network-offline')) {
        return (
            <button
                onClick={handleButtonClick}
                title={status === 'network-offline' ? "You are offline — tap for info" : "System Online - Click for details"}
                className="focus:outline-none"
            >
                {renderBadge()}
            </button>
        );
    }

    const triggerLabel = status === 'offline' ? "Reconnect" : "Find Office";
    const triggerIcon = status === 'offline' ? <RevertIcon className="w-3 h-3 text-amber-600" /> : <OfficeBuildingIcon className="w-3 h-3 text-purple-700" />;
    const triggerColor = status === 'offline' ? 'bg-amber-50 border-amber-200' : 'bg-purple-100 border-purple-300';

    // The Modal Content
    const modalContent = showDiagnostics ? (
        <div className="fixed inset-0 z-[9999] flex justify-center items-start pt-24 animate-fade-in pointer-events-auto">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => !firmToDelete && setShowDiagnostics(false)}
            />

            {/* Modal Card */}
            <div className="relative bg-white dark:bg-zinc-800 rounded-lg shadow-2xl border border-slate-200 dark:border-zinc-700 w-72 overflow-hidden flex flex-col z-10 max-h-[80vh]">
                <div className="p-3 border-b border-slate-100 dark:border-zinc-700 flex justify-between items-center bg-slate-50 dark:bg-zinc-900/50">
                    <h3 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wide">
                        {firmToDelete ? "Delete Workspace" : "System Status"}
                    </h3>
                    {!firmToDelete && (
                        <button onClick={() => setShowDiagnostics(false)} className="text-slate-400 hover:text-slate-600">
                            <DismissIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <div className="p-4 overflow-y-auto custom-scrollbar">
                    {/* DELETION CONFIRMATION VIEW */}
                    {firmToDelete ? (
                        <div className="space-y-4 animate-fade-in">
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900 rounded-lg">
                                <p className="text-xs text-red-800 dark:text-red-200 font-medium">
                                    Are you sure you want to delete <strong>{firmToDelete.displayName}</strong>? This action cannot be undone.
                                </p>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                    Type "{firmToDelete.displayName}" to confirm:
                                </label>
                                <input autoComplete="off" data-lpignore="true" 
                                    type="text"
                                    value={deleteConfirmation}
                                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                                    className="w-full p-2 text-sm border border-slate-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                    placeholder={firmToDelete.displayName}
                                    autoFocus
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    onClick={() => { setFirmToDelete(null); setDeleteConfirmation(""); }}
                                    className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded"
                                    disabled={isDeleting}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteFirm}
                                    disabled={deleteConfirmation !== firmToDelete.displayName || isDeleting}
                                    className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                >
                                    {isDeleting && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                    Delete Forever
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* NORMAL LIST VIEW */
                        <>
                            {isScanning ? (
                                <div className="flex flex-col items-center py-4">
                                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                                    <p className="text-xs text-slate-500">Scanning database...</p>
                                </div>
                            ) : scanResult ? (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">User Account</span>
                                        <span className={scanResult.userFound ? "text-green-600 font-bold" : "text-red-500 font-bold"}>
                                            {scanResult.userFound ? "Verified" : "Missing"}
                                        </span>
                                    </div>

                                    <div className="border-t border-slate-100 dark:border-zinc-700 pt-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Workspaces</p>
                                        {displayFirms.length > 0 ? (
                                            <div className="space-y-2">
                                                {displayFirms.map((firm: any) => (
                                                    <div key={firm.id} className="group relative flex justify-between items-center bg-slate-50 dark:bg-zinc-700/30 p-2 rounded border border-slate-200 dark:border-zinc-600 hover:border-slate-300 dark:hover:border-zinc-500 transition-colors">
                                                        <span className="text-xs font-bold truncate max-w-[140px]" title={firm.name}>{firm.displayName}</span>

                                                        {firm.status === 'Linked' ? (
                                                            <span className="text-[10px] text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded">Active</span>
                                                        ) : (
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    onClick={() => handleConnectFirm(firm.id)}
                                                                    className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                                                                >
                                                                    Connect
                                                                </button>
                                                                {/* Delete Button (Visible on Hover) */}
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setFirmToDelete(firm); }}
                                                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    title="Delete Workspace"
                                                                >
                                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-500 italic text-center">No workspaces found.</p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <button 
                                        onClick={runScan} 
                                        className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-6 py-2.5 rounded-lg shadow-sm transition-all"
                                    >
                                        {!currentUser?.email ? "Reload to Reconnect" : "Retry Scan"}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    ) : null;

    return (
        <>
            {/* Trigger Button */}
            <button
                className={`flex flex-col items-center justify-center px-3 py-1 rounded leading-none cursor-pointer border ${triggerColor} shadow-sm transition-all hover:scale-105 active:scale-95`}
                onClick={handleButtonClick}
                title="Click to troubleshoot connection"
            >
                <div className="relative mb-0.5">{triggerIcon}</div>
                <span className={`text-[8px] font-bold uppercase tracking-tighter ${status === 'offline' ? 'text-amber-700' : 'text-purple-800'}`}>
                    {triggerLabel}
                </span>
            </button>

            {/* Portal the Modal to Body to prevent cropping */}
            {showDiagnostics && createPortal(modalContent, document.body)}
        </>
    );
};

export default ConnectionStatus;
