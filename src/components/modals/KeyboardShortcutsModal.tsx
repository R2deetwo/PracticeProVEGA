
import React from 'react';
import { useUI } from '../../contexts/UIContext';

interface ShortcutItemProps {
 keys: string[];
 description: string;
}

const ShortcutItem: React.FC<ShortcutItemProps> = ({ keys, description }) => (
 <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-zinc-800 last:border-0">
  <span className="text-sm text-gray-700 dark:text-zinc-300">{description}</span>
  <div className="flex gap-1">
   {keys.map((key, index) => (
    <React.Fragment key={index}>
     <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md">
      {key}
     </kbd>
     {index < keys.length - 1 && <span className="text-xs text-gray-400 self-center">+</span>}
    </React.Fragment>
   ))}
  </div>
 </div>
);

const KeyboardShortcutsModal: React.FC = () => {
 const { closeModal } = useUI();

 const categories = [
  {
   title: "General",
   shortcuts: [
    { keys: ["?", "Shift", "/"], description: "Show keyboard shortcuts" },
    { keys: ["Cmd", "K"], description: "Open Command Palette" },
    { keys: ["Esc"], description: "Close modal / panel" },
   ]
  },
  {
   title: "Navigation",
   shortcuts: [
    { keys: ["g", "h"], description: "Go to Home (Dashboard)" }, // Future implementation
    { keys: ["g", "m"], description: "Go to Matters" }, // Future implementation
    { keys: ["g", "t"], description: "Go to Tasks" }, // Future implementation
   ]
  },
  {
   title: "Actions",
   shortcuts: [
    { keys: ["c"], description: "Create new item (Global)" }, // Future implementation
    { keys: ["Cmd", "Enter"], description: "Submit form / Send message" },
   ]
  }
 ];

 return (
  <div className="space-y-6">
   {categories.map((category, index) => (
    <div key={index}>
     <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{category.title}</h3>
     <div className="bg-gray-50 dark:bg-zinc-800/50 dark:bg-zinc-800 rounded-lg p-3 border border-gray-200 dark:border-zinc-700">
      {category.shortcuts.map((shortcut, sIndex) => (
       <ShortcutItem key={sIndex} {...shortcut} />
      ))}
     </div>
    </div>
   ))}
   
   <div className="pt-4 flex justify-end">
    <button 
     onClick={() => closeModal()} 
     className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 shadow-sm"
    >
     Got it
    </button>
   </div>
  </div>
 );
};

export default KeyboardShortcutsModal;
