
import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { AppState } from '../types';

/**
 * Hook for managing internal chat and client messaging.
 *
 * Team chat messages go through the server-side `sendChatMessage` mutation
 * which atomically creates the message AND notifications for all other
 * conversation members. This replaces the old client-side dual-call pattern
 * (addItem('chatMessages') + addItem('notifications')) which silently
 * dropped notifications if the second call failed.
 *
 * Note: This is NOT a webhook. Webhooks are for cross-system events
 * (e.g. Paystack → PracticePro). Internal chat notifications are a
 * server-side mutation called directly by the sender's client.
 */
export const useMessaging = (appState: AppState, actions: any) => {
    const { currentUser } = useAuth();
    const { addToast } = useUI();
    const sendChatMessageMutation = useMutation(api.myFunctions.sendChatMessage);

    const handleSendMessage = useCallback(async (conversationId: string, content: string, senderId: string, overrideMembers?: string[]) => {
        // Server-side mutation: atomically creates the chat message AND
        // notifications for every other conversation member. If this call
        // succeeds, the recipient is GUARANTEED to get a notification.
        try {
            await sendChatMessageMutation({
                conversationId,
                content,
                authorId: senderId,
                authorName: currentUser?.name || undefined,
                userEmail: currentUser?.email,
            });
        } catch (e: any) {
            console.error('[handleSendMessage] Failed:', e);
            addToast(e?.message || 'Failed to send message. Please try again.', { type: 'error' });
            throw e;
        }

        // Note: overrideMembers is no longer needed on the client side because
        // the server resolves the conversation's memberIds directly. Kept in
        // the signature for backwards-compat with existing callers.
        void overrideMembers;
    }, [sendChatMessageMutation, currentUser, addToast]);

    const handleCreateDirectMessage = useCallback(async (recipientId: string, firstMessage?: string, currentUserId?: string, matterId?: string) => {
        const cid = uuidv4();
        try {
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
        } catch (e: any) {
            console.error('[handleCreateDirectMessage] Failed:', e);
            addToast(e?.message || 'Failed to create conversation.', { type: 'error' });
            throw e;
        }
    }, [currentUser, actions, handleSendMessage, addToast]);

    const handleCreateChannel = useCallback(async (name: string, memberIds: string[], creatorId: string, matterId?: string) => {
        const cid = uuidv4();
        try {
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
        } catch (e: any) {
            console.error('[handleCreateChannel] Failed:', e);
            addToast(e?.message || 'Failed to create channel.', { type: 'error' });
            throw e;
        }
    }, [actions, addToast]);

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
