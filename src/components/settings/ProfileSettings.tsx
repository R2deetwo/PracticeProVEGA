
import React, { useState } from 'react';
import { User } from '../../types';
import { useProduct } from '../../contexts/ProductContext';
import { useCoreState } from '../../contexts/CoreContext';
import { ALL_PROFESSIONAL_TITLES } from '../../utils/professionalIdentity';
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

interface ProfileSettingsProps {
    currentUser: User;
    onUpdateUser: (data: Partial<User>) => void;
}

// PROFILE SETTINGS DEDUP (owner direction 2026-11-22): the Profile tab used
// to carry its own "General | Appearance" sub-tabs, and the Appearance
// sub-tab duplicated what the standalone Display settings tab already does
// (theme picker, font size, live flashes) — worse, the Display tab's theme
// picker is the richer one (swatches + accent colour). Per the owner's call
// we keep exactly ONE appearance home: the standalone Display tab. The
// sub-tab bar and the duplicate Appearance content are deleted; Profile is
// now a single, focused panel (identity + professional standards + in-app
// guidance). Theme/typography live ONLY in Settings → Display.
const ProfileSettings: React.FC<ProfileSettingsProps> = ({ currentUser, onUpdateUser }) => {
    const { isLegal } = useProduct();
    const { coreState } = useCoreState();
    const toast = useToastFeedback();
    const [userName, setUserName] = useState(currentUser.name);
    // PROFESSIONAL TITLE (user feedback 2026-09-12): "the person may
    // describe themselves in a limited number of ways and then other such
    // as Property Manager, Facilities Manager, Property Administrator" —
    // used in correspondence signatures and receipts.
    const [titleInput, setTitleInput] = useState(currentUser.professionalTitle || '');
    const [titleCustomInput, setTitleCustomInput] = useState(currentUser.titleCustom || '');

    // OWNER BRIEF 2026-11-25: the Professional Standards card is gated on the
    // firm-level "Compliance & Professional Standards Tracking" toggle
    // (Settings → Firm Details — OFF by default). When the firm turns it on,
    // members self-fill and maintain their own record; off, the card hides.
    const complianceTrackingEnabled = !!(coreState.firmDetails as any)?.complianceTrackingEnabled;

    // API Key State
    const [standards, setStandards] = useState(currentUser.professionalStandards || {
        lastPracticingFeePaidYear: new Date().getFullYear() - 1,
        nbaStampStatus: 'Pending' as 'Approved' | 'Pending',
        completedCpdHours: 0
    });

    // OWNER BRIEF 2026-11-25 (negative-number guard): CPD hours and the
    // practicing-fee year can NEVER go below their sensible floors — the
    // clamps catch manual typing AND arrow/scroll-wheel decrements.
    const MIN_CPD_HOURS = 0;
    const MIN_FEE_YEAR = 1990;
    const clampCpdHours = (raw: number): number =>
        Number.isFinite(raw) ? Math.max(MIN_CPD_HOURS, Math.min(raw, 1000)) : MIN_CPD_HOURS;
    const clampFeeYear = (raw: number): number =>
        Number.isFinite(raw) ? Math.max(MIN_FEE_YEAR, Math.min(raw, new Date().getFullYear() + 1)) : MIN_FEE_YEAR;

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

    return (
        <div className="space-y-6">
            <div className="space-y-8">
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
                            {ALL_PROFESSIONAL_TITLES.map(t => (
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

                {isLegal && (currentUser.role === 'Lawyer' || currentUser.role === 'Admin') && complianceTrackingEnabled && (
                    <SettingsCard title="Professional Standards" id="professional-standards">
                        {/* The firm's Compliance & Professional Standards toggle
                            gates this card (owner brief 2026-11-25). Members
                            self-fill; admins and teammates see the record via
                            Settings → Firm Details → View team standards. */}
                        <div className="space-y-4">
                            <Input
                                styleVariant="settings"
                                autoComplete="off"
                                data-lpignore="true"
                                type="number"
                                id="practicingFee"
                                label="Last Practicing Fee Paid (Year)"
                                min={MIN_FEE_YEAR}
                                max={new Date().getFullYear() + 1}
                                value={standards.lastPracticingFeePaidYear}
                                onChange={(e) => setStandards(s => ({ ...s, lastPracticingFeePaidYear: clampFeeYear(parseInt(e.target.value, 10)) }))}
                            />
                            <Select
                                styleVariant="settings"
                                id="nbaStampStatus"
                                label="NBA Status"
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
                                min={MIN_CPD_HOURS}
                                value={standards.completedCpdHours}
                                onChange={(e) => setStandards(s => ({ ...s, completedCpdHours: clampCpdHours(parseInt(e.target.value, 10)) }))}
                                hint="Hours cannot be negative — the floor is 0."
                            />
                            {/* Stamp & Seal slot (owner brief 2026-11-25): a
                                reserved status record for the physical NBA
                                stamp/seal — the artifact itself is never
                                stored here. */}
                            <Select
                                styleVariant="settings"
                                id="stampAndSeal"
                                label="Stamp & Seal"
                                value={standards.stampAndSealStatus || 'not_submitted'}
                                onChange={(e) => setStandards(s => ({ ...s, stampAndSealStatus: e.target.value as 'not_submitted' | 'submitted' | 'verified' }))}
                                hint="Reserved slot for your NBA Stamp & Seal record — status only, the seal artifact is held by you."
                            >
                                <option value="not_submitted">Not submitted</option>
                                <option value="submitted">Submitted</option>
                                <option value="verified">Verified</option>
                            </Select>
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
                        {/* Pointer to the single appearance home (owner
                            direction 2026-11-22): theme, font size and live
                            flashes now live ONLY in the Display tab — this
                            card no longer duplicates them. */}
                        <div className={`pt-4 border-t ${BORDER_STANDARD}`}>
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-800 dark:text-white">Theme, Font & Display</p>
                                    <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">Themes, font size, accent colour, startup view, haptics and sounds live in the Display tab.</p>
                                </div>
                                <span className="text-2xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-widest flex-shrink-0">Display tab →</span>
                            </div>
                        </div>
                    </div>
                </SettingsCard>
            </div>
            <FeedbackButton />
        </div>
    );
};

export default ProfileSettings;
