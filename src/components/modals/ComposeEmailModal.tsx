
import React, { useState, useEffect, useRef } from 'react';
import { useMatterState } from '../../contexts/MatterContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useDataActions } from '../../contexts/DataContext';
import { DocumentIcon, UploadIcon, DismissIcon, PaperClipIcon } from '../../constants';
import { useUI } from '../../contexts/UIContext';
import { Document } from '../../types';

interface ComposeEmailModalProps {
    onClose: () => void;
    initialContext?: { matterId?: string; to?: string; subject?: string; body?: string };
}

const ComposeEmailModal: React.FC<ComposeEmailModalProps> = ({ onClose, initialContext }) => {
    const { handleSendEmail } = useDataActions();
    const { matterState } = useMatterState();
    const { documentState } = useDocumentState();
    const { addToast } = useUI();

    const [to, setTo] = useState(initialContext?.to || '');
    const [cc, setCc] = useState('');
    const [bcc, setBcc] = useState('');
    const [showCc, setShowCc] = useState(false);
    const [showBcc, setShowBcc] = useState(false);
    const [subject, setSubject] = useState(initialContext?.subject || '');
    const [body, setBody] = useState(initialContext?.body || '');
    const [attachments, setAttachments] = useState<Document[]>([]);
    const [isAttaching, setIsAttaching] = useState(false);
    const [confirmNoSubject, setConfirmNoSubject] = useState(false);

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

    const handleSend = () => {
        if (!to.trim()) {
            addToast('Please add at least one recipient.', { type: 'info' });
            return;
        }

        // If no subject, ask once inline (instead of opening a separate deleteConfirmation modal)
        if (!subject.trim() && !confirmNoSubject) {
            setConfirmNoSubject(true);
            return;
        }

        const recipients = [...to.split(','), ...cc.split(','), ...bcc.split(',')].map(s => s.trim()).filter(Boolean);
        handleSendEmail({
            matterId: matterId || '',
            from: 'admin@practicepro.ng',
            to: recipients,
            subject: subject || '(No Subject)',
            body,
            attachments: attachments.map(d => d.file!).filter(Boolean)
        });
        onClose();
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
        <div className="flex flex-col -m-1 sm:-m-2 h-[75vh] sm:h-auto sm:max-h-[80vh]">
            {/* Inline warning for missing subject — replaces the confusing deleteConfirmation overload */}
            {confirmNoSubject && (
                <div className="mx-1 mt-1 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between gap-3 animate-fade-in">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                        Send without a subject line?
                    </p>
                    <div className="flex gap-2 flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => setConfirmNoSubject(false)}
                            className="px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSend}
                            className="px-3 py-1 text-xs font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
                        >
                            Send Anyway
                        </button>
                    </div>
                </div>
            )}

            {/* Addressing Fields */}
            <div className="flex-shrink-0 z-10">
                <div className="flex items-center border-b border-slate-100 dark:border-zinc-800 py-2">
                    <span className="text-slate-400 dark:text-zinc-500 text-xs font-bold w-14">To</span>
                    <input autoComplete="off" data-lpignore="true"
                        type="text"
                        value={to}
                        onChange={e => setTo(e.target.value)}
                        className="flex-grow bg-transparent border-none focus:ring-0 text-sm py-1 text-slate-900 dark:text-white placeholder-slate-400 outline-none"
                        placeholder="Recipients"
                        autoFocus
                    />
                    <div className="flex gap-3 text-xs font-bold text-slate-400 dark:text-zinc-500">
                        <button type="button" onClick={() => setShowCc(!showCc)} className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Cc</button>
                        <button type="button" onClick={() => setShowBcc(!showBcc)} className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Bcc</button>
                    </div>
                </div>

                {showCc && (
                    <div className="flex items-center border-b border-slate-100 dark:border-zinc-800 py-2 animate-fade-in">
                        <span className="text-slate-400 dark:text-zinc-500 text-xs font-bold w-14">Cc</span>
                        <input autoComplete="off" data-lpignore="true"
                            type="text"
                            value={cc}
                            onChange={e => setCc(e.target.value)}
                            className="flex-grow bg-transparent border-none focus:ring-0 text-sm py-1 text-slate-900 dark:text-white outline-none"
                        />
                    </div>
                )}

                {showBcc && (
                    <div className="flex items-center border-b border-slate-100 dark:border-zinc-800 py-2 animate-fade-in">
                        <span className="text-slate-400 dark:text-zinc-500 text-xs font-bold w-14">Bcc</span>
                        <input autoComplete="off" data-lpignore="true"
                            type="text"
                            value={bcc}
                            onChange={e => setBcc(e.target.value)}
                            className="flex-grow bg-transparent border-none focus:ring-0 text-sm py-1 text-slate-900 dark:text-white outline-none"
                        />
                    </div>
                )}

                <div className="flex items-center border-b border-slate-100 dark:border-zinc-800 py-2">
                    <span className="text-slate-400 dark:text-zinc-500 text-xs font-bold w-14">Subject</span>
                    <input autoComplete="off" data-lpignore="true"
                        type="text"
                        value={subject}
                        onChange={e => { setSubject(e.target.value); setConfirmNoSubject(false); }}
                        className="flex-grow bg-transparent border-none focus:ring-0 text-sm py-1 font-bold text-slate-900 dark:text-white outline-none"
                        placeholder="Subject"
                    />
                </div>
            </div>

            {/* Message Body */}
            <div className="flex-grow overflow-y-auto custom-scrollbar relative">
                <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    className="w-full h-full resize-none border-none focus:ring-0 bg-transparent text-sm leading-relaxed text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none p-1"
                    placeholder="Type your message here..."
                />
            </div>

            {/* Attachments Display */}
            {attachments.length > 0 && (
                <div className="py-2 flex flex-wrap gap-2 flex-shrink-0 border-t border-slate-100 dark:border-zinc-800">
                    {attachments.map(doc => (
                        <div key={doc.id} className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs group">
                            <DocumentIcon className="w-3.5 h-3.5 text-red-500" />
                            <span className="truncate max-w-[160px] font-medium text-slate-700 dark:text-slate-200">{doc.title}</span>
                            <button type="button" onClick={() => toggleAttachment(doc)} className="text-slate-400 hover:text-red-500 transition-colors ml-1">
                                <DismissIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Footer Actions */}
            <div className="pt-3 border-t border-slate-200 dark:border-zinc-700 flex justify-between items-center flex-shrink-0">
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setIsAttaching(!isAttaching)}
                        className={`p-2 rounded-xl transition-colors ${isAttaching ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-600'}`}
                        title="Attach files from matter"
                    >
                        <PaperClipIcon className="w-5 h-5" />
                    </button>

                    {isAttaching && (
                        <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-slate-200 dark:border-zinc-700 overflow-hidden z-50 animate-fade-in">
                            <div className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-zinc-900/50 border-b border-slate-100 dark:border-zinc-700">
                                Attach from Matter
                            </div>
                            <div className="max-h-56 overflow-y-auto custom-scrollbar">
                                {matterDocs.length > 0 ? matterDocs.map(doc => {
                                    const isAttached = attachments.some(a => a.id === doc.id);
                                    return (
                                        <button
                                            key={doc.id}
                                            type="button"
                                            onClick={() => { toggleAttachment(doc); }}
                                            className={`w-full text-left px-4 py-2.5 text-sm truncate flex items-center gap-3 transition-colors ${isAttached ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300'}`}
                                        >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isAttached ? 'bg-primary-600 border-primary-600' : 'border-slate-300 dark:border-zinc-500'}`}>
                                                {isAttached && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                            </div>
                                            <span className="truncate">{doc.title}</span>
                                        </button>
                                    );
                                }) : <div className="px-4 py-3 text-xs text-slate-400 italic text-center">No documents in this matter.</div>}
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500 dark:text-zinc-400 text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSend}
                        className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-md text-xs transition-all active:scale-95"
                    >
                        Send Email
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ComposeEmailModal;
