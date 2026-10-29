/**
 * EstatePhoneExplorer — the pocket frame: the manager's app, playable
 * (R41).
 *
 * The R40 band pinned a 390x844 capture inside a dark bezel and the
 * letterboxing read as "a huge black space where the actual phone screen
 * is" (owner, R41). This frame fixes that at the root: the screen is the
 * app itself, rendered live at the phone's real 390px layout and scaled
 * to the bezel — edge to edge, no image, no bars. Tap a property card
 * and the property opens full-screen with a Back bar (the app's own
 * mobile pattern), tap a unit and it expands to its larger form, press
 * More for the rest. The bottom nav (Home · Properties · Financials ·
 * Tasks · More) is the Atrium product's own primary bar.
 */
import React from 'react';
import { ChevronLeft, ChevronRight, Bell, Home, Building2, Wallet, ListTodo, MoreHorizontal } from 'lucide-react';
import { MANAGER } from './estateDemoData';
import {
    useEstateExplorerState, PropertiesPanel, PropertyDetail, EstateToast,
} from './estateChrome';

/** The phone's logical size and the scale applied to fit the bezel.
 *  390x844 is the real handset layout the captures ran at — scaled to
 *  the bezel, never letterboxed. R43: 0.72 (was 0.78) — the owner found
 *  the handset "a bit too large" next to the workspace; this reads as a
 *  modest pocket device while the 390px layout stays fully legible. */
const PHONE_W = 390;
const PHONE_H = 844;
const SCALE = 0.72;

const BottomNavItem: React.FC<{
    label: string;
    icon: React.ReactNode;
    active?: boolean;
    onClick: () => void;
}> = ({ label, icon, active, onClick }) => (
    <button
        onClick={onClick}
        aria-label={label}
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 transition-colors ${
            active ? 'text-primary-600' : 'text-slate-500'
        }`}
    >
        {icon}
        <span className={`text-3xs font-bold ${active ? 'text-primary-600' : 'text-slate-500'}`}>{label}</span>
    </button>
);

export const EstatePhoneExplorer: React.FC = () => {
    const state = useEstateExplorerState();

    return (
        <div
            className="relative overflow-hidden bg-white"
            style={{ width: PHONE_W * SCALE, height: PHONE_H * SCALE }}
            role="region"
            aria-label="Atrium on a phone — interactive preview"
        >
            {/* The phone screen, rendered at its true 390px layout and
                scaled to the bezel — the same geometry as the capture. */}
            <div
                className="absolute top-0 left-0 origin-top-left flex flex-col bg-white"
                style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${SCALE})` }}
            >
                {/* Status bar */}
                <div className="h-6 flex items-center justify-between px-5 bg-white flex-shrink-0">
                    <span className="text-2xs font-bold text-slate-900">9:41</span>
                    <div className="flex items-center gap-1 text-slate-900">
                        {/* signal */}
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M2 20h3v-6H2v6zm5 0h3V9H7v11zm5 0h3V5h-3v15zm5 0h3V2h-3v18z" /></svg>
                        {/* wifi */}
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 19l9-11c-2.7-2.2-5.7-3.3-9-3.3S5.7 5.8 3 8l9 11z" /></svg>
                        {/* battery */}
                        <svg className="w-5 h-3" viewBox="0 0 28 14" fill="none"><rect x="1" y="1" width="22" height="12" rx="3" stroke="currentColor" strokeWidth="1.4" /><rect x="3" y="3" width="16" height="8" rx="1.5" fill="currentColor" /><rect x="25" y="4.5" width="2.5" height="5" rx="1" fill="currentColor" /></svg>
                    </div>
                </div>

                {/* The app's mobile header */}
                <div className="h-11 flex-shrink-0 flex items-center gap-2 px-3 bg-white border-b border-slate-200">
                    <ChevronLeft className="w-4 h-4 text-slate-300" />
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                    <div className="w-6 h-6 rounded-lg bg-primary-600 text-white text-2xs font-black flex items-center justify-center flex-shrink-0">P</div>
                    <div className="flex-1" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Online" />
                    <button
                        onClick={() => state.showToast('Preview — notifications open the notification center.')}
                        aria-label="Notifications"
                        className="relative text-slate-500"
                    >
                        <Bell className="w-4 h-4" />
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-500" />
                    </button>
                    <div className="w-6 h-6 rounded-full bg-emerald-700 text-white text-2xs font-black flex items-center justify-center" title={MANAGER.name}>
                        {MANAGER.initials}
                    </div>
                </div>

                {/* The screen: list, or the open property */}
                <div className="flex-1 min-h-0 relative">
                    {/* LIST */}
                    <div className="absolute inset-0">
                        <PropertiesPanel state={state} hintLabel="Tap a property to explore" compact />
                    </div>
                    {/* DETAIL — full-screen, the app's mobile pattern */}
                    {state.property && (
                        <div className="absolute inset-0 z-20 flex flex-col animate-fade-in">
                            <div className="flex-shrink-0 flex items-center justify-between px-3 h-12 border-b border-slate-200 bg-white shadow-sm z-30">
                                <button
                                    onClick={state.closeProperty}
                                    className="flex items-center text-slate-600 active:text-primary-600"
                                    aria-label="Back to properties"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    <span className="ml-0.5 text-xs font-semibold">Back</span>
                                </button>
                                <span className="font-bold truncate text-xs text-slate-900">Property Details</span>
                                <span className="w-12" />
                            </div>
                            <div className="flex-1 min-h-0">
                                <PropertyDetail property={state.property} state={state} variant="mobile" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom navigation — the Atrium primary bar */}
                <nav className="h-[62px] flex-shrink-0 bg-white/95 backdrop-blur border-t border-slate-200 flex items-start">
                    <BottomNavItem label="Home" icon={<Home className="w-4 h-4" />} onClick={() => state.showToast('Preview keeps to Properties — Home opens in the product.')} />
                    <BottomNavItem label="Properties" icon={<Building2 className="w-4 h-4" />} active onClick={() => state.closeProperty()} />
                    <BottomNavItem label="Financials" icon={<Wallet className="w-4 h-4" />} onClick={() => state.showToast('Preview keeps to Properties — Financials opens in the product.')} />
                    <BottomNavItem label="Tasks" icon={<ListTodo className="w-4 h-4" />} onClick={() => state.showToast('Preview keeps to Properties — Tasks opens in the product.')} />
                    <BottomNavItem label="More" icon={<MoreHorizontal className="w-4 h-4" />} onClick={() => state.showToast('Preview keeps to Properties — the full menu opens in the product.')} />
                </nav>
            </div>

            <EstateToast toast={state.toast} />
        </div>
    );
};
