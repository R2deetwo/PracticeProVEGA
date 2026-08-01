
import React, { useState, useEffect } from 'react';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircleIcon, UploadIcon, DocumentIcon, DismissIcon, RevertIcon, SparklesIcon } from '../../constants';
import { FileDetails } from '../../types';

interface BatchUploadModalProps {
  files: File[];
  context?: { matterId?: string, categoryId?: string };
  onClose: () => void;
}

type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed';

interface FileUploadState {
  file: File;
  status: UploadStatus;
  error?: string;
  progress: number;
}

const BatchUploadModal: React.FC<BatchUploadModalProps> = ({ files: initialFiles, context, onClose }) => {
  const { handleAddDocumentAndAnalyze } = useDataActions();
  const { addToast } = useUI();
  const { currentUser } = useAuth();

  const [uploads, setUploads] = useState<FileUploadState[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCourtProcess, setIsCourtProcess] = useState(false);

  // MAX File Size Check (10MB)
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      setUploads(initialFiles.map(file => ({
        file,
        status: 'pending',
        progress: 0
      })));
    }
  }, [initialFiles]);

  useEffect(() => {
    if (uploads.length > 0 && !isProcessing) {
      const hasPending = uploads.some(u => u.status === 'pending');
      if (hasPending) {
        processQueue();
      }
    }
  }, [uploads, isProcessing]);

  const processQueue = async () => {
    setIsProcessing(true);

    // Find next pending
    const index = uploads.findIndex(u => u.status === 'pending');
    if (index === -1) {
      setIsProcessing(false);
      return;
    }

    await uploadFile(index);

    // The effect hook will re-trigger processQueue if there are more pending items
    setIsProcessing(false);
  };

  const uploadFile = async (index: number) => {
    const item = uploads[index];

    // Update status to uploading
    setUploads(prev => prev.map((u, i) => i === index ? { ...u, status: 'uploading', progress: 10 } : u));

    // Size Check
    if (item.file.size > MAX_FILE_SIZE) {
      setUploads(prev => prev.map((u, i) => i === index ? { ...u, status: 'failed', error: 'File too large (>10MB)' } : u));
      return;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            setUploads(prev => prev.map((u, i) => i === index ? { ...u, progress: 50 } : u));

            const fileDetails: FileDetails = {
              name: item.file.name,
              type: item.file.type,
              size: item.file.size,
              filePath: `uploads/${Date.now()}_${item.file.name}`,
              dataUrl: reader.result as string,
            };

            // Prepare document data
            const matter = context?.matterId ? { id: context.matterId, title: 'Matter' } : undefined;

            const newDocData = {
              title: item.file.name,
              firmId: currentUser?.firmId,
              matterId: context?.matterId, // Explicitly linking matterId for querying
              matter,
              categoryId: context?.categoryId || 'cat_clients',
              dateFiled: new Date().toISOString().split('T')[0],
              file: fileDetails,
              assignedUsers: [currentUser?.id].filter(Boolean),
              source: 'upload' as const,
              uploadedBy: currentUser?.id,
              isCourtProcess: isCourtProcess,
              litigationStatus: isCourtProcess ? 'draft' : undefined,
            };

            await handleAddDocumentAndAnalyze(newDocData);

            setUploads(prev => prev.map((u, i) => i === index ? { ...u, status: 'completed', progress: 100 } : u));
            resolve();
          } catch (e: any) {
            reject(e);
          }
        };
        reader.onerror = () => reject(new Error('Read failed'));
        reader.readAsDataURL(item.file);
      });
    } catch (error: any) {
      console.error("Upload failed", error);
      setUploads(prev => prev.map((u, i) => i === index ? { ...u, status: 'failed', error: error.message || 'Upload failed' } : u));
    }
  };

  const handleRetry = (index: number) => {
    setUploads(prev => prev.map((u, i) => i === index ? { ...u, status: 'pending', error: undefined, progress: 0 } : u));
  };

  const handleRemove = (index: number) => {
    setUploads(prev => prev.filter((_, i) => i !== index));
  };

  const completedCount = uploads.filter(u => u.status === 'completed').length;
  const isDone = completedCount === uploads.length && uploads.length > 0;

  return (
    <div className="space-y-6">
      <div className="text-center font-sans">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 text-2xs font-bold rounded uppercase tracking-widest flex items-center gap-1">
            <SparklesIcon className="w-3 h-3" /> Smart Indexing
          </span>
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center justify-center gap-2">
          DraftPro™ <span className="text-slate-400 font-normal">Internal Document Indexing</span>
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          {completedCount} of {uploads.length} documents indexed and analyzing...
        </p>
      </div>

      <div className="max-h-80 overflow-y-auto space-y-2 border border-slate-200 dark:border-zinc-700 rounded-xl p-3 bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-900/50 backdrop-blur-sm custom-scrollbar">
        {uploads.map((item, idx) => (
          <div key={idx} className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-100 dark:border-zinc-800 transition-all hover:border-primary-500/50">
            <div className="w-10 h-10 bg-slate-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
              <DocumentIcon className="w-5 h-5 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-1.5">
                <p className="text-sm font-bold truncate text-slate-800 dark:text-zinc-100">{item.file.name}</p>
                <span className={`text-2xs font-bold uppercase tracking-wider ${item.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                  item.status === 'failed' ? 'text-red-500 dark:text-red-400' : 'text-primary-500 animate-pulse'
                  }`}>
                  {item.status === 'uploading' ? (item.progress < 50 ? 'Initializing...' : 'Indexing Content...') :
                    item.status === 'failed' ? 'Failed' :
                      item.status === 'completed' ? 'Indexed' : 'Queued'}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-zinc-700 rounded-full h-1 overflow-hidden">
                <div
                  className={`h-full transition-all duration-700 ease-out ${item.status === 'failed' ? 'bg-red-500' : 'bg-primary-600'
                    }`}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
              {item.error && <p className="text-2xs text-red-500 dark:text-red-400 mt-1 font-medium">{item.error}</p>}
            </div>

            <div className="flex items-center gap-1">
              {item.status === 'failed' && (
                <button onClick={() => handleRetry(idx)} className="p-2 text-slate-500 hover:text-primary-600 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/30" title="Retry">
                  <RevertIcon className="w-4 h-4" />
                </button>
              )}

              {(item.status === 'pending' || item.status === 'failed') && (
                <button onClick={() => handleRemove(idx)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40">
                  <DismissIcon className="w-4 h-4" />
                </button>
              )}

              {item.status === 'completed' && (
                <div className="w-8 h-8 rounded-full bg-green-50 dark:bg-green-950/40 flex items-center justify-center">
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-bold text-slate-800 dark:text-zinc-100">Mark all as Court Processes</label>
            <p className="text-xs text-slate-500">Enable if these documents require court filing tracking.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsCourtProcess(!isCourtProcess)}
            disabled={isProcessing}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ring-2 ring-primary-500/10 ${isCourtProcess ? 'bg-primary-600' : 'bg-slate-300 dark:bg-zinc-700'} ${isProcessing ? 'opacity-50' : ''}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-zinc-900 transition-transform ${isCourtProcess ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-col items-end gap-3 pt-2">
        {!isDone && <p className="text-2xs text-slate-400 font-bold uppercase tracking-widest italic leading-none">Indexing continues so long as you do not close your browser tab.</p>}
        <button
          onClick={onClose}
          className={`px-8 py-2.5 rounded-xl font-bold transition-all ${isDone
            ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-500/20'
            : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
            }`}
        >
          {isDone ? 'Close Window' : 'Continue in Background'}
        </button>
      </div>
    </div>
  );
};

export default BatchUploadModal;
