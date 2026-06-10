import React, { useState } from 'react';
import { UserIcon, MailIcon, GavelIconLarge, InfoIcon, XIcon, SaveIcon, SendIcon, BriefcaseIcon } from '../../constants';
import { inputClassic } from '../../utils/formStyles';
import { ExternalCounselInvite, AccessLevel } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';

interface ExternalCounselInviteFormProps {
    matterId: string;
    onInvite: (invite: Omit<ExternalCounselInvite, 'id'>) => void;
    onClose: () => void;
}

const ExternalCounselInviteForm: React.FC<ExternalCounselInviteFormProps> = ({ matterId, onInvite, onClose }) => {
    const { currentUser } = useAuth();
    const { coreState, isDataLoaded } = useCoreState();
    const { addToast } = useUI();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [firmName, setFirmName] = useState('');
    const [roleInMatter, setRoleInMatter] = useState('');
    const [accessLevel, setAccessLevel] = useState<AccessLevel>('Standard');
    const [duration, setDuration] = useState('30'); // in days

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !firmName || !roleInMatter) {
            alert('Please fill all required fields.');
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
        onInvite(invite);
        addToast(`Invite sent to ${invite.email}`, { type: 'success' });
        onClose();
    };

    const commonInputClass = inputClassic;

    return (
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
                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-zinc-600 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-zinc-500">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700">Send Invitation</button>
            </div>
        </form>
    );
};

export default ExternalCounselInviteForm;
