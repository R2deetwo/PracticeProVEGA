
import React, { useState, useEffect, useRef } from 'react';
import { useMatterState } from '../../contexts/MatterContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useDataActions } from '../../contexts/DataContext';
import { useDataState } from '../../contexts/DataContext';
import { DocumentIcon, TrashIcon, UploadIcon, DismissIcon, PaperClipIcon } from '../../constants';
import { useUI } from '../../contexts/UIContext';
import { Document } from '../../types';

// Mock Icons for Toolbar
const BoldIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" /></svg>;
const ItalicIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" /></svg>;
const UnderlineIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 3v7a6 6 0 006 6 6 6 0 006-6V3" /><line x1="4" y1="21" x2="20" y2="21" /></svg>;
const ListBulletIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>;

interface ComposeEmailModalProps {
    onClose: () => void;
    initialContext?: { matterId?: string; to?: string; subject?: string; body?: string };
}

const ComposeEmailModal: React.FC<ComposeEmailModalProps> = ({ onClose, initialContext }) => {
    const { handleSendEmail } = useDataActions();
    const { matterState } = useMatterState();
    const { documentState } = useDocumentState();
    const { addToast, openModal, closeModal } = useUI();

    const [to, setTo] = useState(initialContext?.to || '');
    const [cc, setCc] = useState('');
    const [bcc, setBcc] = useState('');
    const [showCc, setShowCc] = useState(false);
    const [showBcc, setShowBcc] = useState(false);
    const [subject, setSubject] = useState(initialContext?.subject || '');
    const [body, setBody] = useState(initialContext?.body || '');
    const [attachments, setAttachments] = useState<Document[]>([]);
    const [isAttaching, setIsAttaching] = useState(false);

    const hasAutoFilled = useRef(false);

    const matterId = initialContext?.matterId;
    const matter = matterState.matters.find(m => m.id === matterId);
    const matterDocs = documentState.documents.filter(d => d.matter?.id === matterId);
    const client = matter ? matterState.contacts.find(c => c.id === matter.clientId) : null;

    useEffect(() => {
        if (!hasAutoFilled.current) {
            if (matter && client && client.email && !to) {
                setTo(client.email);
            }
            if (matter && !subject) {
                setSubject(`Re: ${matter.title} (${matter.referenceNumber})`);
            }
            hasAutoFilled.current = true;
        }
    }, [matter, client, to, subject]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!to.trim()) {
            addToast('Please add at least one recipient.', { type: 'info' });
            return;
        }

        const sendEmail = () => {
            const recipients = [...to.split(','), ...cc.split(','), ...bcc.split(',')].map(s => s.trim()).filter(Boolean);
            handleSendEmail({
                matterId: matterId || '',
                from: 'admin@practicepro.ng',
                to: recipients,
                subject,
                body,
                attachments: attachments.map(d => d.file!).filter(Boolean)
            });
            onClose();
        };

        if (!subject.trim()) {
            openModal('deleteConfirmation', 'sendWithoutSubject', {
                title: "Send Without Subject?",
                message: "This message has no subject. Send it anyway?",
                onConfirm: () => { sendEmail(); closeModal(); },
                confirmText: "Send Anyway"
            });
            return;
        }

        sendEmail();
    };

    const toggleAttachment = (doc: Document) => {
        setAttachments(prev => {
            if (prev.some(a => a.id === doc.id)) {
                return prev.filter(a => a.id !== doc.id);
            }
            return [...prev, doc];
        });
    };

    return (
        <div className="flex flex-col w-[90vw] h-[90vh] max-w-7xl bg-white dark:bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-slate-200 dark:border-zinc-700">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-100 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700 flex-shrink-0">
                <span className="font-bold text-lg text-slate-700 dark:text-slate-200">New Message</span>
                <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700">
                    <DismissIcon className="w-6 h-6" />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-grow overflow-hidden">
                {/* Addressing Fields */}
                <div className="px-6 pt-4 flex-shrink-0 bg-white dark:bg-zinc-900 z-10">
                    <div className="flex items-center border-b border-slate-100 dark:border-zinc-800 py-2">
                        <span className="text-slate-500 dark:text-zinc-400 text-sm font-medium w-16">To</span>
                        <input autoComplete="off" data-lpignore="true" 
                            type="text"
                            value={to}
                            onChange={e => setTo(e.target.value)}
                            className="flex-grow bg-transparent border-none focus:ring-0 text-sm py-1 text-slate-900 dark:text-white placeholder-slate-400"
                            placeholder="Recipients"
                            autoFocus
                        />
                        <div className="flex gap-3 text-xs font-medium text-slate-500 dark:text-zinc-400">
                            <button type="button" onClick={() => setShowCc(!showCc)} className="hover:text-primary-600 dark:hover:text-primary-400 hover:underline">Cc</button>
                            <button type="button" onClick={() => setShowBcc(!showBcc)} className="hover:text-primary-600 dark:hover:text-primary-400 hover:underline">Bcc</button>
                        </div>
                    </div>

                    {showCc && (
                        <div className="flex items-center border-b border-slate-100 dark:border-zinc-800 py-2 animate-fade-in">
                            <span className="text-slate-500 dark:text-zinc-400 text-sm font-medium w-16">Cc</span>
                            <input autoComplete="off" data-lpignore="true" 
                                type="text"
                                value={cc}
                                onChange={e => setCc(e.target.value)}
                                className="flex-grow bg-transparent border-none focus:ring-0 text-sm py-1 text-slate-900 dark:text-white"
                            />
                        </div>
                    )}

                    {showBcc && (
                        <div className="flex items-center border-b border-slate-100 dark:border-zinc-800 py-2 animate-fade-in">
                            <span className="text-slate-500 dark:text-zinc-400 text-sm font-medium w-16">Bcc</span>
                            <input autoComplete="off" data-lpignore="true" 
                                type="text"
                                value={bcc}
                                onChange={e => setBcc(e.target.value)}
                                className="flex-grow bg-transparent border-none focus:ring-0 text-sm py-1 text-slate-900 dark:text-white"
                            />
                        </div>
                    )}

                    <div className="flex items-center border-b border-slate-100 dark:border-zinc-800 py-2">
                        <span className="text-slate-500 dark:text-zinc-400 text-sm font-medium w-16">Subject</span>
                        <input autoComplete="off" data-lpignore="true" 
                            type="text"
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            className="flex-grow bg-transparent border-none focus:ring-0 text-base py-1 font-bold text-slate-900 dark:text-white"
                            placeholder="Subject"
                        />
                    </div>
                </div>

                {/* Editor Toolbar */}
                <div className="px-6 py-2 flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 flex-shrink-0">
                    <ToolbarButton icon={<BoldIcon />} tooltip="Bold" />
                    <ToolbarButton icon={<ItalicIcon />} tooltip="Italic" />
                    <ToolbarButton icon={<UnderlineIcon />} tooltip="Underline" />
                    <div className="w-px h-5 bg-slate-300 dark:bg-zinc-700 mx-2"></div>
                    <ToolbarButton icon={<ListBulletIcon />} tooltip="Bullet List" />
                </div>

                {/* Message Body */}
                <div className="flex-grow p-6 overflow-y-auto custom-scrollbar relative">
                    <textarea
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        className="w-full h-full resize-none border-none focus:ring-0 bg-transparent text-base leading-relaxed text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none"
                        placeholder="Type your message here..."
                    />
                </div>

                {/* Attachments Display */}
                {attachments.length > 0 && (
                    <div className="px-6 py-3 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 flex flex-wrap gap-3 flex-shrink-0 max-h-32 overflow-y-auto">
                        {attachments.map(doc => (
                            <div key={doc.id} className="flex items-center gap-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-600 rounded-md px-3 py-1.5 text-sm shadow-sm group">
                                <DocumentIcon className="w-4 h-4 text-red-500" />
                                <span className="truncate max-w-[200px] font-medium text-slate-700 dark:text-slate-200">{doc.title}</span>
                                <span className="text-slate-400 mx-1">|</span>
                                <button type="button" onClick={() => toggleAttachment(doc)} className="text-slate-400 hover:text-red-500 transition-colors">
                                    <DismissIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Footer Actions */}
                <div className="p-4 border-t border-slate-200 dark:border-zinc-700 flex justify-between items-center bg-white dark:bg-zinc-900 flex-shrink-0">
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsAttaching(!isAttaching)}
                            className={`p-2.5 rounded-full transition-colors ${isAttaching ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}
                            title="Attach files"
                        >
                            <PaperClipIcon className="w-5 h-5" />
                        </button>

                        {isAttaching && (
                            <div className="absolute bottom-full left-0 mb-2 w-80 bg-white dark:bg-zinc-800 rounded-lg shadow-2xl border border-slate-200 dark:border-zinc-700 overflow-hidden z-50 animate-slide-in-up origin-bottom-left">
                                <div className="px-4 py-3 text-xs font-bold text-slate-500 uppercase bg-slate-50 dark:bg-zinc-900/50 border-b border-slate-100 dark:border-zinc-700">
                                    Attach from Matter
                                </div>
                                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                    {matterDocs.length > 0 ? matterDocs.map(doc => {
                                        const isAttached = attachments.some(a => a.id === doc.id);
                                        return (
                                            <button
                                                key={doc.id}
                                                type="button"
                                                onClick={() => { toggleAttachment(doc); }}
                                                className={`w-full text-left px-4 py-3 text-sm truncate flex items-center gap-3 transition-colors ${isAttached ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300'}`}
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isAttached ? 'bg-primary-600 border-primary-600' : 'border-slate-300 dark:border-zinc-500'}`}>
                                                    {isAttached && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                                </div>
                                                <span className="truncate">{doc.title}</span>
                                            </button>
                                        );
                                    }) : <div className="px-4 py-3 text-sm text-slate-400 italic text-center">No documents found in this matter.</div>}
                                </div>
                                <div className="border-t border-slate-100 dark:border-zinc-700 p-2 bg-slate-50 dark:bg-zinc-900/30">
                                    <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-white dark:hover:bg-zinc-700 rounded-md text-primary-600 dark:text-primary-400 font-semibold flex items-center gap-2 transition-colors">
                                        <UploadIcon className="w-4 h-4" /> Upload from Computer
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                            Discard
                        </button>
                        <button type="submit" className="px-8 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold shadow-md text-sm transition-all transform active:scale-95">
                            Send Email
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

const ToolbarButton = ({ icon, tooltip }: { icon: React.ReactNode, tooltip: string }) => (
    <button type="button" className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-zinc-800 rounded transition-colors" title={tooltip}>
        {icon}
    </button>
);

export default ComposeEmailModal;
