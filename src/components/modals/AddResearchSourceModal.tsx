import React, { useState, useRef } from 'react';
import { FileDetails } from '../../types';
import { UploadIcon, DocumentLinkIcon, GlobeIcon, ClipboardListIcon, SaveIcon, XIcon, PlusIcon, InfoIcon, SearchIcon, GavelIconLarge } from '../../constants';
import { FileText as FileTextIcon } from 'lucide-react';
import { formatBytes } from '../../utils/formatting';
import { inputClassic } from '../../utils/formStyles';

interface AddResearchSourceModalProps {
  notebookId: string;
  onAdd: (notebookId: string, sourceData: { name: string, type: 'pdf' | 'text' | 'web', content: string, file?: FileDetails }) => void;
  onClose: () => void;
}

const TabButton: React.FC<{ label: string; icon: React.ReactNode; isActive: boolean; onClick: () => void }> = ({ label, icon, isActive, onClick }) => (
  <button
    onClick={onClick}
    type="button"
    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${isActive
        ? 'bg-white text-primary-600 shadow-sm ring-1 ring-slate-200'
        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
      }`}
  >
    {icon}
    {label}
  </button>
);

const AddResearchSourceModal: React.FC<AddResearchSourceModalProps> = ({ notebookId, onAdd, onClose }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'website' | 'paste'>('upload');
  const [name, setName] = useState(''); // Only used for paste/website
  const [textContent, setTextContent] = useState('');
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files) as File[];
      // Filter
      const validFiles = selectedFiles.filter(f => f.type === 'application/pdf' || f.type === 'text/plain');
      if (validFiles.length < selectedFiles.length) {
        setError('Some files were ignored. Only PDF and Text files are supported.');
      } else {
        setError(null);
      }
      setFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);

    if (activeTab === 'website') {
      if (!url.trim()) {
        setError('Please enter a valid URL.');
        setProcessing(false);
        return;
      }
      onAdd(notebookId, {
        name: name.trim() || new URL(url).hostname,
        type: 'web',
        content: `[Content scraped from ${url}]`,
      });
      onClose();

    } else if (activeTab === 'upload') {
      if (files.length === 0) {
        setError('Please select at least one file.');
        setProcessing(false);
        return;
      }

      // Process files sequentially
      for (const file of files) {
        await new Promise<void>((resolve) => {
          if (file.type === 'text/plain') {
            // For text files, read as text directly
            const textReader = new FileReader();
            textReader.onload = () => {
              const textContent = textReader.result as string;
              onAdd(notebookId, {
                name: file.name,
                type: 'text',
                content: textContent,
              });
              resolve();
            };
            textReader.readAsText(file);
          } else {
            // For PDFs: store as base64 dataUrl — the AI will read it natively
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              const fileDetails: FileDetails = {
                name: file.name,
                type: file.type,
                size: file.size,
                filePath: `research/${notebookId}/${file.name}`,
                dataUrl: dataUrl
              };
              // Store the raw base64 as content so the AI can read it;
              // content is marked with prefix so DataProvider knows to pass it as inline base64
              onAdd(notebookId, {
                name: file.name,
                type: 'pdf',
                content: `__PDF_BASE64__${dataUrl}`,
                file: fileDetails
              });
              resolve();
            };
            reader.readAsDataURL(file);
          }
        });
      }
      onClose();

    } else {
      if (!textContent.trim()) {
        setError('Please paste some content.');
        setProcessing(false);
        return;
      }
      if (!name.trim()) {
        setError('Please provide a name for this source.');
        setProcessing(false);
        return;
      }
      onAdd(notebookId, {
        name: name.trim(),
        type: 'text',
        content: textContent
      });
      onClose();
    }
  };

  const commonInputClass = inputClassic;

  const Guidance: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
    <div className="flex gap-2 items-start p-3 bg-blue-50 border border-blue-100 rounded-lg">
      <div className="mt-0.5 text-blue-500">{icon}</div>
      <p className="text-2xs font-medium text-blue-800 leading-relaxed">{text}</p>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
        <TabButton label="Upload" icon={<UploadIcon className="w-4 h-4" />} isActive={activeTab === 'upload'} onClick={() => setActiveTab('upload')} />
        <TabButton label="Website" icon={<GlobeIcon className="w-4 h-4" />} isActive={activeTab === 'website'} onClick={() => setActiveTab('website')} />
        <TabButton label="Paste Text" icon={<ClipboardListIcon className="w-4 h-4" />} isActive={activeTab === 'paste'} onClick={() => setActiveTab('paste')} />
      </div>

      {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">{error}</div>}

      {activeTab === 'website' && (
        <div className="space-y-4 animate-fade-in">
          <Guidance icon={<GlobeIcon className="w-3.5 h-3.5" />} text="Enter a public URL with text-based content. The AI will extract key legal indices and context for your notebook." />
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Website URL</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <GlobeIcon className="w-5 h-5" />
              </div>
              <input autoComplete="off" data-lpignore="true" 
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                className={`${commonInputClass} pl-10`}
                placeholder="https://example.com/article"
                required
                autoFocus
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source Name (Optional)</label>
            <input autoComplete="off" data-lpignore="true" type="text" value={name} onChange={e => setName(e.target.value)} className={commonInputClass} placeholder="e.g., TechCrunch Article" />
          </div>
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="space-y-4 animate-fade-in">
          <Guidance icon={<UploadIcon className="w-3.5 h-3.5" />} text="PDF and Text files only. Ensure documents are clearly legible for optimal AI extraction. Limit of 20 sources per notebook." />
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
          >
            <input autoComplete="off" data-lpignore="true" type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".pdf,.txt" multiple />
            <div className="flex flex-col items-center">
              <div className="p-3 bg-slate-100 rounded-full mb-3 group-hover:scale-110 transition-transform">
                <UploadIcon className="w-6 h-6 text-slate-400" />
              </div>
              <p className="font-semibold text-slate-700 text-sm">Click to upload files</p>
              <p className="text-2xs text-slate-500 mt-1 uppercase tracking-wider font-bold">PDF / TXT (Max 10MB each)</p>
            </div>
          </div>

          {files.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
              {files.map((file, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-200">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <DocumentLinkIcon className="w-4 h-4 text-blue-500" />
                    <span className="text-sm truncate font-medium">{file.name}</span>
                    <span className="text-xs text-slate-400">({formatBytes(file.size)})</span>
                  </div>
                  <button type="button" onClick={() => removeFile(idx)} className="text-slate-400 hover:text-red-500 p-1">&times;</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'paste' && (
        <div className="space-y-4 animate-fade-in">
          <Guidance icon={<ClipboardListIcon className="w-3.5 h-3.5" />} text="Paste emails, case notes, or transcripts. The AI can analyze large text blocks (up to 50k characters)." />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source Name</label>
            <input autoComplete="off" data-lpignore="true" type="text" value={name} onChange={e => setName(e.target.value)} className={commonInputClass} placeholder="e.g., Copied Email Content" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea
              value={textContent}
              onChange={e => setTextContent(e.target.value)}
              className={`${commonInputClass} font-mono text-sm`}
              rows={8}
              placeholder="Paste text here..."
              autoFocus
            />
          </div>
        </div>
      )}

      <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
        <button type="button" onClick={onClose} className="px-5 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
        <button
          type="submit"
          disabled={processing}
          className="px-5 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 shadow-sm transition-colors disabled:opacity-50"
        >
          {processing ? 'Processing...' : (activeTab === 'upload' && files.length > 0 ? `Add ${files.length} Sources` : 'Add Source')}
        </button>
      </div>
    </form>
  );
};

export default AddResearchSourceModal;
