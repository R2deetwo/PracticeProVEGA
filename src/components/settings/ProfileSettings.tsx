
import React, { useState } from 'react';
import { User, NotificationSettings, Theme, FontSize } from '../../types';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { useDataActions } from '../../contexts/DataContext';
import { DesktopComputerIcon, UserCircleIcon } from '../../constants';
import { useProduct } from '../../contexts/ProductContext';
import { PROFESSIONAL_TITLES } from '../../utils/professionalIdentity';
import FeedbackButton from '../FeedbackButton';
// ui/ primitives (ADR-0004) — Task 61 reference migration. Every adopted
// element is a zero-visual-change refactor; equivalence is proven by
// tests/unit/uiPrimitives.test.ts (superset checks) — see
// docs/worklog/worklog-2026-09.md "Task 61" for the migration recipe.
import { Button, Input, Select, useToastFeedback } from '../ui';
import { CARD_ELEVATED, BORDER_STANDARD } from '../../utils/designTokens';

// SettingsCard — structural classes from designTokens. CARD_ELEVATED is the
// measured elevated-card family (rounded-lg shadow-md, 49 occ / 21 files);
// kept as a full token because a composed CARD_BASE + shadow-md override
// would LOSE under Tailwind v3's lexicographic emission order
// (shadow-md sorts before shadow-sm).
const SettingsCard: React.FC<{ title: string; children: React.ReactNode; id?: string, className?: string }> = ({ title, children, id, className }) => (
    <div id={id} className={`relative overflow-hidden ${CARD_ELEVATED} p-6 ${className || ''}`}>
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
    const { fontSize, setFontSize } = useUI();
    const { updateCurrentUser } = useAuth();
    const { isLegal, isProperty } = useProduct();
    const toast = useToastFeedback();
    const [userName, setUserName] = useState(currentUser.name);
    // PROFESSIONAL TITLE (user feedback 2026-09-12): "the person may
    // describe themselves in a limited number of ways and then other such
    // as Property Manager, Facilities Manager, Property Administrator" —
    // used in correspondence signatures and receipts.
    const [titleInput, setTitleInput] = useState(currentUser.professionalTitle || '');
    const [titleCustomInput, setTitleCustomInput] = useState(currentUser.titleCustom || '');
    const [activeSubTab, setActiveSubTab] = useState<'general' | 'appearance'>(initialSubTab || 'general');

    // API Key State
    const [standards, setStandards] = useState(currentUser.professionalStandards || {
        lastPracticingFeePaidYear: new Date().getFullYear() - 1,
        nbaStampStatus: 'Pending' as 'Approved' | 'Pending',
        completedCpdHours: 0
    });

    const handleProfileUpdate = () => {
        const titleChanged =
            titleInput !== (currentUser.professionalTitle || '') ||
            titleCustomInput !== (currentUser.titleCustom || '');
        if (userName.trim() === currentUser.name && !titleChanged) {
            toast.info('No changes to save.');
            return;
        }
        onUpdateUser({
            ...(userName.trim() !== currentUser.name ? { name: userName.trim() } : {}),
            professionalTitle: titleInput || undefined,
            ...(titleInput === 'Other' ? { titleCustom: titleCustomInput } : { titleCustom: undefined }),
        });
        toast.success('Profile updated successfully!');
    };

    const handleStandardsUpdate = () => {
        onUpdateUser({ professionalStandards: standards });
        toast.success('Professional standards updated successfully!');
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

    return (
        <div className="space-y-6">
            <div className={`flex gap-4 border-b ${BORDER_STANDARD}`}>
                <Button
                    onClick={() => setActiveSubTab('general')}
                    variant={activeSubTab === 'general' ? 'tab-active' : 'tab'}
                    size="tab"
                    icon={UserCircleIcon}
                >
                    General
                </Button>
                <Button
                    onClick={() => setActiveSubTab('appearance')}
                    variant={activeSubTab === 'appearance' ? 'tab-active' : 'tab'}
                    size="tab"
                    icon={DesktopComputerIcon}
                >
                    Appearance
                </Button>
            </div>

            {activeSubTab === 'general' ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <SettingsCard title="My Profile" id="my-profile">
                        <div className="space-y-4">
                            <Input
                                styleVariant="settings"
                                autoComplete="off"
                                data-lpignore="true"
                                type="text"
                                id="userName"
                                label="Name"
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                            />

                            <Input
                                styleVariant="settings"
                                autoComplete="off"
                                data-lpignore="true"
                                type="email"
                                id="userEmail"
                                label="Email (Login ID)"
                                value={currentUser.email}
                                readOnly
                                disabled
                                inputClassName="cursor-not-allowed bg-slate-100 dark:bg-zinc-800"
                                hint="Your email is used for logging in and cannot be changed."
                            />

                            {/* Professional title — how you appear in correspondence.
                                NOTE: the hint stays a sibling AFTER the conditional
                                custom-title input (original order — putting it on the
                                Select would move it above that input when "Other"
                                is chosen, a visual change). */}
                            <Select
                                styleVariant="settings"
                                id="professionalTitle"
                                label="Professional Title"
                                value={titleInput}
                                onChange={(e) => setTitleInput(e.target.value)}
                            >
                                <option value="">Not specified</option>
                                {PROFESSIONAL_TITLES.map(t => (
                                    <option key={t} value={t}>{t === 'Other' ? 'Other (describe it)' : t}</option>
                                ))}
                            </Select>
                            {titleInput === 'Other' && (
                                <Input
                                    styleVariant="settings"
                                    autoComplete="off"
                                    data-lpignore="true"
                                    type="text"
                                    value={titleCustomInput}
                                    onChange={(e) => setTitleCustomInput(e.target.value)}
                                    placeholder="e.g. Head of Estate Operations"
                                />
                            )}
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Appears in your email signatures and on receipts you issue.</p>
                            {/* Profile update button — explicit primary styling.
                                Was: bg-slate-900 dark:bg-white dark:bg-zinc-900 (conflicting
                                dark classes made it invisible in dark mode — dark bg + dark text).
                                Now: emerald CTA (Button variant="success", always green,
                                always white text, visible in both light and dark mode).
                                py-2.5 override keeps the original 40px height (wins over
                                size md's py-2 by Tailwind scale order). */}
                            <Button variant="success" size="md" className="w-full py-2.5" onClick={handleProfileUpdate}>
                                Update Profile
                            </Button>
                        </div>
                    </SettingsCard>

                    {isLegal && (currentUser.role === 'Lawyer' || currentUser.role === 'Admin') && (
                        <SettingsCard title="Professional Standards" id="professional-standards">
                            <div className="space-y-4">
                                <Input
                                    styleVariant="settings"
                                    autoComplete="off"
                                    data-lpignore="true"
                                    type="number"
                                    id="practicingFee"
                                    label="Last Practicing Fee Paid (Year)"
                                    value={standards.lastPracticingFeePaidYear}
                                    onChange={(e) => setStandards(s => ({ ...s, lastPracticingFeePaidYear: parseInt(e.target.value, 10) || new Date().getFullYear() - 1 }))}
                                />
                                <Select
                                    styleVariant="settings"
                                    id="nbaStampStatus"
                                    label="NBA Stamp Status"
                                    value={standards.nbaStampStatus}
                                    onChange={(e) => setStandards(s => ({ ...s, nbaStampStatus: e.target.value as 'Approved' | 'Pending' }))}
                                >
                                    <option>Pending</option>
                                    <option>Approved</option>
                                </Select>
                                <Input
                                    styleVariant="settings"
                                    autoComplete="off"
                                    data-lpignore="true"
                                    type="number"
                                    id="cpdHours"
                                    label="Completed CPD Hours (Current Year)"
                                    value={standards.completedCpdHours}
                                    onChange={(e) => setStandards(s => ({ ...s, completedCpdHours: parseInt(e.target.value, 10) || 0 }))}
                                />
                                {/* Dark inverse CTA — variant="bare" with the VERBATIM
                                    original class string. Why bare: the original declares
                                    no text-size (renders at the inherited 16px), and a
                                    text-base override on size md LOSES to text-sm under
                                    Tailwind v3's lexicographic emission order — so the
                                    primitive's size system cannot express this button
                                    without a visual change. bare keeps pixel-exact classes
                                    and adds only semantics (type default, focus ring,
                                    disabled/loading handling). The conflicting dark:bg-white
                                    / dark:bg-zinc-900 pair is preserved verbatim — it
                                    renders zinc-900 ("z" > "w") with near-invisible
                                    dark:text-slate-900 text in dark mode; that is a
                                    PRE-EXISTING bug, not one introduced here. Fix it in a
                                    deliberate follow-up, not in a zero-change refactor. */}
                                <Button
                                    variant="bare"
                                    className="w-full px-4 py-2 bg-slate-900 dark:bg-white dark:bg-zinc-900 text-white dark:text-slate-900 rounded-lg font-semibold hover:opacity-90 transition-all"
                                    onClick={handleStandardsUpdate}
                                >
                                    Update Standards
                                </Button>
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
                                {/* One-off legacy select style (Tailwind-UI form select,
                                    1 occurrence in the codebase) — kept verbatim via
                                    styleVariant="bare" + selectClassName; the primitive
                                    still provides id/label/aria wiring. mb-3 preserves the
                                    original 12px label gap (wins over the default mb-1). */}
                                <Select
                                    styleVariant="bare"
                                    label="Theme System Preference"
                                    labelClassName="mb-3"
                                    value={theme}
                                    onChange={(e) => setTheme(e.target.value as Theme)}
                                    selectClassName="block w-full pl-3 pr-10 py-2.5 text-base border-slate-300 dark:border-zinc-700 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 cursor-pointer shadow-sm"
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
                                </Select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">Font Size</label>
                                <div className="flex p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 overflow-x-auto custom-scrollbar">
                                    {(['sm', 'md', 'lg'] as FontSize[]).map(size => (
                                        <Button
                                            key={size}
                                            onClick={() => setFontSize(size)}
                                            variant={fontSize === size ? 'segmented-active' : 'segmented'}
                                            size="md"
                                            className="w-full flex-shrink-0 flex-1 min-w-[100px] text-center"
                                        >
                                            <span className="font-serif font-bold tracking-tight opacity-70">Aa</span>
                                            {size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                            <div className={`pt-4 border-t ${BORDER_STANDARD}`}>
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
