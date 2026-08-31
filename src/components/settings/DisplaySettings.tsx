
import React, { useState, useEffect } from 'react';
import { Theme, FontSize, User } from '../../types';
import { SunIcon, MoonIcon, FontSizeIcon, DesktopComputerIcon, ZapIcon } from '../../constants';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { haptics } from '../../utils/haptics';
import { notificationManager } from '../../utils/notifications';

const SettingsCard: React.FC<{ title: string; children: React.ReactNode; id?: string, className?: string }> = ({ title, children, id, className }) => (
    <div id={id} className={`relative overflow-hidden bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-md p-6 ${className || ''}`}>
        <div className="relative z-10">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{title}</h3>
            {children}
        </div>
    </div>
);

const Toggle: React.FC<{
    label: string;
    description: string;
    isChecked: boolean;
    onToggle: () => void;
}> = ({ label, description, isChecked, onToggle }) => (
    <div>
        <div className="flex justify-between items-center">
            <label className="text-slate-800 dark:text-white font-medium">{label}</label>
            <div
                role="switch"
                aria-checked={isChecked}
                onClick={onToggle}
                className={`${isChecked ? 'bg-primary-600' : 'bg-slate-300 dark:bg-zinc-600'} relative inline-flex items-center h-6 rounded-full w-11 transition-colors cursor-pointer`}
            >
                <span className={`${isChecked ? 'translate-x-6' : 'translate-x-1'} inline-block w-4 h-4 transform bg-white dark:bg-zinc-900 rounded-full transition-transform`} />
            </div>
        </div>
        <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">{description}</p>
    </div>
);

// ─── Theme Picker Data ───────────────────────────────────────────────
interface ThemeOption {
    value: Theme;
    label: string;
    swatch: string; // CSS color for the preview dot
}

const THEME_GROUPS: { title: string; options: ThemeOption[] }[] = [
    {
        title: 'System',
        options: [
            { value: 'system' as Theme, label: 'System Auto-Match', swatch: 'linear-gradient(135deg, #ffffff 50%, #0f172a 50%)' },
        ],
    },
    {
        title: 'Light Themes',
        options: [
            { value: 'light' as Theme, label: 'Standard Light', swatch: '#ffffff' },
            { value: 'city-lights' as Theme, label: 'City Lights', swatch: '#e2e8f0' },
            { value: 'sunlight-soft' as Theme, label: 'Sunlight Soft', swatch: '#fef3c7' },
            { value: 'city-emerald' as Theme, label: 'City Lights (Green Tint)', swatch: '#d1fae5' },
            { value: 'army-light' as Theme, label: 'Army Green (Soft Light)', swatch: '#84cc16' },
        ],
    },
    {
        title: 'Dark Themes',
        options: [
            { value: 'dark' as Theme, label: 'Standard Dark', swatch: '#1e293b' },
            { value: 'midnight' as Theme, label: 'Midnight Royal', swatch: '#1e1b4b' },
            { value: 'oled' as Theme, label: 'OLED Black', swatch: '#000000' },
            { value: 'neon-cyber' as Theme, label: 'Neon Cyber', swatch: '#0f172a' },
            { value: 'midnight-emerald' as Theme, label: 'Midnight Royal (Green Tint)', swatch: '#064e3b' },
            { value: 'army-dark' as Theme, label: 'Army Green (Midnight variant)', swatch: '#1a2e05' },
        ],
    },
];

