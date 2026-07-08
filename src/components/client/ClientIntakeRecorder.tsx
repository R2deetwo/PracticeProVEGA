
import React, { useState, useRef, useEffect } from 'react';
import { Matter, Lead } from '../../types';
import { MicrophoneIcon, StopIcon, TrashIcon, PlusIcon } from '../../constants';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { requestMicrophonePermission, getMicrophoneErrorMessage } from '../../utils/microphonePermission';

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const isSpeechRecognitionSupported = !!SpeechRecognition;
const MAX_RECORDINGS = 3;
const MAX_DURATION_SECONDS = 4 * 60; // 4 minutes

type Recording = {
    id: string;
    url: string;
    blob: Blob;
    transcription: string;
};

export const ClientIntakeRecorder: React.FC<{ lead: Lead }> = ({ lead }) => {
    const { handleClientSubmitIntakeAudio } = useDataActions();
    const { addToast } = useUI();
    
    const [status, setStatus] = useState<'idle' | 'recording' | 'submitted'>('idle');
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [currentTranscription, setCurrentTranscription] = useState('');
    const [timer, setTimer] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recognitionRef = useRef<any | null>(null);
    const timerRef = useRef<number | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        return () => {
            mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
            recognitionRef.current?.stop();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const startTimer = () => {
        setTimer(0);
        timerRef.current = window.setInterval(() => {
            setTimer(prev => {
                if (prev >= MAX_DURATION_SECONDS - 1) {
                    handleStopRecording();
                    return MAX_DURATION_SECONDS;
                }
                return prev + 1;
            });
        }, 1000);
    };

    const handleStartRecording = async () => {
        if (status === 'submitted' || lead.intakeRecordings || recordings.length >= MAX_RECORDINGS) return;

        try {
            // Pre-request microphone permission at the OS level (native APK)
            const hasPermission = await requestMicrophonePermission();
            if (!hasPermission) {
                addToast("Microphone access denied. Please grant permission and try again.", { type: 'error' });
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Prefer WebM for compatibility
            let mimeType = 'audio/webm';
            if (!MediaRecorder.isTypeSupported('audio/webm')) {
                 if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
                 else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
            }

            const recorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if(event.data.size > 0) audioChunksRef.current.push(event.data);
            };
            
            recorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: mimeType });
                 if (blob.size === 0) {
                    console.warn("Recording stopped with empty blob.");
                    return;
                }
                const newRecording: Recording = {
                    id: `rec_${Date.now()}`,
                    url: URL.createObjectURL(blob),
                    blob: blob,
                    transcription: currentTranscription,
                };
                setRecordings(prev => [...prev, newRecording]);
                setCurrentTranscription('');
                stream.getTracks().forEach(track => track.stop());
            };
            
            if (isSpeechRecognitionSupported) {
                const recognition = new SpeechRecognition();
                recognitionRef.current = recognition;
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = 'en-US';
                let finalTranscript = '';

                recognition.onresult = (event: any) => {
                    let interimTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                         if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript;
                        } else {
                            interimTranscript += event.results[i][0].transcript;
                        }
                    }
                    setCurrentTranscription(finalTranscript + interimTranscript);
                };
                recognition.start();
            } else {
                 addToast("Live transcription is not supported in your browser. Please type your summary manually.", { type: 'info' });
            }

            // Start recording with timeslice to ensure periodic commits of data
            recorder.start(200);
            startTimer();
            setStatus('recording');

        } catch (err: any) {
            console.error("Error accessing microphone:", err);
            addToast(getMicrophoneErrorMessage(err), { type: 'error' });
        }
    };
    
    const handleStopRecording = () => {
        if(mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current?.stop();
        }
        if(recognitionRef.current) {
            recognitionRef.current?.stop();
        }
        if (timerRef.current) clearInterval(timerRef.current);
        setStatus('idle');
    };

    const handleDeleteRecording = (id: string) => {
        setRecordings(prev => prev.filter(r => r.id !== id));
    };

    const handleSubmit = async () => {
        if (recordings.length === 0) {
            addToast("Please record at least one segment.", { type: 'error' });
            return;
        }

        const finalTranscription = recordings.map(r => r.transcription).join('\n\n').trim() || "Client did not provide a transcription.";
        
        try {
            const dataUrls = await Promise.all(recordings.map(rec => {
                return new Promise<{ dataUrl: string, mimeType: string }>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(rec.blob);
                    reader.onloadend = () => resolve({ dataUrl: reader.result as string, mimeType: rec.blob.type });
                    reader.onerror = error => reject(error);
                });
            }));

            handleClientSubmitIntakeAudio(lead.id, dataUrls, finalTranscription);
            setStatus('submitted');

        } catch (error) {
            console.error("Error processing recordings for submission:", error);
            addToast("Could not process recordings. Please try again.", { type: 'error' });
        }
    };
    
    if (lead.intakeRecordings) {
         return (
             <div className="bg-green-50 dark:bg-green-900/40 p-6 rounded-xl border border-green-200 dark:border-green-800 text-center">
                <h3 className="text-xl font-bold text-green-800 dark:text-green-200">Intake Information Submitted</h3>
                <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                    Thank you. Your legal team has received your information and will begin their analysis.
                </p>
            </div>
         );
    }
    
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    return (
        <div className="bg-primary-50 dark:bg-primary-900/40 p-6 rounded-xl border border-primary-200 dark:border-primary-800">
            <h3 className="text-xl font-bold text-primary-800 dark:text-primary-200">AI Intake Assistant</h3>
            <p className="text-sm text-primary-700 dark:text-primary-300 mt-2">
                To help us understand your case better, please record your story. You can record up to 3 segments, each up to 4 minutes long.
            </p>
            <div className="mt-4 space-y-4">
                {recordings.map((rec, index) => (
                    <div key={rec.id} className="p-3 bg-white/50 dark:bg-zinc-800/30 rounded-lg">
                        <div className="flex justify-between items-center">
                            <p className="font-semibold">Recording {index + 1}</p>
                            <button onClick={() => handleDeleteRecording(rec.id)} className="p-1 text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4" /></button>
                        </div>
                        <audio controls src={rec.url} className="w-full h-10 mt-2"></audio>
                    </div>
                ))}

                {status === 'recording' ? (
                    <button onClick={handleStopRecording} className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-red-600 text-white rounded-lg font-bold text-lg hover:bg-red-700 transition-transform transform hover:scale-105 shadow-lg animate-pulse">
                        <StopIcon className="w-7 h-7" />
                        Stop Recording ({formatTime(timer)} / 04:00)
                    </button>
                ) : (
                    recordings.length < MAX_RECORDINGS && (
                        <button onClick={handleStartRecording} className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-primary-600 text-white rounded-lg font-bold text-lg hover:bg-primary-700 transition-transform transform hover:scale-105 shadow-lg">
                            <MicrophoneIcon className="w-7 h-7" />
                            {recordings.length > 0 ? `Record Another Segment (${recordings.length + 1} of ${MAX_RECORDINGS})` : `Start Recording (1 of ${MAX_RECORDINGS})`}
                        </button>
                    )
                )}
                
                {recordings.length > 0 && status !== 'recording' && (
                    <div className="pt-4 border-t border-primary-200 dark:border-primary-800">
                        <button onClick={handleSubmit} className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-bold text-lg">Submit All Recordings</button>
                    </div>
                )}
            </div>
        </div>
    );
};
