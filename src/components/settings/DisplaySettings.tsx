
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
    <div id={id} className={`relative overflow-hidden bg-white dark:bg-zinc-900 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-md p-6 ${className || ''}`}>
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
                        <div className="relative">
                            <select
                                value={theme}
                                onChange={(e) => setTheme(e.target.value as Theme)}
                                className="block w-full pl-3 pr-10 py-2.5 text-base border-slate-300 dark:border-zinc-700 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-lg bg-white dark:bg-zinc-900 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 cursor-pointer shadow-sm"
                            >
                                <optgroup label="System">
                                    <option value="system">System Auto-Match</option>
                                </optgroup>
                                <optgroup label="Light Themes">
                                    <option value="light">Standard Light</option>
                                    <option value="city-lights">City Lights</option>
                                    <option value="sunlight-soft">Sunlight Soft</option>
                                    <option value="city-emerald">City Lights (Green Tint)</option>
                                    <option value="army-light">Army Green (Soft Light)</option>
                                </optgroup>
                                <optgroup label="Dark Themes">
                                    <option value="dark">Standard Dark</option>
                                    <option value="midnight">Midnight Royal</option>
                                    <option value="oled">OLED Black</option>
                                    <option value="neon-cyber">Neon Cyber</option>
                                    <option value="midnight-emerald">Midnight Royal (Green Tint)</option>
                                    <option value="army-dark">Army Green (Midnight variant)</option>
                                </optgroup>
                            </select>
                        </div>
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
                                    className={`w-full text-center px-4 py-2 rounded-md text-sm font-semibold transition-colors capitalize flex items-center justify-center gap-2 ${fontSize === size ? 'bg-white dark:bg-zinc-900 dark:bg-zinc-700 shadow text-slate-900 dark:text-white' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'}`}
                                >
                                    <span className="font-serif font-bold tracking-tighter opacity-70">Aa</span>
                                    {size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
                                </button>
                            ))}
                        </div>

                        <div className="pt-6 border-t border-slate-100 dark:border-zinc-800">
                            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-4">Typography Preview</label>
                            <div className="p-6 bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-900/50 rounded-xl border border-slate-100 dark:border-zinc-800 space-y-4">
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