// ─── ThemePicker Component ───────────────────────────────────────────
// Custom-styled popover replacing the native <select>. Features:
//   - Closed trigger box with chevron icon that rotates when open
//   - Floating dropdown with glassmorphism styling
//   - Grouped category headers (System, Light, Dark)
//   - Color swatch preview dots per theme
//   - Checkmark on active selection
//   - Smooth fade-and-scale entry animation
//   - Click-outside to close, ESC to close
const ThemePicker: React.FC<{ theme: Theme; setTheme: (t: Theme) => void }> = ({ theme, setTheme }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    // Close on ESC
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen]);

    // Find the active theme's label for the trigger display
    const activeOption = THEME_GROUPS.flatMap(g => g.options).find(o => o.value === theme);
    const activeLabel = activeOption?.label || 'Select Theme';
    const activeSwatch = activeOption?.swatch || '#64748b';

    return (
        <div className="relative" ref={ref}>
            {/* Closed trigger box */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full h-11 px-4 py-2.5 rounded-md border transition-all duration-200 flex items-center justify-between cursor-pointer bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-700/80 hover:border-emerald-500/50 text-slate-800 dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
                <span className="flex items-center gap-2.5 min-w-0">
                    <span
                        className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 flex-shrink-0 shadow-sm"
                        style={{ background: activeSwatch }}
                    />
                    <span className="text-sm font-medium truncate">{activeLabel}</span>
                </span>
                <svg
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Floating dropdown */}
            {isOpen && (
                <div
                    className="absolute top-full left-0 right-0 mt-2 p-2 rounded-lg shadow-2xl border backdrop-blur-md z-50 min-w-[280px] bg-white dark:bg-slate-900/95 border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 animate-in fade-in-0 zoom-in-95 duration-150 max-h-[400px] overflow-y-auto custom-scrollbar"
                >
                    {THEME_GROUPS.map((group, gi) => (
                        <div key={group.title}>
                            {/* Group header */}
                            <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase px-3 pt-3 pb-1.5">
                                {group.title}
                            </p>
                            {/* Theme options */}
                            {group.options.map((opt) => {
                                const isActive = theme === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => {
                                            setTheme(opt.value);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full px-3 py-2 flex items-center justify-between rounded-lg transition-colors cursor-pointer text-left ${
                                            isActive
                                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                                : 'hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300 text-slate-700 dark:text-slate-200'
                                        }`}
                                    >
                                        <span className="flex items-center gap-2.5 min-w-0">
                                            <span
                                                className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 flex-shrink-0 shadow-sm"
                                                style={{ background: opt.swatch }}
                                            />
                                            <span className="text-sm font-medium truncate">{opt.label}</span>
                                        </span>
                                        {isActive && (
                                            <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </button>
                                );
                            })}
                            {gi < THEME_GROUPS.length - 1 && (
                                <div className="border-t border-slate-100 dark:border-slate-800 my-1 mx-2" />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


interface DisplaySettingsProps {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    className?: string;
}

const DisplaySettings: React.FC<DisplaySettingsProps> = ({ theme, setTheme, className }) => {
    const { fontSize, setFontSize } = useUI();
    const { currentUser, updateCurrentUser } = useAuth();
    const { updateItem } = useDataActions();
    // Re-render trigger for haptics/sound toggles (they read from localStorage)
    const [hapticsToggle, setHapticsToggle] = useState(0);

    const handleToggleFlashes = () => {
        if (!currentUser) return;
        const newVal = !(currentUser.enableLiveFlashes ?? true);
        updateCurrentUser({ enableLiveFlashes: newVal });
    };

    return (
        <>
            <SettingsCard title="Appearance" id="display-settings" className={className}>
                <div className="space-y-6">
                    <div id="theme-preference">
                        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-3">Theme System Preference</label>
                        {/* CUSTOM THEME PICKER — replaces native <select> with a
                            styled popover matching the app's design system.
                            Features: grouped categories, color swatches,
                            checkmark on active, smooth animations, dark mode. */}
                        <ThemePicker theme={theme} setTheme={setTheme} />
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-3">
                            Changes apply immediately across the application.
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">Font Size</label>
                        <div className="flex p-1 bg-slate-200 dark:bg-zinc-800 rounded-lg">
                            {(['sm', 'md', 'lg'] as FontSize[]).map(size => (
                                <button
                                    key={size}
                                    onClick={() => setFontSize(size)}
                                    className={`w-full text-center px-4 py-2 rounded-md text-sm font-semibold transition-colors capitalize flex items-center justify-center gap-2 ${fontSize === size ? 'bg-white dark:bg-zinc-700 shadow text-slate-900 dark:text-white' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'}`}
                                >
                                    <span className="font-serif font-bold tracking-tight opacity-70">Aa</span>
                                    {size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
                                </button>
                            ))}
                        </div>

                        <div className="pt-6 border-t border-slate-100 dark:border-zinc-800">
                            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-4">Typography Preview</label>
                            <div className="p-6 bg-slate-50 dark:bg-zinc-900/50 rounded-lg border border-slate-100 dark:border-zinc-800 space-y-4">
                                <div className="space-y-1">
                                    <h4 className="text-2xl font-bold text-slate-900 dark:text-white transition-all">This is a Heading</h4>
                                    <p className="text-sm text-slate-500 dark:text-zinc-400">Subtitle or secondary text</p>
                                </div>
                                <p className="text-base text-slate-700 dark:text-zinc-300 leading-relaxed">
                                    This sample text allows you to preview how your chosen font size affects the application's overall readability.
                                    Our global typography system ensures that all elements scale proportionally while maintaining a premium aesthetic.
                                </p>
                                <div className="flex gap-4 pt-2">
                                    <div className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-bold rounded-full">Tag Label</div>
                                    <div className="px-3 py-1 bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-full">Secondary</div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
                            <Toggle
                                label="Live Update Flashes"
                                description="Visually flash interface elements (counters, cards) when data updates in real-time."
                                isChecked={currentUser?.enableLiveFlashes ?? true}
                                onToggle={handleToggleFlashes}
                            />
                        </div>
                    </div>
                </div>
            </SettingsCard>

            {/* ─── Haptics & Sounds ────────────────────────────────────────
                Mobile-only settings for haptic feedback (vibration on button
                taps) and notification sounds. These are no-ops on web. */}
            <SettingsCard title="Haptics & Sounds" className={className}>
                <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">
                    Customise physical feedback and sounds on your mobile device.
                    These settings only apply when using the PracticePro mobile app.
                </p>
                <div className="space-y-4">
                    <Toggle
                        label="Haptic Feedback"
                        description="Vibrate lightly when you tap buttons, change tabs, or submit forms. Helps the app feel responsive."
                        isChecked={haptics.isEnabled()}
                        onToggle={() => {
                            const newVal = !haptics.isEnabled();
                            haptics.setEnabled(newVal);
                            if (newVal) haptics.light(); // test tap
                            // Force re-render
                            setHapticsToggle(v => v + 1);
                        }}
                    />
                    <Toggle
                        label="Notification Sounds"
                        description="Play a sound when you receive a new notification. Disable for silent operation."
                        isChecked={notificationManager.isSoundEnabled()}
                        onToggle={() => {
                            const newVal = !notificationManager.isSoundEnabled();
                            notificationManager.setSoundEnabled(newVal);
                            setHapticsToggle(v => v + 1);
                        }}
                    />
                </div>
            </SettingsCard>
        </>
    );
};

export default DisplaySettings;
