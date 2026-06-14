
import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { AppState } from '../types';

/**
 * Hook for managing internal chat and client messaging.
 */
export const useMessaging = (appState: AppState, actions: any) => {
    const { currentUser } = useAuth();
    const { addToast } = useUI();

    const handleSendMessage = useCallback(async (conversationId: string, content: string, senderId: string, overrideMembers?: string[]) => {
        await actions.addItem('chatMessages', { 
            conversationId, 
            content, 
            authorId: senderId, 
            timestamp: new Date().toISOString() 
        }, 'Chat Message');

        let membersToNotify = overrideMembers;
        if (!membersToNotify) {
            const conv = appState.chatConversations.find(c => c.id === conversationId);
            if (conv && conv.memberIds) membersToNotify = conv.memberIds;
        }

        if (membersToNotify && membersToNotify.length > 0) {
            const senderName = currentUser?.name || 'A colleague';
            const notificationPromises = membersToNotify.map(memberId => {
                if (memberId === senderId) return Promise.resolve();
                return actions.addItem('notifications', {
                    userId: memberId,
                    title: 'New Message',
                    message: `${senderName} sent a message.`,
                    type: 'message',
                    isRead: false,
                    createdAt: new Date().toISOString(),
                    link: { view: 'messaging', id: conversationId, context: { activeConversationId: conversationId } },
                    firmId: currentUser?.firmId,
                }, 'Notification');
            });
            await Promise.all(notificationPromises);
        }
    }, [appState.chatConversations, currentUser, actions]);

    const handleCreateDirectMessage = useCallback(async (recipientId: string, firstMessage?: string, currentUserId?: string, matterId?: string) => {
        const cid = uuidv4();
        await actions.addItem('chatConversations', {
            id: cid,
            type: 'direct',
            memberIds: [currentUserId || currentUser?.id || '', recipientId],
            name: 'Direct Message',
            matterId: matterId || null,
            createdAt: new Date().toISOString(),
            hiddenForUserIds: []
        }, 'Conversation');
        if (firstMessage) {
            await handleSendMessage(cid, firstMessage, currentUserId || currentUser?.id || '');
        }
        return cid;
    }, [currentUser, actions, handleSendMessage]);

    const handleCreateChannel = useCallback(async (name: string, memberIds: string[], creatorId: string, matterId?: string) => {
        const cid = uuidv4();
        await actions.addItem('chatConversations', {
            id: cid,
            type: 'channel',
            name,
            memberIds,
            creatorId,
            matterId: matterId || null,
            createdAt: new Date().toISOString(),
            hiddenForUserIds: []
        }, 'Channel');
        return cid;
    }, [actions]);

    const handleDeleteChat = useCallback(async (conversationId: string, deleteForEveryone: boolean, userId: string) => {
        await actions.deleteItem('chatConversations', conversationId, 'Conversation');
    }, [actions]);

    const handleDeleteMessage = useCallback(async (messageId: string, deleteForEveryone: boolean, userId: string) => {
        await actions.deleteItem('chatMessages', messageId, 'Message');
    }, [actions]);

    const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
        await actions.updateItem('chatMessages', { id: messageId, content: newContent }, 'Message');
    }, [actions]);

    const retryMessage = useCallback(async (messageId: string, isClientMessage: boolean) => {
        // Find the original message and re-send it
        const sourceArray = isClientMessage ? appState.clientMessages : appState.chatMessages;
        const original = sourceArray.find((m: any) => m.id === messageId);
        if (!original) {
            addToast("Original message not found. Please send a new message.", { type: 'error' });
            return;
        }
        try {
            if (isClientMessage) {
                await actions.addItem('clientMessages', {
                    matterId: original.matterId,
                    content: original.content,
                    timestamp: new Date().toISOString(),
                }, 'Client Message');
            } else {
                await handleSendMessage(original.conversationId, original.content, original.authorId);
            }
            // Remove the old failed message
            await actions.deleteItem(isClientMessage ? 'clientMessages' : 'chatMessages', messageId, 'Message');
            addToast("Message re-sent successfully.", { type: 'success' });
        } catch (e) {
            console.error('[retryMessage] Failed:', e);
            addToast("Failed to retry message. Please send a new message.", { type: 'error' });
        }
    }, [appState.clientMessages, appState.chatMessages, actions, handleSendMessage, addToast]);

    return {
        handleSendMessage,
        handleCreateDirectMessage,
        handleCreateChannel,
        handleDeleteChat,
        handleDeleteMessage,
        handleEditMessage,
        retryMessage,
        handleSendClientMessage: (matterId: string, content: string) => 
            actions.addItem('clientMessages', { matterId, content, timestamp: new Date().toISOString() }, 'Client Message'),
    };
};
