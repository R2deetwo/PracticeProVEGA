
import React, { useState, useMemo } from 'react';
import { Document, Matter, User, UserRole } from '../../types';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { PaperClipIcon, ShieldCheckIcon, UserCircleIcon } from '../../constants';
import { getInitials, getUserColor } from '../../utils/colorUtils';

interface ShareDocumentModalProps {
    document: Document;
    matter: Matter | undefined;
    onClose: () => void;
}

export const ShareDocumentModal: React.FC<ShareDocumentModalProps> = ({ document, matter, onClose }) => {
    const { handleSendMessage, handleCreateDirectMessage } = useDataActions();
    const { coreState, isDataLoaded } = useCoreState();
    const { currentUser } = useAuth();
    const { addToast } = useUI();

    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
    const [message, setMessage] = useState(`Sharing document: ${document.title}`);
    const [isSharing, setIsSharing] = useState(false);

    // Filter out current user and clients
    const internalUsers = useMemo(() =>
        coreState.users.filter(u => u.id !== currentUser?.id && u.role !== UserRole.Client && u.role !== UserRole.Tenant && u.role !== UserRole.ExternalCounsel),
        [coreState.users, currentUser]);

    // Check for potential permission issues (e.g. sharing with a Paralegal not assigned to this matter)
    const permissionWarning = useMemo(() => {
        if (!matter) return null;

        const selectedUsersList = internalUsers.filter(u => selectedUserIds.has(u.id));
        const riskyUsers = selectedUsersList.filter(u =>
            u.role === UserRole.Paralegal && !matter.assignedUsers.includes(u.id)
        );

        if (riskyUsers.length > 0) {
            const names = riskyUsers.map(u => u.name).join(', ');
            return `Warning: ${names} ${riskyUsers.length === 1 ? 'does' : 'do'} not have explicit access to this matter. They may need Admin approval to view the file.`;
        }
        return null;
    }, [selectedUserIds, internalUsers, matter]);

    const handleToggleUser = (userId: string) => {
        setSelectedUserIds(prev => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    };

    const handleShare = async () => {
        if (isSharing) return; // P1 FIX: prevent double-share
        if (selectedUserIds.size === 0) {
            addToast("Please select at least one colleague.", { type: 'info' });
            return;
        }

        if (!currentUser) return;

        const linkText = `\n\n[FILE: ${document.title}](${document.id})`;

        setIsSharing(true);
        try {
            const sharePromises = Array.from(selectedUserIds).map(async recipientId => {
                const chatId = await handleCreateDirectMessage(recipientId, undefined, currentUser.id, undefined, false);
                handleSendMessage(chatId, message + linkText, currentUser.id);
            });
            await Promise.all(sharePromises);
            onClose();
        } catch (err: any) {
            addToast(`Failed to share: ${err.message}`, { type: 'error' });
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-zinc-700/50 rounded-lg border border-slate-200 dark:border-zinc-600">
                <div className="p-2 bg-white dark:bg-zinc-600 rounded shadow-sm">
                    <PaperClipIcon className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-sm">{document.title}</h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                        {matter ? `Matter: ${matter.title}` : 'General Document'}
                    </p>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Select Colleagues</label>
                <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-zinc-700 rounded-lg p-1">
                    {internalUsers.map(user => (
                        <div
                            key={user.id}
                            onClick={() => handleToggleUser(user.id)}
                            className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${selectedUserIds.has(user.id) ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                        >
                            <input autoComplete="off" data-lpignore="true" 
                                type="checkbox"
                                checked={selectedUserIds.has(user.id)}
                                readOnly
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 pointer-events-none"
                            />
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${getUserColor(user.name)}`}>
                                {getInitials(user.name)}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">{user.name}</p>
                                <p className="text-xs text-slate-500">{user.role}</p>
                            </div>
                        </div>
                    ))}
                    {internalUsers.length === 0 && <p className="p-4 text-center text-sm text-slate-400">No other team members found.</p>}
                </div>
            </div>

            {permissionWarning && (
                <div className="flex gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 text-yellow-800 dark:text-yellow-200 text-xs rounded-r">
                    <ShieldCheckIcon className="w-5 h-5 flex-shrink-0" />
                    <p>{permissionWarning}</p>
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Message (Optional)</label>
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full p-3 text-sm bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                    rows={2}
                />
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-600 transition-colors">
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleShare}
                    disabled={isSharing}
                    className="px-4 py-2 text-sm font-bold text-white bg-primary-600 rounded-lg hover:bg-primary-700 shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                    {isSharing ? 'Sharing…' : 'Share'}
                </button>
            </div>
        </div>
    );
};
