
import React, { useState, useCallback, useMemo } from 'react';
import {
    CloudArrowUpIcon,
    FoldersIcon,
    CheckCircleIcon,
    XMarkIcon,
    ChevronRightIcon,
    SearchIcon,
    MattersIcon as MatterIcon,
    UsersIcon,
    DocumentTextIcon,
    SparklesIcon,
    ArrowPathIcon,
    ShieldCheckIcon,
    FolderIcon // Added this missing import
} from '../../constants';
import { useUI } from '../../contexts/UIContext';
import { useMatterState } from '../../contexts/MatterContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { MatterType, BillingModel, MatterStatus, ContactType, FileDetails } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { analyzeIngestedMatterFiles } from '../../agents/IngestionAgent';

// Add allowed extensions list
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.xlsx', '.xls', '.csv', '.png', '.jpg', '.jpeg'];

const isAllowedDocument = (filename: string) => {
    const ext = filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
    return ALLOWED_EXTENSIONS.includes(`.${ext}`);
};


interface IngestionFile {
    file: File;
    path: string[]; // e.g. ["Matters", "Smith v Jones", "Pleadings", "Statement.docx"]
    folder: string;
}

interface DraftMatter {
    id: string; // Temporary ID
    title: string;
    clientName: string;
    type: MatterType;
    reference: string;
    detectedFolders: string[];
    files: IngestionFile[];
    validationStatus: 'ready' | 'error' | 'warning';
}

type IngestionStep = 'upload' | 'scanning' | 'validation' | 'executing' | 'complete' | 'error';

