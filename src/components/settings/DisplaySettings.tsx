
import React, { useState, useEffect } from 'react';
import { Theme, FontSize, User } from '../../types';
import { SunIcon, MoonIcon, FontSizeIcon, DesktopComputerIcon, ZapIcon } from '../../constants';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAccentTheme } from '../../contexts/AccentThemeContext';
import { ACCENT_THEME_OPTIONS } from '../../utils/accentTheme';
import { Button } from '../ui';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { haptics } from '../../utils/haptics';
import { notificationManager } from '../../utils/notifications';
import { getStartupViewPreference, setStartupViewPreference, type StartupViewPreference } from '../../utils/startupViewPreference';

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
                className="w-full h-11 px-4 py-2.5 rounded-md border transition-all duration-200 flex items-center justify-between cursor-pointer bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-700/80 hover:border-primary-500/50 text-slate-800 dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
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
                                                ? 'bg-primary-500/10 text-primary-700 dark:text-primary-300'
                                                : 'hover:bg-primary-500/10 hover:text-primary-700 dark:hover:text-primary-300 text-slate-700 dark:text-slate-200'
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
                                            <svg className="w-4 h-4 text-primary-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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

// ─── AccentPicker (R52) ──────────────────────────────────────────
// The product accent (primary colour) controller: Auto follows the
// active product (Komplete → green, Vega → legal copper, Atrium →
// jade); an explicit pick LOCKS the palette across every route. The
// choice persists per-account (localStorage) and applies instantly —
// sidebar active states, buttons, FAB, selection borders all re-tint
// because they read the same --color-primary-* ramp.
const AccentPicker: React.FC = () => {
    const { preference, setPreference, resolved } = useAccentTheme();
    return (
        <div id="accent-preference" role="radiogroup" aria-label="Accent colour">
            <div className="space-y-2">
                {ACCENT_THEME_OPTIONS.map((opt) => {
                    const isActive = preference === opt.value;
                    return (
                        <Button
                            key={opt.value}
                            variant="bare"
                            role="radio"
                            aria-checked={isActive}
                            onClick={() => setPreference(opt.value)}
                            className={`w-full px-3 py-2.5 flex items-center justify-between rounded-lg border transition-colors cursor-pointer text-left ${
                                isActive
                                    ? 'bg-primary-50 dark:bg-primary-950/30 border-primary-300 dark:border-primary-700'
                                    : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-700/80 hover:border-primary-300 dark:hover:border-primary-700'
                            }`}
                        >
                            <span className="flex items-center gap-3 min-w-0">
                                <span
                                    className="w-6 h-6 rounded-full border border-slate-300 dark:border-slate-600 flex-shrink-0 shadow-sm"
                                    style={{ background: opt.swatch }}
                                />
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold text-slate-800 dark:text-white truncate">{opt.label}</span>
                                    <span className="block text-xs text-slate-500 dark:text-zinc-400 truncate">{opt.description}</span>
                                </span>
                            </span>
                            {isActive && (
                                <svg className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </Button>
                    );
                })}
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-3">
                {preference === 'auto'
                    ? `Auto — currently following your active product (${resolved === 'atrium' ? 'Atrium jade' : 'Vega blue'}).`
                    : 'Locked — this palette applies to every screen until you change it.'}
            </p>
        </div>
    );
};

/* ── StartupViewPicker ────────────────────────────────────────────────────
   Where the app opens on launch (owner addendum 2026-11-18: "Default to
   Full Office Dashboard First"). Everyone starts on the Full Office
   dashboard; the Vox opt-in applies to MOBILE launches only.
   Uses the ui/Button primitive (ADR-0004 — no new raw form elements). */
const STARTUP_VIEW_OPTIONS: { value: StartupViewPreference; label: string; hint: string }[] = [
    { value: 'office', label: 'Full Office', hint: 'Default — open the full workspace' },
    { value: 'capture', label: 'ALOA Vox (mobile)', hint: 'Phone launches open the capture screen' },
    { value: 'auto', label: 'Full Office (legacy “Auto”)', hint: 'Same as Full Office — phones are no longer forced into capture' },
];

const StartupViewPicker: React.FC = () => {
    const { currentUser } = useAuth();
    const [preference, setPreference] = useState<StartupViewPreference>(() =>
        getStartupViewPreference(currentUser?.id)
    );

    React.useEffect(() => {
        setPreference(getStartupViewPreference(currentUser?.id));
    }, [currentUser?.id]);

    return (
        <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {STARTUP_VIEW_OPTIONS.map((opt) => {
                    // Stored 'auto' now behaves exactly like 'office' —
                    // highlight the Full Office card for it.
                    const isActive =
                        preference === opt.value ||
                        (preference === 'auto' && opt.value === 'office');
                    return (
                        <Button
                            key={opt.value}
                            variant={isActive ? 'primary' : 'outline'}
                            size="md"
                            minTouchTarget
                            onClick={() => {
                                setPreference(opt.value);
                                setStartupViewPreference(currentUser?.id, opt.value);
                            }}
                            className="!flex-col !gap-0.5 !h-auto !py-3"
                        >
                            <span className="text-sm font-semibold">{opt.label}</span>
                            <span className="text-2xs font-normal opacity-70 leading-tight text-center">{opt.hint}</span>
                        </Button>
                    );
                })}
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
                Applies the next time you open the app. ALOA Vox launches apply to phones
                only — desktop always keeps the full workspace. You can also flip this from the
                “Start in ALOA Vox on mobile” switch inside ALOA Vox itself.
            </p>
        </div>
    );
};

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
                    {/* R52 — the product accent controller. Auto follows the
                        active product; an explicit pick locks the palette
                        (per-account, localStorage). This is the fix for the
                        copper-on-Matters/Documents/Research fragmentation. */}
                    <div className="pt-6 border-t border-slate-100 dark:border-zinc-800">
                        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-3">Accent Colour (Product Theme)</label>
                        <AccentPicker />
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

            {/* ─── Startup View ────────────────────────────────────────────
                Owner addendum 2026-11-18: everyone opens the Full Office
                dashboard first. Vox is an explicit, per-account
                opt-in for mobile launches (localStorage, instant boot read).
                The same preference is toggled in Vox's header. */}
            <SettingsCard title="Startup View" className={className}>
                <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">
                    Choose where the app opens. By default everyone lands on the full
                    workspace — flip on Vox if you want the record button
                    first on your phone.
                </p>
                <StartupViewPicker />
            </SettingsCard>

            {/* ─── Vox & Voice ─────────────────────────────────────────────
                Owner request 2026-11-19: the voice capture screen properly
                explained and considered in Settings. This card is the
                Settings-side map of every Vox / Quick Ask behaviour and where
                its controls live (the ⚙ menu in Vox itself, the Voice Tips
                panel, and the Startup View card above). */}
            <SettingsCard title="ALOA Vox & Voice" className={className}>
                <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">
                    ALOA ALOA Vox is the voice-first capture screen — dictate
                    anything and it becomes structured firm records (matters,
                    diary entries, endorsements, property notes, expenses,
                    drafts). Its controls live in ALOA Vox's own ⚙ menu;
                    this card explains what each one does.
                </p>
                <div className="space-y-4">
                    <div className="pt-2 border-t border-slate-200 dark:border-zinc-700">
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-1">Questions are read-only</h4>
                        <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                            Asking Quick Ask or dictating a question — "What's my schedule
                            today?", "Do I have anything tomorrow?", "Any hearings this
                            week?" — only looks things up and answers from your records.
                            Nothing is ever created or staged from a question: a date word
                            like "today" is never treated as an instruction. Entries are
                            created only from clear commands ("Remind me…", "Schedule…",
                            "Add a task…", "Log an expense…"), and when you combine a
                            question with a command, only the command part is acted on.
                            No setting to change — this is a guarantee.
                        </p>
                    </div>
                    <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-1">Quiet Mode</h4>
                        <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                            In ALOA Vox's ⚙ menu (and the header on desktop). Relaxes
                            noise suppression so faint, quiet speech in court galleries or
                            shared rooms is captured cleanly instead of being filtered out.
                            Saved per device.
                        </p>
                    </div>
                    <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-1">Smart Clean vs Verbatim</h4>
                        <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                            Every capture keeps two tiers: the Verbatim transcript (your
                            exact words, never edited) and the Smart Clean / formatted tier
                            (meta-speech stripped, professional wording, format matched to
                            the destination — diary entries get one-line action summaries,
                            case notes get paragraphs or bullets). Toggle the tier on the
                            capture card before saving.
                        </p>
                    </div>
                    <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-1">Snippets & Personal Dictionary</h4>
                        <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                            Managed in ALOA Vox's "?" Voice Tips panel (also in Help &
                            Support). Snippets expand a spoken trigger into full text
                            ("…and insert chambers signature"); the dictionary learns your
                            spelling corrections and feeds them to every future dictation.
                        </p>
                    </div>
                    <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-1">Start in ALOA Vox (mobile)</h4>
                        <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                            Covered by the Startup View card above — flip it on there, or
                            use the switch inside ALOA Vox's ⚙ menu on a phone. It
                            only affects mobile launches and is saved per device.
                        </p>
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
