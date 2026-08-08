import React, { useState } from 'react';
import { UserIcon, MailIcon, GavelIconLarge, InfoIcon, XIcon, SaveIcon, SendIcon, BriefcaseIcon, LockClosedIcon } from '../../constants';
import { inputClassic } from '../../utils/formStyles';
import { ExternalCounselInvite, AccessLevel } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useFeatures } from '../../hooks/useFeatures';

interface ExternalCounselInviteFormProps {
    matterId: string;
    onInvite: (invite: Omit<ExternalCounselInvite, 'id'>) => void;
    onClose: () => void;
}

const ExternalCounselInviteForm: React.FC<ExternalCounselInviteFormProps> = ({ matterId, onInvite, onClose }) => {
    const { currentUser } = useAuth();
    const { coreState, isDataLoaded } = useCoreState();
    const { addToast, navigateTo } = useUI();
    const { canUseExternalCounsel } = useFeatures();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [firmName, setFirmName] = useState('');
    const [roleInMatter, setRoleInMatter] = useState('');
    const [accessLevel, setAccessLevel] = useState<AccessLevel>('Standard');
    const [duration, setDuration] = useState('30'); // in days

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !firmName || !roleInMatter) {
            addToast('Please fill all required fields.', { type: 'error' });
            return;
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(duration, 10));

        const invite: Omit<ExternalCounselInvite, 'id'> = {
            firmId: coreState.firmDetails.id,
            matterId,
            email,
            name,
            firmName,
            roleInMatter,
            accessLevel,
            expiresAt: expiresAt.toISOString(),
            status: 'pending',
            invitedBy: currentUser!.id,
        };
        await onInvite(invite);
        addToast(`Invite sent to ${invite.email}`, { type: 'success' });
        onClose();
    };

    const commonInputClass = inputClassic;

    return (
        !canUseExternalCounsel ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-14 h-14 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mb-4">
                    <LockClosedIcon className="w-7 h-7 text-rose-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Enterprise Feature</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm mb-4">
                    Inviting external counsel is available on the Enterprise plan. Upgrade to collaborate with external legal professionals.
                </p>
                <button
                    onClick={() => navigateTo('settings', null, { settingsTargetId: 'subscription-management' })}
                    className="px-4 py-2 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition-colors text-sm"
                >
                    Upgrade to Enterprise
                </button>
            </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-zinc-400">
                You are inviting an external legal professional to collaborate on this matter. They will only have access to the information you specify.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="ec_name" className="block text-sm font-medium">Full Name*</label>
                    <input autoComplete="off" data-lpignore="true"  type="text" id="ec_name" value={name} onChange={e => setName(e.target.value)} className={commonInputClass} required />
                </div>
                <div>
                    <label htmlFor="ec_email" className="block text-sm font-medium">Email Address*</label>
                    <input autoComplete="off" data-lpignore="true"  type="email" id="ec_email" value={email} onChange={e => setEmail(e.target.value)} className={commonInputClass} required />
                </div>
            </div>
             <div>
                <label htmlFor="ec_firm" className="block text-sm font-medium">Law Firm Name*</label>
                <input autoComplete="off" data-lpignore="true"  type="text" id="ec_firm" value={firmName} onChange={e => setFirmName(e.target.value)} className={commonInputClass} required />
            </div>
            <div>
                <label htmlFor="ec_role" className="block text-sm font-medium">Role in Matter*</label>
                <input autoComplete="off" data-lpignore="true"  type="text" id="ec_role" value={roleInMatter} onChange={e => setRoleInMatter(e.target.value)} className={commonInputClass} placeholder="e.g., Co-Counsel, Watching Brief" required />
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="ec_level" className="block text-sm font-medium">Access Level*</label>
                    <select id="ec_level" value={accessLevel} onChange={e => setAccessLevel(e.target.value as AccessLevel)} className={commonInputClass}>
                        <option>Standard</option>
                        <option>Limited</option>
                        <option>DocumentOnly</option>
                    </select>
                </div>
                 <div>
                    <label htmlFor="ec_duration" className="block text-sm font-medium">Access Duration*</label>
                    <select id="ec_duration" value={duration} onChange={e => setDuration(e.target.value)} className={commonInputClass}>
                        <option value="30">30 Days</option>
                        <option value="60">60 Days</option>
                        <option value="90">90 Days</option>
                        <option value="180">6 Months</option>
                    </select>
                </div>
            </div>
             <div className="pt-4 flex justify-end gap-2">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-zinc-600 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-zinc-700 dark:hover:bg-zinc-500">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700">Send Invitation</button>
            </div>
        </form>
        )
    );
};

export default ExternalCounselInviteForm;
