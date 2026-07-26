import React from 'react';

interface NoTeamMembersModalProps {
 onNavigate: () => void;
 onClose: () => void;
}

const NoTeamMembersModal: React.FC<NoTeamMembersModalProps> = ({ onNavigate, onClose }) => {
  
 const handleNavigate = () => {
  onNavigate();
  onClose();
 };

 return (
  <div className="space-y-4 text-center">
   <h3 className="text-xl font-bold text-slate-900 dark:text-white">Add Your Team</h3>
   <p className="text-gray-600 dark:text-zinc-400">
    You are the only user in your firm. To assign this matter to someone else, you first need to invite them to join your PracticePro workspace.
   </p>
   <div className="pt-4 flex justify-center space-x-2">
    <button 
      type="button" 
      onClick={onClose} 
      className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
    >
     Cancel
    </button>
    <button 
      type="button" 
      onClick={handleNavigate} 
      className="px-5 py-2 bg-primary-600 text-white rounded-xl font-bold text-sm hover:bg-primary-700 transition-colors shadow-md"
    >
     Go to Settings
    </button>
   </div>
  </div>
 );
};

export default NoTeamMembersModal;