/**
 * Centralized Error Translation
 * ─────────────────────────────────────────────────────────────────────────────
 * Maps raw Convex/runtime errors to user-friendly messages.
 * End users should NEVER see technical error strings like
 * "Function 'myFunctions:createFirm' threw an exception" or
 * "Unauthenticated. Please log in to continue."
 *
 * Usage:
 *   import { translateError } from '../utils/errorTranslator';
 *   catch (err) {
 *       addToast(translateError(err), { type: 'error' });
 *   }
 *
 * The AloaChat error handler (AloaChat.tsx:820-845) was the model for this —
 * it categorizes errors (auth/quota/network/model) with helpful text.
 * Now every component can do the same with a single function call.
 */

/**
 * Translates a raw error into a user-friendly message.
 * Falls back to a generic message if the error doesn't match any known pattern.
 */
export function translateError(err: any, context?: string): string {
    if (!err) return 'Something went wrong. Please try again.';

    const rawMessage = (err?.message || err?.toString() || '').toLowerCase();

    // ─── Authentication Errors ──────────────────────────────────────────
    if (rawMessage.includes('unauthenticated') || rawMessage.includes('not logged in')) {
        return 'Your session has expired. Please log in again.';
    }
    if (rawMessage.includes('unauthorized') || rawMessage.includes('permission denied')) {
        return "You don't have permission to do this. Contact your administrator if you believe this is an error.";
    }
    if (rawMessage.includes('not associated with an active firm')) {
        return 'Your account is not linked to a workspace. Please contact support.';
    }

    // ─── Network Errors ─────────────────────────────────────────────────
    if (rawMessage.includes('network') || rawMessage.includes('fetch') || rawMessage.includes('connection')) {
        return 'Connection problem. Please check your internet and try again.';
    }
    if (rawMessage.includes('timeout') || rawMessage.includes('timed out')) {
        return 'The request took too long. Please try again.';
    }
    if (rawMessage.includes('offline')) {
        return "You're offline. Please reconnect and try again.";
    }

    // ─── Validation Errors ──────────────────────────────────────────────
    if (rawMessage.includes('required') && rawMessage.includes('field')) {
        return 'Please fill in all required fields and try again.';
    }
    if (rawMessage.includes('invalid') && (rawMessage.includes('email') || rawMessage.includes('format'))) {
        return 'Please check your input — one or more fields have invalid values.';
    }
    if (rawMessage.includes('duplicate') || rawMessage.includes('already exists')) {
        return 'This item already exists. Try a different name or check your records.';
    }

    // ─── Quota / Limit Errors ───────────────────────────────────────────
    if (rawMessage.includes('quota') || rawMessage.includes('limit reached') || rawMessage.includes('exceeded')) {
        return "You've reached your plan limit. Upgrade your subscription to continue.";
    }
    if (rawMessage.includes('rate limit') || rawMessage.includes('too many')) {
        return 'Too many requests. Please wait a moment and try again.';
    }

    // ─── AI / Model Errors ──────────────────────────────────────────────
    if (rawMessage.includes('api key') || rawMessage.includes('gemini') || rawMessage.includes('model')) {
        return 'The AI service is temporarily unavailable. Please try again later.';
    }
    if (rawMessage.includes('safety') || rawMessage.includes('blocked')) {
        return 'The request was blocked by safety filters. Try rephrasing your input.';
    }

    // ─── Convex Function Errors ─────────────────────────────────────────
    if (rawMessage.includes('threw an exception') || rawMessage.includes('function')) {
        // Strip the technical function name and give a generic message
        return context
            ? `Could not ${context}. Please try again.`
            : 'Something went wrong on our end. Please try again.';
    }

    // ─── File / Upload Errors ───────────────────────────────────────────
    if (rawMessage.includes('file size') || rawMessage.includes('too large')) {
        return 'The file is too large. Please use a smaller file.';
    }
    if (rawMessage.includes('file type') || rawMessage.includes('unsupported') || rawMessage.includes('mime')) {
        return 'This file type is not supported. Please use a different format.';
    }

    // ─── Fallback ───────────────────────────────────────────────────────
    // If the error message is short and looks user-friendly, pass it through.
    // Otherwise, use a generic message.
    if (rawMessage.length < 80 && !rawMessage.includes('function') && !rawMessage.includes('convex') && !rawMessage.includes('at ')) {
        return err.message || err.toString();
    }

    return context
        ? `Could not ${context}. Please try again.`
        : 'Something went wrong. Please try again.';
}

/**
 * Wraps an async function and returns a user-friendly error message
 * instead of throwing. Useful for fire-and-forget operations where you
 * just need a toast message.
 *
 * Usage:
 *   const msg = await safeAsync(() => createFirmMutation(args), 'create workspace');
 *   if (msg) addToast(msg, { type: 'error' });
 *
 * Returns null on success, error string on failure.
 */
export async function safeAsync<T>(
    fn: () => Promise<T>,
    context?: string
): Promise<string | null> {
    try {
        await fn();
        return null;
    } catch (err) {
        return translateError(err, context);
    }
}
