
import React from 'react';
import { useUI } from '../../contexts/UIContext';
import { MattersIcon, TasksIcon, ContactsIcon, CalendarIcon, ChevronRightIcon } from '../../constants';
import { formatDueDate } from '../../utils/colorUtils';

const QuickLookModal: React.FC = () => {
  const { closeModal, modalContext, navigateTo } = useUI();
  const item = modalContext?.item;
  const type = modalContext?.type as 'Matter' | 'Task' | 'Contact';

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
          <MattersIcon className="w-6 h-6 text-slate-400" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-700 dark:text-zinc-300 tracking-tight">No item selected.</h3>
          <p className="text-xs text-slate-500">Close this window and try again.</p>
        </div>
        <button
          onClick={() => closeModal()}
          className="px-5 py-2 bg-primary-600 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-primary-700 transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  const handleOpenFull = () => {
    closeModal();
    if (type === 'Matter') navigateTo('matterDetail', item.id);
    if (type === 'Contact') navigateTo('contactDetail', item.id);
  };

  const getIcon = () => {
    switch (type) {
      case 'Matter': return <MattersIcon className="w-8 h-8 text-primary-600 dark:text-primary-300" />;
      case 'Task': return <TasksIcon className="w-8 h-8 text-primary-600 dark:text-primary-300" />;
      case 'Contact': return <ContactsIcon className="w-8 h-8 text-primary-600 dark:text-primary-300" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-5">
      {/* Type badge + Icon */}
      <div className="flex items-start justify-between">
        <div className="p-3 bg-primary-50 dark:bg-primary-900/30 rounded-lg shadow-sm">
          {getIcon()}
        </div>
        <span className="px-3 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-500 text-2xs font-black uppercase tracking-[0.2em] rounded-full">
          Quick Insight
        </span>
      </div>

      {/* Title */}
      <div>
        <p className="text-2xs font-black text-primary-600 dark:text-primary-300 uppercase tracking-widest mb-1">{type} Overview</p>
        <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-100 tracking-tight leading-tight">
          {item.title || item.name}
        </h3>
      </div>

      {/* Content by type */}
      {type === 'Matter' && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-4 bg-slate-50 dark:bg-zinc-900/50 rounded-lg border border-slate-100 dark:border-zinc-800">
          <div>
            <p className="text-2xs font-black text-slate-400 uppercase tracking-widest mb-0.5">CLIENT</p>
            <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">{item.clientName || 'N/A'}</p>
          </div>
          <div>
            <p className="text-2xs font-black text-slate-400 uppercase tracking-widest mb-0.5">CURRENT STAGE</p>
            <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">{item.stage}</p>
          </div>
          <div>
            <p className="text-2xs font-black text-slate-400 uppercase tracking-widest mb-0.5">PRACTICE AREA</p>
            <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">{item.type}</p>
          </div>
          <div>
            <p className="text-2xs font-black text-slate-400 uppercase tracking-widest mb-0.5">FILE REFERENCE</p>
            <p className="text-sm font-black font-mono text-primary-600 dark:text-primary-300">{item.referenceNumber || 'N/A'}</p>
          </div>
        </div>
      )}

      {type === 'Task' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded-md text-2xs font-black uppercase tracking-widest ${item.status === 'done' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'}`}>
              {item.status.replace('_', ' ')}
            </span>
            <span className="px-2 py-0.5 rounded-md text-2xs font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-500">
              Priority: {item.priority}
            </span>
          </div>
          
          <div className="p-4 bg-slate-50 dark:bg-zinc-900/50 rounded-lg border border-slate-100 dark:border-zinc-800">
            <p className="text-2xs font-black text-slate-400 uppercase tracking-widest mb-1">DEADLINE</p>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-zinc-300">
              <CalendarIcon className="w-4 h-4 text-primary-500" />
              {item.dueDate ? formatDueDate(item.dueDate) : 'No due date'}
            </div>
          </div>

          {item.description && (
            <div>
              <p className="text-2xs font-black text-slate-400 uppercase tracking-widest mb-1 px-1">DESCRIPTION</p>
              <div className="p-3 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-lg text-sm text-slate-600 dark:text-zinc-400 italic">
                {item.description}
              </div>
            </div>
          )}
        </div>
      )}

      {type === 'Contact' && (
        <div className="p-4 bg-slate-50 dark:bg-zinc-900/50 rounded-lg border border-slate-100 dark:border-zinc-800">
          <p className="text-2xs font-black text-slate-400 uppercase tracking-widest mb-1">CATEGORY</p>
          <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">{item.category || 'N/A'}</p>
          {item.email && (
            <>
              <p className="text-2xs font-black text-slate-400 uppercase tracking-widest mt-3 mb-1">EMAIL</p>
              <p className="text-sm font-bold text-primary-600 dark:text-primary-300">{item.email}</p>
            </>
          )}
        </div>
      )}

      {/* Open Full View */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800">
        <span className="text-2xs font-bold text-slate-400 uppercase tracking-widest">
          Press <strong className="text-slate-600 dark:text-zinc-400">Enter</strong> for details
        </span>
        <button 
          onClick={handleOpenFull}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-primary-700 shadow-lg hover:shadow-primary-500/20 transition-all active:scale-[0.98]"
        >
          Full View <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default QuickLookModal;
