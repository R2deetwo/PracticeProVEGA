
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Matter, NoteNotebook, User } from '../../types';
import { useMatterState } from '../../contexts/MatterContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { MATTERS_NOTEBOOK_ID, PROPERTIES_NOTEBOOK_ID, MicrophoneIcon, PauseIcon, SparklesIcon, DismissIcon, PlusIcon, FolderIcon, ChevronDownIcon, XMarkIcon, WarningIcon } from '../../constants';
import { inputModern } from '../../utils/formStyles';
import { requestMicrophonePermission, getMicrophoneErrorMessage } from '../../utils/microphonePermission';
import * as geminiService from '../../services/geminiService';

interface SaveToNoteFormProps {
    initialContent: string;
    onClose: () => void;
    onSearch?: (content: string) => void;
    navigateTo?: (view: string, id: string | null, params?: any) => void;
    embeddedMode?: boolean;
    noteId?: string | null;
}

type DestinationType = 'matter' | 'notebook' | 'property';
type NoteType = 'user' | 'endorsement';

export const SaveToNoteForm: React.FC<SaveToNoteFormProps> = ({ initialContent, onClose, onSearch, navigateTo, embeddedMode = false, noteId = null }) => {
    const { matterState } = useMatterState();
    const { documentState } = useDocumentState();
    const { coreState, isDataLoaded } = useCoreState();
    const { currentUser } = useAuth();
    const { addItem, updateItem } = useDataActions();
    const { addToast, openModal, view, selectedId } = useUI();

    const existingNote = useMemo(() => {
        if (!noteId) return null;
        return documentState.notePages.find(n => n.id === noteId);
    }, [noteId, documentState.notePages]);

    const [title, setTitle] = useState(() => {
        if (existingNote) return existingNote.title;
        const snippet = initialContent.split('\n')[0].substring(0, 40);
        return snippet || '';
    });
    const [content, setContent] = useState(existingNote?.content || initialContent);
    const [destinationType, setDestinationType] = useState<DestinationType>(() => {
        if (existingNote) return existingNote.propertyId ? 'property' : existingNote.matterId ? 'matter' : 'notebook';
        if (view === 'properties' || view === 'propertyDetail' || view === 'atriumEngine') return 'property';
        return 'matter';
    });
    const [selectedMatterId, setSelectedMatterId] = useState<string>(existingNote?.matterId || matterState.matters[0]?.id || '');
    const [selectedPropertyId, setSelectedPropertyId] = useState<string>(existingNote?.propertyId || (view === 'propertyDetail' && selectedId ? selectedId : coreState.properties?.[0]?.id || ''));
    const [selectedNotebookId, setSelectedNotebookId] = useState<string>(existingNote?.notebookId || '');
    const [isCreatingNewNotebook, setIsCreatingNewNotebook] = useState(false);
    const [newNotebookName, setNewNotebookName] = useState('');
    const [noteType, setNoteType] = useState<NoteType>('user');

    // Simplified UI States
    const [viewMode, setViewMode] = useState<'compose' | 'target'>('compose');
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [interimTranscript, setInterimTranscript] = useState('');
    const [transcriptionStatus, setTranscriptionStatus] = useState<'idle' | 'connecting' | 'listening' | 'processing'>('idle');
    const activeMimeTypeRef = useRef<string>('audio/webm');
    const [voiceEnergy, setVoiceEnergy] = useState(0);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const transcriptionIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const contentRef = useRef(content);
    const isRecordingRef = useRef(isRecording);
    const lastProcessedIndexRef = useRef(0);
    const isProcessingTranscriptionRef = useRef(false);

    // Sync refs for event handlers
    useEffect(() => {
        contentRef.current = content;
        isRecordingRef.current = isRecording;
    }, [content, isRecording]);

    const availableNotebooks = useMemo(() => {
        return coreState.noteNotebooks.filter(nb => nb.id !== MATTERS_NOTEBOOK_ID);
    }, [coreState.noteNotebooks]);

    useEffect(() => {
        if (availableNotebooks.length > 0 && !selectedNotebookId) {
            setSelectedNotebookId(availableNotebooks[0].id);
        }
    }, [availableNotebooks]);

    // Unified Dictation Engine
    useEffect(() => {
        const processTranscription = async (blobs: Blob[]) => {
            if (blobs.length === 0) return;
            const totalSize = blobs.reduce((s, b) => s + b.size, 0);
            if (totalSize < 500) return;
            if (isProcessingTranscriptionRef.current) return;
            isProcessingTranscriptionRef.current = true;
            setTranscriptionStatus('processing');
            try {
                const mimeType = activeMimeTypeRef.current;
                const combinedBlob = new Blob(blobs, { type: mimeType });
                const reader = new FileReader();
                reader.readAsDataURL(combinedBlob);
                reader.onloadend = async () => {
                    try {
                        const base64Audio = reader.result as string;
                        if (!base64Audio || !base64Audio.includes(',')) {
                            setTranscriptionStatus(isRecordingRef.current ? 'listening' : 'idle');
                            isProcessingTranscriptionRef.current = false;
                            return;
                        }
                        const transcription = await geminiService.transcribeAudio(
                            base64Audio,
                            mimeType,
                            coreState.firmDetails
                        );
                        if (transcription) {
                            setContent(transcription);
                        }
                    } catch (err: any) {
                        console.error("AI Transcription failed:", err);
                        addToast(`Transcription error: ${err.message || 'Unknown error'}`, { type: 'error' });
                    } finally {
                        setTranscriptionStatus(isRecordingRef.current ? 'listening' : 'idle');
                        isProcessingTranscriptionRef.current = false;
                    }
                };
            } catch (err) {
                console.error("Error preparing audio for AI:", err);
                setTranscriptionStatus(isRecordingRef.current ? 'listening' : 'idle');
                isProcessingTranscriptionRef.current = false;
            }
        };

        const startRecordingEngine = async () => {
            try {
                // Pre-request microphone permission at the OS level (native APK)
                // or trigger the browser prompt (web). This must happen BEFORE
                // getUserMedia so the native Android permission dialog appears.
                const hasPermission = await requestMicrophonePermission();
                if (!hasPermission) {
                    addToast("Microphone access denied. Please grant permission and try again.", { type: 'error' });
                    setIsRecording(false);
                    return;
                }

                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                
                // 1. Visualizer (Existing reliable logic)
                const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
                const context = new AudioContextClass();
                const analyser = context.createAnalyser();
                const source = context.createMediaStreamSource(stream);
                source.connect(analyser);
                analyser.fftSize = 256;
                audioContextRef.current = context;
                analyserRef.current = analyser;

                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                const updateEnergy = () => {
                    if (!analyserRef.current) return;
                    analyserRef.current.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
                    const average = sum / bufferLength;
                    setVoiceEnergy(Math.min(100, average * 2));
                    animationFrameRef.current = requestAnimationFrame(updateEnergy);
                };
                updateEnergy();

                // 2. MediaRecorder (Reliable AI Engine)
                let mimeType = 'audio/webm';
                if (!MediaRecorder.isTypeSupported('audio/webm')) {
                    if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
                    else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
                }
                activeMimeTypeRef.current = mimeType;

                const recorder = new MediaRecorder(stream, { mimeType });
                mediaRecorderRef.current = recorder;
                audioChunksRef.current = [];

                recorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };

                recorder.onstop = () => {
                    processTranscription(audioChunksRef.current);
                    stream.getTracks().forEach(track => track.stop());
                };

                // Start recording
                recorder.start(1000); // Collect data every second
                setTranscriptionStatus('listening');

                // Periodic AI update (every 8 seconds for "near-live" feel)
                transcriptionIntervalRef.current = setInterval(() => {
                    if (mediaRecorderRef.current?.state === 'recording') {
                        processTranscription(audioChunksRef.current);
                    }
                }, 8000);

            } catch (err: any) {
                console.error("Recording Engine failed:", err);
                addToast(getMicrophoneErrorMessage(err), { type: 'error' });
                setIsRecording(false);
            }
        };

        const stopRecordingEngine = () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (audioContextRef.current) {
                try { audioContextRef.current.close(); } catch(e) {}
            }
            audioContextRef.current = null;
            analyserRef.current = null;
            setVoiceEnergy(0);

            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            
            if (transcriptionIntervalRef.current) {
                clearInterval(transcriptionIntervalRef.current);
            }

            setTranscriptionStatus('idle');
        };

        if (isRecording) {
            setTranscriptionStatus('connecting');
            startRecordingEngine();
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => (prev < 120 ? prev + 1 : prev));
            }, 1000);
        } else {
            stopRecordingEngine();
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }

        return () => {
            stopRecordingEngine();
        };
    }, [isRecording]);

    const editorRef = useRef<HTMLTextAreaElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
        if (overlayRef.current) {
            overlayRef.current.scrollTop = e.currentTarget.scrollTop;
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleToggleRecording = () => {
        if (currentUser?.email === 'demo@practicepro.ng') {
            openModal('demoUpsell', null, { context: 'voice_notes' });
            return;
        }
        setIsRecording(prev => {
            const next = !prev;
            if (!next) {
                // Ensure engine stops immediately
                if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                    mediaRecorderRef.current.stop();
                }
            }
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let notebookId = '';
        let matterId = undefined;
        let propertyId = undefined;
        let contextType = 'notebook';

        if (destinationType === 'matter') {
            if (!selectedMatterId) {
                addToast('Please select a matter.', { type: 'error' });
                return;
            }
            notebookId = MATTERS_NOTEBOOK_ID;
            matterId = selectedMatterId;
            contextType = 'matter';
        } else if (destinationType === 'property') {
            if (!selectedPropertyId) {
                addToast('Please select a property.', { type: 'error' });
                return;
            }
            notebookId = PROPERTIES_NOTEBOOK_ID;
            propertyId = selectedPropertyId;
            contextType = 'property';
        } else {
            if (isCreatingNewNotebook && newNotebookName.trim()) {
                const newNb = {
                    firmId: coreState.firmDetails?.id || currentUser?.firmId,
                    name: newNotebookName.trim(),
                    description: '',
                    color: 'bg-blue-500',
                    scope: 'firm',
                    isShared: false,
                    sharedWithIds: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                try {
                    const savedNb = await addItem('noteNotebooks', newNb as any, newNb.name);
                    notebookId = savedNb.id;
                } catch (e) {
                     addToast("Failed to create notebook", {type: 'error'});
                     return;
                }
            } else {
                if (!selectedNotebookId) {
                    addToast('Please select a notebook or create a new one.', { type: 'error' });
                    return;
                }
                notebookId = selectedNotebookId;
            }
        }

        const notePage = {
            firmId: coreState.firmDetails?.id || currentUser?.firmId,
            title: title || (noteType === 'endorsement' ? 'Endorsement' : 'Quick Note'),
            content: content + (interimTranscript ? ' ' + interimTranscript : ''),
            notebookId: notebookId,
            matterId: matterId,
            propertyId: propertyId,
            contextType: contextType,
            parentId: null,
            authorId: currentUser?.id || 'current-user',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            order: 0,
            type: (destinationType === 'matter' || destinationType === 'property') ? noteType : 'user'
        };

        try {
            if (noteId) {
                const updatedNote = {
                    ...existingNote,
                    title: title || (noteType === 'endorsement' ? 'Endorsement' : 'Quick Note'),
                    content: content + (interimTranscript ? ' ' + interimTranscript : ''),
                    notebookId: notebookId,
                    matterId: matterId,
                    propertyId: propertyId,
                    contextType: contextType,
                    updatedAt: new Date().toISOString(),
                    type: (destinationType === 'matter' || destinationType === 'property') ? noteType : 'user'
                };
                await updateItem('notePages', updatedNote, updatedNote.title);
                addToast("Note successfully updated.", { type: 'success' });
            } else {
                await addItem('notePages', notePage as any, notePage.title);
                addToast(noteType === 'endorsement' ? "Endorsement integrated." : "Note successfully archived.", { type: 'success' });
            }
            handleClose();
        } catch (error) {
            addToast("Failed to save note. Please check connection.", { type: 'error' });
        }
    };

    const handleClose = () => {
        if (isRecording) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                try {
                    mediaRecorderRef.current.stop();
                } catch (e) {}
            }
        }
        onClose();
    };

    const commonInputClass = inputModern + ` ${embeddedMode ? 'px-4 py-3' : ''}`;

    return (
        <div className={`relative flex flex-col h-full animate-fade-in bg-white dark:bg-zinc-950`}>
            
            {!window.isSecureContext && window.location.hostname !== 'localhost' && viewMode === 'compose' && (
                <div className="absolute top-0 left-0 right-0 z-[60] bg-amber-500 text-white text-[10px] font-bold text-center py-2 px-4 shadow-sm animate-fade-in">
                    <WarningIcon className="w-4 h-4 inline-block -mt-1" /> VOICE DISABLED: Microphone requires HTTPS (Secure Connection)
                </div>
            )}

            {/* STEP 1: COMPOSITION CANVAS */}
            <div className={`flex-1 flex flex-col transition-all duration-500 overflow-hidden ${viewMode === 'target' ? 'opacity-30 scale-95 pointer-events-none blur-sm' : 'opacity-100 scale-100'}`}>
                <div className="flex-1 relative bg-transparent overflow-hidden flex flex-col">
                    {/* Streaming Text Area */}
                    <div className="flex-1 relative flex flex-col overflow-hidden" onClick={() => (document.getElementById('aloa-editor') as any)?.focus()}>
                        <textarea
                            id="aloa-editor"
                            ref={editorRef}
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            onScroll={handleScroll}
                            className="flex-1 w-full p-4 sm:p-8 pb-32 bg-transparent border-none outline-none focus:ring-0 text-lg sm:text-xl leading-relaxed text-slate-800 dark:text-zinc-100 placeholder-slate-300 dark:placeholder-zinc-800 resize-none font-medium scrollbar-thin shadow-none"
                            placeholder="What's on your mind? Start speaking..."
                            spellCheck={false}
                            autoCorrect="off"
                            autoComplete="off"
                            autoCapitalize="sentences"
                        />
                        
                        {/* THE STREAMING OVERLAY */}
                        {interimTranscript && (
                            <div 
                                ref={overlayRef}
                                className="absolute inset-0 p-4 sm:p-8 pb-32 pointer-events-none select-none overflow-y-auto scrollbar-hide"
                            >
                                <div className="text-lg sm:text-xl leading-relaxed font-medium block whitespace-pre-wrap break-words">
                                    <span className="opacity-0">{content}</span>
                                    {content && !content.endsWith(' ') && <span className="opacity-0"> </span>}
                                    <span className="text-primary-600 dark:text-primary-400 font-bold italic">
                                        {interimTranscript}
                                    </span>
                                    <span className="inline-block w-[4px] h-[1.1em] bg-primary-500 ml-1 translate-y-[0.1em] animate-cursor-pulse" />
                                </div>
                            </div>
                        )}

                        {/* Voice Activity Feedback */}
                        {isRecording && (
                            <div className="absolute bottom-6 left-6 right-6 flex items-center justify-center pointer-events-none z-20">
                                <div className={`flex items-center gap-3 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl border transition-all duration-300 animate-fade-up ${transcriptionStatus === 'listening' ? 'bg-primary-600 text-white border-primary-500' : transcriptionStatus === 'processing' ? 'bg-amber-500 text-white border-amber-400 animate-pulse' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                                    <div className="flex gap-1 items-end h-3">
                                        {[...Array(5)].map((_, i) => (
                                            <div 
                                                key={i} 
                                                className="w-1 bg-current rounded-full transition-all duration-75" 
                                                style={{ height: `${transcriptionStatus === 'listening' ? Math.max(20, voiceEnergy * (0.5 + Math.random())) : transcriptionStatus === 'processing' ? 50 + Math.sin(Date.now() / 200 + i) * 30 : 20}%` }}
                                            />
                                        ))}
                                    </div>
                                    {formatTime(recordingTime)}
                                    <span className="ml-1">
                                        {transcriptionStatus === 'connecting' ? 'Connecting...' : 
                                         transcriptionStatus === 'processing' ? 'Processing...' : 
                                         'Listening'}
                                    </span>
                                </div>
                            </div>
                         )}
                    </div>

                    {/* ACTIONS FOOTER - Mirrored from AloaChat style */}
                    <footer className="flex-shrink-0 p-4 sm:p-4 bg-white dark:bg-zinc-950 border-t border-slate-100 dark:border-zinc-900">
                        <div className="grid grid-cols-3 items-center">
                            <div className="flex items-center gap-1 sm:gap-2">
                                <button
                                    type="button"
                                    onClick={() => setContent("")}
                                    className="p-2 sm:p-3 text-slate-400 hover:text-red-500 hover:bg-slate-50 dark:hover:bg-zinc-900 rounded-xl sm:rounded-2xl transition-all"
                                    title="Clear All"
                                >
                                    <DismissIcon className="w-5 h-5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="hidden sm:block px-4 py-3 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-slate-900 dark:hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>

                            <div className="flex justify-center">
                                <button
                                    type="button"
                                    onClick={handleToggleRecording}
                                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-300 transform active:scale-95 shadow-sm relative ${isRecording ? 'bg-red-500 text-white ring-4 ring-red-500/20' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:scale-105'}`}
                                >
                                    {isRecording ? <PauseIcon className="w-6 h-6 sm:w-7 sm:h-7" /> : <MicrophoneIcon className="w-6 h-6 sm:w-7 sm:h-7" />}
                                    {isRecording && transcriptionStatus === 'listening' && (
                                        <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-25" />
                                    )}
                                </button>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!content.trim() && !interimTranscript.trim()) {
                                            addToast("Say something first!", { type: 'info' });
                                            return;
                                        }
                                        if (isRecording) setIsRecording(false);
                                        setViewMode('target');
                                    }}
                                    className="px-6 sm:px-8 py-3 sm:py-2.5 bg-primary-600 text-white rounded-[16px] sm:rounded-[20px] font-bold text-sm shadow-sm shadow-primary-600/20 hover:bg-primary-700 transition-all active:scale-95"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </footer>
                </div>
            </div>

            {/* STEP 2: SAVE TARGET SELECTOR (Overlay Drawer) */}
            {viewMode === 'target' && (
                <div className="absolute inset-0 z-[100] bg-black/40 backdrop-blur-sm animate-fade-in flex flex-col justify-end">
                    <div className="bg-white dark:bg-zinc-950 rounded-t-[40px] shadow-2xl p-3 sm:p-4 pb-6 sm:p-8 animate-slide-up max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 dark:text-zinc-100 italic tracking-tight">SAVE NOTE</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Archive to your firm library</p>
                            </div>
                            <button onClick={() => setViewMode('compose')} className="p-3 bg-slate-100 dark:bg-zinc-800 rounded-full text-slate-500 hover:bg-slate-200 transition-colors">
                                <DismissIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-2 sm:space-y-3">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Title</label>
                                <input autoComplete="off" data-lpignore="true"  
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-primary-500/50 transition-all"
                                    placeholder="Untitled Note"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-2 sm:gap-4">
                                <button
                                    onClick={() => setDestinationType('property')}
                                    className={`p-3 sm:p-4 rounded-2xl border-2 transition-all flex flex-col gap-2 sm:gap-3 ${destinationType === 'property' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' : 'border-slate-100 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-900/50'}`}
                                >
                                    <SparklesIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${destinationType === 'property' ? 'text-primary-600' : 'text-slate-400'}`} />
                                    <span className="font-bold text-[10px] sm:text-sm tracking-tight text-center">Specific Property</span>
                                </button>
                                <button
                                    onClick={() => setDestinationType('matter')}
                                    className={`p-3 sm:p-4 rounded-2xl border-2 transition-all flex flex-col gap-2 sm:gap-3 ${destinationType === 'matter' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' : 'border-slate-100 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-900/50'}`}
                                >
                                    <SparklesIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${destinationType === 'matter' ? 'text-primary-600' : 'text-slate-400'}`} />
                                    <span className="font-bold text-[10px] sm:text-sm tracking-tight text-center">Specific Matter</span>
                                </button>
                                <button
                                    onClick={() => setDestinationType('notebook')}
                                    className={`p-3 sm:p-4 rounded-2xl border-2 transition-all flex flex-col gap-2 sm:gap-3 ${destinationType === 'notebook' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' : 'border-slate-100 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-900/50'}`}
                                >
                                    <FolderIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${destinationType === 'notebook' ? 'text-primary-600' : 'text-slate-400'}`} />
                                    <span className="font-bold text-[10px] sm:text-sm tracking-tight text-center">Personal Notebook</span>
                                </button>
                            </div>

                            <div className="animate-fade-in pt-2">
                                {destinationType === 'property' ? (
                                    <div className="space-y-2 sm:space-y-3">
                                        <div className="relative">
                                            <select
                                                value={selectedPropertyId}
                                                onChange={e => setSelectedPropertyId(e.target.value)}
                                                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-primary-500 appearance-none"
                                            >
                                                <option value="" disabled>Select a property...</option>
                                                {coreState.properties?.map((p: any) => (
                                                    <option key={p.id} value={p.id}>{p.title || p.address}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                <ChevronDownIcon className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <div className="flex p-1 bg-slate-100 dark:bg-zinc-900 rounded-[20px]">
                                            <button onClick={() => setNoteType('user')} className={`flex-1 py-3 rounded-2xl text-[10px] uppercase font-black tracking-widest transition-all ${noteType === 'user' ? 'bg-white dark:bg-zinc-800 shadow-sm text-primary-600' : 'text-slate-400'}`}>General Note</button>
                                            <button onClick={() => setNoteType('endorsement')} className={`flex-1 py-3 rounded-2xl text-[10px] uppercase font-black tracking-widest transition-all ${noteType === 'endorsement' ? 'bg-white dark:bg-zinc-800 shadow-sm text-amber-600' : 'text-slate-400'}`}>Task / Log</button>
                                        </div>
                                    </div>
                                ) : destinationType === 'matter' ? (
                                    <div className="space-y-2 sm:space-y-3">
                                        <div className="relative">
                                            <select
                                                value={selectedMatterId}
                                                onChange={e => setSelectedMatterId(e.target.value)}
                                                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-primary-500 appearance-none"
                                            >
                                                {matterState.matters.map(m => (
                                                    <option key={m.id} value={m.id}>{m.title}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                <ChevronDownIcon className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <div className="flex p-1 bg-slate-100 dark:bg-zinc-900 rounded-[20px]">
                                            <button onClick={() => setNoteType('user')} className={`flex-1 py-3 rounded-2xl text-[10px] uppercase font-black tracking-widest transition-all ${noteType === 'user' ? 'bg-white dark:bg-zinc-800 shadow-sm text-primary-600' : 'text-slate-400'}`}>Memo</button>
                                            <button onClick={() => setNoteType('endorsement')} className={`flex-1 py-3 rounded-2xl text-[10px] uppercase font-black tracking-widest transition-all ${noteType === 'endorsement' ? 'bg-white dark:bg-zinc-800 shadow-sm text-amber-600' : 'text-slate-400'}`}>Endorsement</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        {!isCreatingNewNotebook ? (
                                            <select
                                                value={selectedNotebookId}
                                                onChange={e => setSelectedNotebookId(e.target.value)}
                                                className="flex-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-primary-500"
                                            >
                                                {availableNotebooks.map(nb => <option key={nb.id} value={nb.id}>{nb.name}</option>)}
                                            </select>
                                        ) : (
                                            <input autoComplete="off" data-lpignore="true" 
                                                type="text"
                                                value={newNotebookName}
                                                onChange={e => setNewNotebookName(e.target.value)}
                                                className="flex-1 bg-white dark:bg-zinc-900 border border-primary-500 rounded-2xl px-6 py-4 text-sm font-medium focus:ring-0"
                                                placeholder="New Notebook Name..."
                                                autoFocus
                                            />
                                        )}
                                        <button onClick={() => setIsCreatingNewNotebook(!isCreatingNewNotebook)} className={`p-4 rounded-2xl transition-all ${isCreatingNewNotebook ? 'bg-red-50 text-red-500' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}>
                                            {isCreatingNewNotebook ? <XMarkIcon className="w-5 h-5" /> : <PlusIcon className="w-5 h-5" />}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="pt-6">
                                <button
                                    onClick={handleSubmit}
                                    className="w-full py-5 bg-primary-600 text-white rounded-[24px] font-black text-sm uppercase tracking-[4px] shadow-2xl hover:bg-primary-700 transition-all active:scale-95 flex items-center justify-center gap-3"
                                >
                                    Archive Note
                                </button>
                                <button
                                    onClick={() => setViewMode('compose')}
                                    className="w-full mt-4 py-4 text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors"
                                >
                                    Back to Editor
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