export const MatterIngestionWizard: React.FC = () => {
    const { closeModal, addToast } = useUI();
    const { onAddMatter, handleAddContact, handleAddDocumentAndAnalyze } = useDataActions();
    const { matterState } = useMatterState();
    const { coreState, isDataLoaded } = useCoreState();
    const { currentUser } = useAuth();

    const [step, setStep] = useState<IngestionStep>('upload');
    const [files, setFiles] = useState<IngestionFile[]>([]);
    const [draftMatters, setDraftMatters] = useState<DraftMatter[]>([]);
    const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
    const [importDocuments, setImportDocuments] = useState(true);
    const [ingestionError, setIngestionError] = useState<string | null>(null);

    // --- LOGIC: Directory Scanning ---
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        processFiles(Array.from(e.target.files));
    };

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();

        // When dropping a folder, basic e.dataTransfer.files sometimes flattening it,
        // but it's the most reliable way across browsers without complex DataTransferItem parsing.
        // For production, deeply parsing e.dataTransfer.items webkitGetAsEntry is better,
        // but this works for basic dropping if users drop files.
        // Note: Dragging an entire folder *requires* webkitGetAsEntry to get right paths. Let's do a basic parse here.
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(Array.from(e.dataTransfer.files));
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const processFiles = (fileList: File[]) => {
        if (!fileList || fileList.length === 0) return;

        setStep('scanning');
        const scannedFiles: IngestionFile[] = [];

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];

            // Ignore hidden OS files (e.g. .DS_Store, desktop.ini)
            if (file.name.startsWith('.')) continue;

            // Only process allowed documents
            if (!isAllowedDocument(file.name)) continue;

            const pathParts = file.webkitRelativePath ? file.webkitRelativePath.split('/') : [file.name];

            scannedFiles.push({
                file,
                path: pathParts,
                folder: pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : 'General'
            });
        }

        setFiles(scannedFiles);

        // Run AI Interpretation of the structure
        interpretStructure(scannedFiles);
    };

    const interpretStructure = async (scannedFiles: IngestionFile[]) => {
        // Simple heuristic: Top level folders are often matters
        const folderGroups: Record<string, IngestionFile[]> = {};
        scannedFiles.forEach(f => {
            // Group files by heuristic, if dragged without folder structure we try to group everything together.
            let matterFolderName = 'General Legal Matter';
            if (f.path.length > 1) {
                // If there's a folder, use the first subfolder name in the path array (after the root)
                matterFolderName = f.path.length > 2 ? f.path[1] : f.path[0];
            } else {
                // Fallback for single files without a folder structure
                matterFolderName = "Uploaded Documents";
            }
            if (!folderGroups[matterFolderName]) folderGroups[matterFolderName] = [];
            folderGroups[matterFolderName].push(f);
        });

        const drafts: DraftMatter[] = [];
        const entries = Object.entries(folderGroups);

        for (let i = 0; i < entries.length; i++) {
            const [name, files] = entries[i];

            // For UI feedback during the scanning phase
            setProgress({ current: i, total: entries.length, label: `Analyzing ${name}...` });

            // Extract raw files array
            const rawFiles = files.map(f => f.file);

            // Call the AI Agent to inspect up to 3 files in this group
            const aiMetadata = await analyzeIngestedMatterFiles(rawFiles, name.replace(/[-_]/g, ' '));

            // Convert to MatterType enum if exact match
            let validatedType = MatterType.CivilLitigation;
            const validTypes = Object.values(MatterType);
            if (validTypes.includes(aiMetadata.matterType as MatterType)) {
                validatedType = aiMetadata.matterType as MatterType;
            }

            drafts.push({
                id: `draft_${i}`,
                title: aiMetadata.matterTitle,
                clientName: aiMetadata.primaryClient,
                type: validatedType,
                reference: aiMetadata.suitNumber || `LEG-${Math.floor(Math.random() * 9000) + 1000}`,
                files,
                detectedFolders: Array.from(new Set(files.map(f => f.path.slice(2, -1).join('/')))).filter(Boolean),
                validationStatus: 'ready'
            });
        }

        setDraftMatters(drafts);
        setStep('validation');
    };

    // --- LOGIC: Ingestion Execution ---
    const startIngestion = async () => {
        setIngestionError(null);
        setStep('executing');
        setProgress({ current: 0, total: draftMatters.length, label: 'Preparing...' });

        // Resolve firmId upfront - bail out immediately if missing
        const firmId = currentUser?.firmId || coreState.firmDetails?.id;
        if (!firmId) {
            const msg = 'Cannot create matters: No firm ID found. Please reload the app.';
            setIngestionError(msg);
            addToast(msg, { type: 'error' });
            setStep('validation'); // Go back so user isn't stuck
            return;
        }

        try {
            for (let i = 0; i < draftMatters.length; i++) {
                const matter = draftMatters[i];
                setProgress({ current: i, total: draftMatters.length, label: `Creating matter ${i + 1} of ${draftMatters.length}: ${matter.title}...` });

                // 1. Resolve Contact
                let clientId = '';
                const existingContact = matterState.contacts.find(c =>
                    c.name.toLowerCase().trim() === matter.clientName.toLowerCase().trim()
                );

                if (existingContact) {
                    clientId = existingContact.id;
                } else if (matter.clientName && matter.clientName.trim() !== '') {
                    // Create contact with firmId always present
                    const newContact = await handleAddContact({
                        name: matter.clientName.trim(),
                        contactType: ContactType.Individual,
                        category: 'Client',
                        email: '',
                        phone: '',
                        firmId,
                    }, false);
                    if (newContact) clientId = newContact.id;
                }

                // 2. Create Matter - always include firmId
                const matterData = {
                    firmId,
                    title: matter.title,
                    type: matter.type,
                    clientId,
                    stage: 'Active',
                    status: 'Active',
                    assignedUsers: [currentUser?.id].filter(Boolean) as string[],
                    billingModel: BillingModel.Hourly,
                    hourlyRate: 0,
                    createdAt: new Date().toISOString(),
                    stageLastUpdated: new Date().toISOString(),
                    referenceNumber: matter.reference || `ING-${Date.now()}-${i}`,
                };

                const newMatter = await onAddMatter(matterData, null);
                const newMatterId = newMatter?.id || newMatter?._id || '';

                // 3. (Optional) Upload Document Records
                if (importDocuments && matter.files && matter.files.length > 0) {
                    setProgress(prev => ({ ...prev, label: `Registering ${matter.files.length} documents for ${matter.title}...` }));

                    for (const file of matter.files) {
                        try {
                            const docData = {
                                firmId,
                                title: file.file.name,
                                matterId: newMatterId,
                                categoryId: 'General',
                                file: {
                                    name: file.file.name,
                                    type: file.file.type,
                                    size: file.file.size,
                                    filePath: `matters/${matter.title}/${file.file.name}`,
                                    dataUrl: ''
                                }
                            };
                            await handleAddDocumentAndAnalyze(docData);
                        } catch (docErr) {
                            // Non-fatal: log and continue — don't let one bad doc kill the whole run
                            console.warn(`Failed to register document ${file.file.name}:`, docErr);
                        }
                    }
                }

                setProgress(prev => ({ ...prev, current: i + 1 }));
            }

            // All done!
            setStep('complete');
            addToast(`Successfully migrated ${draftMatters.length} matter${draftMatters.length !== 1 ? 's' : ''}.`, { type: 'success' });

        } catch (error: any) {
            const errMsg = error?.message || 'An unexpected error occurred during ingestion.';
            console.error('Ingestion failed:', error);
            setIngestionError(errMsg);
            addToast(`Migration failed: ${errMsg}`, { type: 'error' });
            // Always go back to validation — never leave user stuck on spinner
            setStep('validation');
        }
    };

    return (
        <div className="flex flex-col h-[calc(95vh-60px)] w-full bg-white dark:bg-zinc-900 overflow-hidden">
            {/* Context Info (Replaced original header) */}
            <div className="px-8 py-4 bg-slate-50/50 dark:bg-zinc-900/50 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-3">
                <div className="p-1.5 bg-primary-600 rounded-lg text-white">
                    <SparklesIcon className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">Onboarding & Migration</h3>
                    <p className="text-[10px] text-slate-500 font-medium">Auto-detecting matters and docs from local directories</p>
                </div>
            </div>

            {/* Stepper (Visual only) */}
            <div className="px-8 pt-4 pb-2 flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex-shrink-0">
                {[
                    { key: 'upload', label: 'Folder Selection', icon: FoldersIcon },
                    { key: 'validation', label: 'AI Review & Mapping', icon: SearchIcon },
                    { key: 'executing', label: 'Migration Engine', icon: CloudArrowUpIcon },
                    { key: 'complete', label: 'Finished', icon: CheckCircleIcon }
                ].map((s, idx) => {
                    const isActive = step === s.key || (s.key === 'scanning' && step === 'scanning');
                    const isDone = idx < ['upload', 'validation', 'executing', 'complete'].indexOf(step);

                    return (
                        <div key={s.key} className="flex items-center gap-2">
                            <div className={`
                                w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all
                                ${isDone ? 'bg-green-500 text-white' : isActive ? 'bg-primary-600 text-white shadow-md scale-110' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'}
                            `}>
                                {isDone ? <CheckCircleIcon className="w-4 h-4" /> : idx + 1}
                            </div>
                            <span className={`text-[10px] font-bold whitespace-nowrap ${isActive ? 'text-primary-600' : 'text-slate-400'}`}>
                                {s.label}
                            </span>
                            {idx < 3 && <ChevronRightIcon className="w-3 h-3 text-slate-200" />}
                        </div>
                    );
                })}
            </div>

            {/* Content Area */}
            <main className="flex-grow overflow-hidden relative flex flex-col">

                {/* STEP 1: UPLOAD */}
                {step === 'upload' && (
                    <div
                        className="h-full flex flex-col items-center justify-center p-12 text-center"
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                    >
                        <div className="w-24 h-24 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-8 animate-pulse shadow-inner border-2 border-dashed border-primary-400">
                            <FoldersIcon className="w-12 h-12 text-primary-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Drop Master Firm Folder Here</h3>
                        <p className="text-slate-500 dark:text-zinc-400 max-w-md mb-8 leading-relaxed">
                            Drag and drop a master folder containing all your client matter directories here, or click to browse. ALOA will recursively scan the structure to detect matters, parties, and supported documents (Word, PDF, Excel, txt).
                        </p>

                        <label className="group relative cursor-pointer">
                            <input autoComplete="off" data-lpignore="true" 
                                type="file"
                                className="hidden"
                                {...({ webkitdirectory: "", directory: "" } as any)}
                                multiple
                                onChange={handleFileChange}
                            />
                            <div className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold shadow-xl hover:scale-105 transition-all flex items-center gap-3 ring-4 ring-slate-100 dark:ring-zinc-800">
                                <FoldersIcon className="w-5 h-5" />
                                Browse Local Directories
                            </div>
                        </label>

                        <p className="mt-6 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            Privacy Notice: Data is processed locally before upload.
                        </p>
                    </div>
                )}

                {/* STEP 2: SCANNING / MAPPING */}
                {step === 'scanning' && (
                    <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-slate-50/50 dark:bg-zinc-900/50">
                        <div className="relative w-32 h-32 mb-8">
                            <div className="absolute inset-0 border-4 border-primary-100 dark:border-zinc-800 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <SparklesIcon className="w-10 h-10 text-primary-600 animate-pulse" />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">ALOA Intelligence at Work</h3>
                        <p className="text-slate-500 font-mono text-xs max-w-xs truncate">Scanning: {files[files.length - 1]?.path.join('/') || 'Analysing directories...'}</p>
                        <div className="mt-8 flex gap-4">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                                <FolderIcon className="w-3 h-3" /> {files.length} Files Found
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                                <ArrowPathIcon className="w-3 h-3 animate-spin" /> Auto-Mapping Matters
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 3: VALIDATION */}
                {step === 'validation' && (
                    <div className="h-full flex flex-col">
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/30 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded">
                                    <ShieldCheckIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase">Manual Validation Required</p>
                                    <p className="text-[10px] text-amber-700 dark:text-amber-500">Review extraction results before committing to the database. Adjust fields as needed.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className={`w-10 h-6 rounded-full p-1 transition-colors ${importDocuments ? 'bg-primary-600' : 'bg-slate-300 dark:bg-zinc-700'}`} onClick={() => setImportDocuments(!importDocuments)}>
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${importDocuments ? 'translate-x-4' : ''}`} />
                                    </div>
                                    <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">Import Documents</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex-grow overflow-y-auto custom-scrollbar p-6">
                            <table className="w-full text-left border-separate border-spacing-y-3">
                                <thead>
                                    <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">
                                        <th className="pb-2">Matter Title</th>
                                        <th className="pb-2">Primary Client</th>
                                        <th className="pb-2">Type</th>
                                        <th className="pb-2 text-center">Docs Detected</th>
                                        <th className="pb-2 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {draftMatters.map(draft => (
                                        <tr key={draft.id} className="bg-slate-50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-all rounded-xl shadow-sm border border-slate-100 dark:border-zinc-700">
                                            <td className="p-4 rounded-l-xl">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded flex items-center justify-center">
                                                        <MatterIcon className="w-4 h-4" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{draft.title}</p>
                                                        <p className="text-[10px] text-slate-500 font-mono">{draft.reference}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <UsersIcon className="w-3.5 h-3.5 text-slate-400" />
                                                    <span className="text-sm text-slate-700 dark:text-zinc-300">{draft.clientName}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="px-2 py-0.5 bg-slate-200 dark:bg-zinc-700 rounded text-[10px] font-bold text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                                                    {draft.type}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg ${importDocuments ? 'bg-green-100 dark:bg-green-900/30 text-green-700' : 'bg-slate-100 dark:bg-zinc-700 text-slate-400 opacity-50'}`}>
                                                    <DocumentTextIcon className="w-3.5 h-3.5" />
                                                    <span className="text-xs font-bold">{draft.files.length}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 rounded-r-xl text-right">
                                                <button className="text-primary-600 hover:underline text-xs font-bold">Edit Fields</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-6 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-900/50">
                            <div>
                                {ingestionError && (
                                    <p className="text-xs font-bold text-red-600 mb-1">⚠ Last attempt failed: {ingestionError}</p>
                                )}
                                <p className="text-sm font-bold text-slate-900 dark:text-white">Batch Ready</p>
                                <p className="text-xs text-slate-500">{draftMatters.length} Matters to be ingested. {importDocuments ? `${files.length} documents will be queued.` : 'Skipping document binary upload.'}</p>
                            </div>
                            <button
                                onClick={startIngestion}
                                className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-lg shadow-primary-500/30 transition-all flex items-center gap-2"
                            >
                                <CloudArrowUpIcon className="w-5 h-5" />
                                {ingestionError ? 'Retry Migration' : 'Begin Migration'}
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 4: EXECUTING */}
                {step === 'executing' && (
                    <div className="h-full flex flex-col items-center justify-center p-20 text-center">
                        <div className="w-full max-w-md bg-slate-100 dark:bg-zinc-800 h-3 rounded-full overflow-hidden mb-6 shadow-inner">
                            <div
                                className="bg-primary-600 h-full transition-all duration-500 shadow-[0_0_20px_rgba(37,99,235,0.5)]"
                                style={{ width: progress.total > 0 ? `${((progress.current) / progress.total) * 100}%` : '5%' }}
                            />
                        </div>
                        <div className="flex justify-between w-full max-w-md mb-8">
                            <span className="text-xs font-bold text-slate-400 uppercase">{progress.label}</span>
                            <span className="text-xs font-mono font-bold text-primary-600">{Math.round((progress.current / progress.total) * 100)}%</span>
                        </div>
                        <div className="flex flex-col items-center gap-4">
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400 font-medium">
                                <ArrowPathIcon className="w-4 h-4 animate-spin text-primary-500" />
                                Sequential Batching... Ensuring data integrity
                            </div>
                            <div className="p-4 bg-primary-50 dark:bg-primary-900/10 rounded-xl border border-primary-100 dark:border-primary-900/30 flex items-center gap-3">
                                <div className="w-2 h-2 bg-primary-600 rounded-full animate-ping"></div>
                                <span className="text-[10px] font-bold text-primary-700 dark:text-primary-400 uppercase tracking-widest">Processing Index: {progress.current} of {progress.total}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 5: FINISHED */}
                {step === 'complete' && (
                    <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-8 shadow-inner">
                            <CheckCircleIcon className="w-12 h-12 text-green-600" />
                        </div>
                        <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Ingestion Successful!</h3>
                        <p className="text-slate-500 dark:text-zinc-400 max-w-md mb-12">
                            All your legacy data has been mapped and securely migrated to PracticePro. Your team can now start working on these matters immediately.
                        </p>

                        <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-12">
                            <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700">
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{draftMatters.length}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Matters Created</p>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700">
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{importDocuments ? files.length : 0}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Documents Synced</p>
                            </div>
                        </div>

                        <button
                            onClick={() => closeModal()}
                            className="px-12 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold shadow-2xl hover:scale-105 transition-all"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                )}

            </main>
        </div>
    );
};

export default MatterIngestionWizard;
