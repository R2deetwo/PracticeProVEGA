import React, { useState } from 'react';
import { User } from '../../types';
import { getInitials, getUserColor } from '../../utils/colorUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { inputClassic } from '../../utils/formStyles';

interface NewChannelFormProps {
    users: User[];
    onCreateChannel: (channelName: string, memberIds: string[], creatorId: string) => Promise<string> | string;
    onClose: () => void;
}

const NewChannelForm: React.FC<NewChannelFormProps> = ({ users, onCreateChannel, onClose }) => {
    const { currentUser } = useAuth();
    const { navigateTo, addToast } = useUI();
    const [channelName, setChannelName] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

    const handleToggleUser = (userId: string) => {
        setSelectedUsers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) {
                newSet.delete(userId);
            } else {
                newSet.add(userId);
            }
            return newSet;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!channelName.trim()) {
            addToast('Please provide a channel name.', { type: 'info' });
            return;
        }
        if (!currentUser) return;

        // Include self
        const allMembers = Array.from(selectedUsers);
        if (!allMembers.includes(currentUser.id)) allMembers.push(currentUser.id);

        const newChannelId = await onCreateChannel(channelName.trim(), allMembers, currentUser.id);

        // Close modal then navigate
        onClose();
        setTimeout(() => {
            navigateTo('messaging', null, { activeConversationId: newChannelId });
        }, 100);
    };

    const commonInputClass = inputClassic;

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label htmlFor="channelName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Channel Name</label>
                <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">#</span>
                    <input autoComplete="off" data-lpignore="true" 
                        type="text"
                        id="channelName"
                        value={channelName}
                        onChange={e => setChannelName(e.target.value)}
                        className={`${commonInputClass} pl-7`}
                        placeholder="case-discussion"
                        required
                    />
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Add Members</label>
                <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md p-2 space-y-2">
                    {users.filter(u => u.id !== currentUser?.id).map(user => (
                        <label key={user.id} className="flex items-center space-x-3 cursor-pointer p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50">
                            <input autoComplete="off" data-lpignore="true" 
                                type="checkbox"
                                checked={selectedUsers.has(user.id)}
                                onChange={() => handleToggleUser(user.id)}
                                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <div className={`h-7 w-7 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-xs ${getUserColor(user.id)}`}>
                                {getInitials(user.name)}
                            </div>
                            <span className="text-sm">{user.name}</span>
                        </label>
                    ))}
                </div>
            </div>
            <div className="pt-4 flex justify-end space-x-2">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg font-semibold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold">Create Channel</button>
            </div>
        </form>
    );
};

export default NewChannelForm;
