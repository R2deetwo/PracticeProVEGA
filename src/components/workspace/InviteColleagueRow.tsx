import React, { useState } from 'react';
import { useUI } from '../../contexts/UIContext';
import { Button } from '../ui';
import { whatsappShareUrl } from '../../utils/whatsappShare';
import { buildColleagueInviteText, colleagueInviteUrl } from '../../utils/colleagueInvite';

/**
 * InviteColleagueRow — the understated colleague invitation surface
 * (owner directive 2026-11-24: "Add an understated 'Invite Colleague'
 * option in the workspace/sidebar or team menu that lets a user copy a
 * clean invite link or share a pre-written, dignified WhatsApp message
 * inviting another lawyer in their chambers or co-counsel to
 * collaborate. Keep tone understated, professional, and consistent with
 * Nigerian legal etiquette — no loud referral banners or discount
 * gimmicks.").
 *
 * One quiet row under the workspace header in the Sidebar, and the same
 * panel opens from FirmSettings' Team card ("Share Invite"). The join
 * mechanism is the firm's EXISTING Secret Access Code — the panel only
 * adds the missing handoff: a clean join link (copied to clipboard) and
 * a pre-written WhatsApp message that opens in the inviter's WhatsApp
 * for review before sending. Nothing auto-sends; nothing pops up.
 *
 * UI primitives (ADR-0004): Button — no raw form elements (ratchet).
 */
const UserPlusIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" />
        <circle cx="8.5" cy="7" r="3.5" />
        <path d="M19 8v6M22 11h-6" />
    </svg>
);

const WhatsAppGlyph: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.23-8.23 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.8-.23-.09-.4-.12-.56.12-.17.25-.64.8-.78.97-.14.16-.28.18-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-.79-1.24-.93-1.53-.14-.29-.02-.44.11-.58.11-.11.25-.29.37-.44.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.39 1.01 2.56.12.16 1.74 2.65 4.22 3.72.59.25 1.05.4 1.4.52.59.18 1.13.16 1.56.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
);

export const InviteColleagueRow: React.FC<{
    /** The firm/workspace display name (shown in the share message). */
    firmName: string;
    /** The firm's Secret Access Code (INV-XXXX). Renders nothing when absent. */
    inviteCode?: string;
    /** The inviter's display name (signs the WhatsApp message). */
    inviterName: string;
    /** true on legal (Vega) workspaces — picks the message's platform line. */
    isLegal: boolean;
}> = ({ firmName, inviteCode, inviterName, isLegal }) => {
    const { addToast } = useUI();
    const [open, setOpen] = useState(false);

    // No code yet (older workspaces mid-boot, or generation still running)
    // — the row renders nothing rather than a broken promise.
    if (!inviteCode) return null;

    const joinLink = colleagueInviteUrl(inviteCode);
    const shareText = buildColleagueInviteText({ firmName, inviterName, inviteCode, isLegal });
    const whatsappHref = whatsappShareUrl(null, shareText);

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(joinLink);
            addToast("Invite link copied to clipboard!", { type: 'success' });
        } catch {
            addToast("Could not copy — long-press or select the link below instead.", { type: 'error' });
        }
    };

    return (
        <div className="px-3 pt-2" data-tour-id="invite-colleague">
            <Button
                variant="ghost"
                size="sm"
                icon={UserPlusIcon}
                aria-expanded={open}
                onClick={() => setOpen(!open)}
                className="w-full !justify-start !gap-2 !px-2.5 !py-2 text-2xs font-semibold text-slate-500 dark:text-zinc-400"
            >
                Invite Colleague
            </Button>

            {open && (
                <div
                    className="mt-1 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-2.5"
                    role="group"
                    aria-label="Invite a colleague to this workspace"
                >
                    <p className="text-2xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                        A chambers colleague or co-counsel joins this workspace with the firm's access code.
                    </p>

                    {/* The join link — the value copied to the clipboard. */}
                    <div className="flex items-center gap-2">
                        <code
                            className="flex-1 min-w-0 truncate rounded-md border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 px-2 py-1.5 text-2xs font-mono text-slate-600 dark:text-zinc-300"
                            title={joinLink}
                        >
                            {joinLink}
                        </code>
                        <Button variant="secondary" size="sm" onClick={handleCopyLink} className="!px-2.5 !py-1.5 text-2xs font-bold uppercase flex-shrink-0">
                            Copy
                        </Button>
                    </div>

                    {/* WhatsApp handoff — the pre-written message opens in the
                        inviter's WhatsApp (chat picker; nothing sends itself). */}
                    <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full rounded-sm border border-emerald-200 dark:border-emerald-900/60 px-3 py-2 text-2xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                        title="Opens WhatsApp with the invitation message for your review"
                    >
                        <WhatsAppGlyph className="w-3.5 h-3.5" />
                        Share on WhatsApp
                    </a>

                    <p className="text-3xs text-slate-400 dark:text-zinc-500 leading-relaxed">
                        Access code <span className="font-mono font-bold tracking-wide">{inviteCode}</span> — rotate it any time in Settings → Team. The message is editable before you send it.
                    </p>
                </div>
            )}
        </div>
    );
};

export default InviteColleagueRow;
