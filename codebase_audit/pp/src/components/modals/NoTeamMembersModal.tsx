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
      <h3 className="text-xl font-bold">Add Your Team</h3>
      <p className="text-gray-600 dark:text-gray-300">
        You are the only user in your firm. To assign this matter to someone else, you first need to invite them to join your PracticePro workspace.
      </p>
      <div className="pt-4 flex justify-center space-x-2">
        <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
        >
          Cancel
        </button>
        <button 
            type="button" 
            onClick={handleNavigate} 
            className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-sm"
        >
          Go to Settings
        </button>
      </div>
    </div>
  );
};

export default NoTeamMembersModal;