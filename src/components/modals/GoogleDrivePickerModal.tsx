
import React, { useState } from 'react';
import { GoogleDriveIcon, SearchIcon } from '../../constants';

interface GoogleDrivePickerModalProps {
  onSelect: (file: { id: string, name: string, size: number }) => void;
  onClose: () => void;
}

const GoogleDrivePickerModal: React.FC<GoogleDrivePickerModalProps> = ({ onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="flex flex-col h-full max-h-[60vh]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <GoogleDriveIcon className="w-6 h-6" />
        <h3 className="text-lg font-bold text-slate-700">Import from Google Drive</h3>
      </div>

      {/* Search Bar */}
      <div className="relative py-4">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input autoComplete="off" data-lpignore="true"
          type="text"
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
          placeholder="Search your Drive..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
          disabled
        />
      </div>

      {/* Coming Soon State — honest placeholder instead of mock data */}
      <div className="flex-grow flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
          <GoogleDriveIcon className="w-8 h-8 text-slate-400" />
        </div>
        <h4 className="text-base font-bold text-slate-700 mb-2">Google Drive Integration</h4>
        <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
          Connect your Google Drive to import files directly. This integration is coming soon.
        </p>
        <p className="text-xs text-slate-400 mt-3">
          For now, download files from Drive and upload them via the document manager.
        </p>
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-slate-200 flex justify-end">
        <button
          onClick={onClose}
          className="px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default GoogleDrivePickerModal;
