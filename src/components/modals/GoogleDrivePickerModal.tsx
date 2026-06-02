
import React, { useState, useMemo } from 'react';
import { GoogleDriveIcon, SearchIcon, DocumentIcon, PlusIcon, CheckCircleIcon } from '../../constants';
import { formatBytes } from '../../utils/formatting';

// Expanded Mock Data
const MOCK_DRIVE_FILES = [
    { id: 'gdoc_1', name: 'Draft Lease Agreement - 15 Adeola Odeku.gdoc', size: 12045, type: 'doc', updated: '2 days ago' },
    { id: 'gdoc_2', name: 'Client Onboarding Form - Shell.gform', size: 5021, type: 'form', updated: '1 week ago' },
    { id: 'gsheet_1', name: 'Case Expense Tracker 2024.gsheet', size: 25670, type: 'sheet', updated: 'Yesterday' },
    { id: 'pdf_1', name: 'Scanned Court Judgment - Suit 492.pdf', size: 1250430, type: 'pdf', updated: '3 days ago' },
    { id: 'pdf_2', name: 'Evidence Bundle A.pdf', size: 4500100, type: 'pdf', updated: 'Just now' },
    { id: 'img_1', name: 'Site Photo 01.jpg', size: 3400500, type: 'image', updated: '5 days ago' },
    { id: 'folder_1', name: 'Supreme Court Precedents', size: 0, type: 'folder', updated: '1 month ago' },
];

interface GoogleDrivePickerModalProps {
    onSelect: (file: { id: string, name: string, size: number }) => void;
    onClose: () => void;
}

const GoogleDrivePickerModal: React.FC<GoogleDrivePickerModalProps> = ({ onSelect, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const filteredFiles = useMemo(() => {
        if (!searchTerm) return MOCK_DRIVE_FILES;
        return MOCK_DRIVE_FILES.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [searchTerm]);

    const handleSelect = () => {
        const file = MOCK_DRIVE_FILES.find(f => f.id === selectedId);
        if (file) {
            onSelect(file);
        }
    };

    const getIcon = (type: string) => {
        switch(type) {
            case 'folder': return <div className="w-8 h-8 bg-slate-500 rounded flex items-center justify-center text-white text-xs font-bold">DIR</div>;
            case 'pdf': return <div className="w-8 h-8 bg-red-500 rounded flex items-center justify-center text-white text-xs font-bold">PDF</div>;
            case 'sheet': return <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center text-white text-xs font-bold">XLS</div>;
            case 'doc': return <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center text-white text-xs font-bold">DOC</div>;
            default: return <div className="w-8 h-8 bg-blue-400 rounded flex items-center justify-center text-white"><DocumentIcon className="w-4 h-4"/></div>;
        }
    };

    return (
        <div className="flex flex-col h-[600px] w-full">
            {/* Header simulating Google's pop-up style */}
            <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                <GoogleDriveIcon className="w-6 h-6" />
                <h3 className="text-lg font-normal text-slate-700 dark:text-slate-200">Select a file</h3>
            </div>

            {/* Search Bar */}
            <div className="p-4 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-700">
                <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input autoComplete="off" data-lpignore="true"  
                        type="text" 
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                        placeholder="Search Drive..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                </div>
            </div>

            {/* Breadcrumb / Filter Row (Visual only) */}
            <div className="px-4 py-2 flex gap-4 text-xs text-slate-500 border-b border-slate-100 dark:border-zinc-800">
                <span className="font-bold text-slate-800 dark:text-white cursor-pointer">My Drive</span>
                <span className="cursor-pointer hover:underline">Shared with me</span>
                <span className="cursor-pointer hover:underline">Recent</span>
            </div>

            {/* File List */}
            <div className="flex-grow overflow-y-auto p-2 bg-white dark:bg-zinc-900">
                {filteredFiles.length > 0 ? (
                    <div className="grid grid-cols-1 gap-1">
                        {filteredFiles.map(file => (
                            <div 
                                key={file.id}
                                onClick={() => setSelectedId(file.id)}
                                onDoubleClick={() => { setSelectedId(file.id); handleSelect(); }}
                                className={`
                                    flex items-center gap-4 p-3 rounded-md cursor-pointer transition-colors border
                                    ${selectedId === file.id 
                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                                        : 'bg-white dark:bg-zinc-900 border-transparent hover:bg-slate-100 dark:hover:bg-zinc-800'
                                    }
                                `}
                            >
                                {getIcon(file.type)}
                                <div className="flex-grow min-w-0">
                                    <p className={`text-sm font-medium truncate ${selectedId === file.id ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'}`}>
                                        {file.name}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                        <span>{file.type !== 'folder' ? formatBytes(file.size) : 'Folder'}</span>
                                        <span>•</span>
                                        <span>{file.updated}</span>
                                    </div>
                                </div>
                                {selectedId === file.id && <CheckCircleIcon className="w-5 h-5 text-blue-500" />}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <p>No files found.</p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-zinc-700 flex justify-end gap-3 bg-white dark:bg-zinc-800">
                <button 
                    onClick={onClose}
                    className="px-5 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-md transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleSelect}
                    disabled={!selectedId}
                    className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    Select
                </button>
            </div>
        </div>
    );
};

export default GoogleDrivePickerModal;
