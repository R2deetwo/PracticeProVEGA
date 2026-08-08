
import React, { useState, useEffect } from 'react';
import { User, NotificationSettings, Theme, FontSize } from '../../types';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { LockClosedIcon, ZapIcon, TrashIcon, UserCircleIcon, DesktopComputerIcon } from '../../constants';
import { useProduct } from '../../contexts/ProductContext';
import FeedbackButton from '../FeedbackButton';

const SettingsCard: React.FC<{ title: string; children: React.ReactNode; id?: string, className?: string }> = ({ title, children, id, className }) => (
    <div id={id} className={`relative overflow-hidden bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-md p-6 ${className || ''}`}>
        <div className="relative z-10">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{title}</h3>
            {children}
        </div>
    </div>
);

const NotificationToggle: React.FC<{
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

interface ProfileSettingsProps {
    currentUser: User;
    onUpdateUser: (data: Partial<User>) => void;
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

const ProfileSettings: React.FC<ProfileSettingsProps & { initialSubTab?: 'general' | 'appearance' }> = ({ currentUser, onUpdateUser, theme, setTheme, initialSubTab }) => {
    const { addToast, fontSize, setFontSize } = useUI();
    const { updateCurrentUser } = useAuth();
    const { isLegal, isProperty } = useProduct();
    const [userName, setUserName] = useState(currentUser.name);
    const [activeSubTab, setActiveSubTab] = useState<'general' | 'appearance'>(initialSubTab || 'general');

    // API Key State
    const [standards, setStandards] = useState(currentUser.professionalStandards || {
        lastPracticingFeePaidYear: new Date().getFullYear() - 1,
        nbaStampStatus: 'Pending' as 'Approved' | 'Pending',
        completedCpdHours: 0
    });

    const handleProfileUpdate = () => {
        if (userName.trim() === currentUser.name) {
            addToast('No changes to save.', { type: 'info' });
            return;
        }
        onUpdateUser({ name: userName.trim() });
        addToast('Profile updated successfully!', { type: 'success' });
    };

    const handleStandardsUpdate = () => {
        onUpdateUser({ professionalStandards: standards });
        addToast('Professional standards updated successfully!', { type: 'success' });
    };

    const handleToggleNotification = (setting: keyof NotificationSettings) => {
        const currentSettings = currentUser.notificationSettings || {};
        onUpdateUser({
            notificationSettings: {
                ...currentSettings,
                [setting]: currentSettings[setting] === false ? true : false,
            }
        });
    };

    const handleToggleFlashes = () => {
        if (!currentUser) return;
        const newVal = !(currentUser.enableLiveFlashes ?? true);
        updateCurrentUser({ enableLiveFlashes: newVal });
    };

    const commonInputClass = "mt-1 text-slate-900 dark:text-zinc-300 w-full bg-slate-50 dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md p-2";

    return (
        <div className="space-y-6">
            <div className="flex gap-4 border-b border-slate-200 dark:border-zinc-700">
                <button
                    onClick={() => setActiveSubTab('general')}
                    className={`flex-shrink-0 pb-3 px-1 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeSubTab === 'general' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'}`}
                >
                    <UserCircleIcon className="w-4 h-4" /> General
                </button>
                <button
                    onClick={() => setActiveSubTab('appearance')}
                    className={`flex-shrink-0 pb-3 px-1 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeSubTab === 'appearance' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'}`}
                >
                    <DesktopComputerIcon className="w-4 h-4" /> Appearance
                </button>
            </div>

            {activeSubTab === 'general' ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <SettingsCard title="My Profile" id="my-profile">
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="userName" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Name</label>
                                <input autoComplete="off" data-lpignore="true"  type="text" id="userName" value={userName} onChange={(e) => setUserName(e.target.value)} className={commonInputClass} />
                            </div>

                            <div>
                                <label htmlFor="userEmail" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Email (Login ID)</label>
                                <input autoComplete="off" data-lpignore="true"  type="email" id="userEmail" value={currentUser.email} readOnly disabled className={`${commonInputClass} cursor-not-allowed bg-slate-100 dark:bg-zinc-800`} />
                                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Your email is used for logging in and cannot be changed.</p>
                            </div>
                            <button onClick={handleProfileUpdate} className="w-full px-4 py-2 bg-slate-900 dark:bg-white dark:bg-zinc-900 text-white dark:text-slate-900 rounded-lg font-semibold hover:opacity-90 transition-all">
                                Update Profile
                            </button>
                        </div>
                    </SettingsCard>

                    {isLegal && (currentUser.role === 'Lawyer' || currentUser.role === 'Admin') && (
                        <SettingsCard title="Professional Standards" id="professional-standards">
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="practicingFee" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Last Practicing Fee Paid (Year)</label>
                                    <input autoComplete="off" data-lpignore="true" 
                                        type="number"
                                        id="practicingFee"
                                        value={standards.lastPracticingFeePaidYear}
                                        onChange={(e) => setStandards(s => ({ ...s, lastPracticingFeePaidYear: parseInt(e.target.value, 10) || new Date().getFullYear() - 1 }))}
                                        className={commonInputClass}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="nbaStampStatus" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">NBA Stamp Status</label>
                                    <select
                                        id="nbaStampStatus"
                                        value={standards.nbaStampStatus}
                                        onChange={(e) => setStandards(s => ({ ...s, nbaStampStatus: e.target.value as 'Approved' | 'Pending' }))}
                                        className={commonInputClass}
                                    >
                                        <option>Pending</option>
                                        <option>Approved</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="cpdHours" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Completed CPD Hours (Current Year)</label>
                                    <input autoComplete="off" data-lpignore="true" 
                                        type="number"
                                        id="cpdHours"
                                        value={standards.completedCpdHours}
                                        onChange={(e) => setStandards(s => ({ ...s, completedCpdHours: parseInt(e.target.value, 10) || 0 }))}
                                        className={commonInputClass}
                                    />
                                </div>
                                <button onClick={handleStandardsUpdate} className="w-full px-4 py-2 bg-slate-900 dark:bg-white dark:bg-zinc-900 text-white dark:text-slate-900 rounded-lg font-semibold hover:opacity-90 transition-all">
                                    Update Standards
                                </button>
                            </div>
                        </SettingsCard>
                    )}

                    <SettingsCard title="In-App Guidance">
                        <div className="space-y-4">
                            <NotificationToggle
                                label="Show Pro-Tips & Guidance"
                                description="Enable or disable contextual tips and RPC guidance throughout the app."
                                isChecked={currentUser.showProTips}
                                onToggle={() => onUpdateUser({ showProTips: !currentUser.showProTips })}
                            />
                            <NotificationToggle
                                label="AI Matter Suggestions"
                                description="Show proactive AI suggestions on your dashboard, matters, and ALOA panel (stalled matters, overdue tasks, deadline alerts)."
                                isChecked={(currentUser as any).showAiSuggestions !== false}
                                onToggle={() => onUpdateUser({ showAiSuggestions: !(currentUser as any).showAiSuggestions } as any)}
                            />
                        </div>
                    </SettingsCard>
                </div>
            ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <SettingsCard title="Theme & Visuals" id="display-settings">
                        {/* Also add theme-preference ID so long-press theme toggle
                            can scroll to this section. */}
                        <div id="theme-preference" />
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-3">Theme System Preference</label>
                                <select
                                    value={theme}
                                    onChange={(e) => setTheme(e.target.value as Theme)}
                                    className="block w-full pl-3 pr-10 py-2.5 text-base border-slate-300 dark:border-zinc-700 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 cursor-pointer shadow-sm"
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
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">Font Size</label>
                                <div className="flex p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 overflow-x-auto custom-scrollbar">
                                    {(['sm', 'md', 'lg'] as FontSize[]).map(size => (
                                        <button
                                            key={size}
                                            onClick={() => setFontSize(size)}
                                            className={`w-full flex-shrink-0 flex-1 min-w-[100px] text-center px-4 py-2 rounded-md text-sm font-bold transition-all capitalize flex items-center justify-center gap-2 ${fontSize === size ? 'bg-white dark:bg-zinc-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'}`}
                                        >
                                            <span className="font-serif font-bold tracking-tight opacity-70">Aa</span>
                                            {size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
                                <Toggle
                                    label="Live Update Flashes"
                                    description="Visually flash interface elements when data updates in real-time."
                                    isChecked={currentUser?.enableLiveFlashes ?? true}
                                    onToggle={handleToggleFlashes}
                                />
                            </div>
                        </div>
                    </SettingsCard>
                </div>
            )}
            {activeSubTab === 'general' && <FeedbackButton />}
        </div>
    );
};

export default ProfileSettings;
