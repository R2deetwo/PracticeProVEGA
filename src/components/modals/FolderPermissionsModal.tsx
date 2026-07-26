import React, { useState } from 'react';
import { DocumentCategory, UserRole } from '../../types';

interface FolderPermissionsModalProps {
 folder: DocumentCategory;
 allRoles: UserRole[];
 currentPermissions: UserRole[];
 onUpdatePermissions: (folderId: string, roles: UserRole[]) => void;
 onClose: () => void;
}

const FolderPermissionsModal: React.FC<FolderPermissionsModalProps> = ({ folder, allRoles, currentPermissions, onUpdatePermissions, onClose }) => {
 const [selectedRoles, setSelectedRoles] = useState<Set<UserRole>>(new Set(currentPermissions));

 const handleToggle = (role: UserRole) => {
  setSelectedRoles(prev => {
   const newSet = new Set(prev);
   if (newSet.has(role)) {
    newSet.delete(role);
   } else {
    newSet.add(role);
   }
   return newSet;
  });
 };

 const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  onUpdatePermissions(folder.id, Array.from(selectedRoles));
  onClose();
 };

 return (
  <form onSubmit={handleSubmit} className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Grant Access to:</label>
      <div className="space-y-2 p-3 border border-gray-200 dark:border-zinc-700 rounded-md">
      {allRoles.map(role => (
        <label key={role} className="flex items-center space-x-3 cursor-pointer">
          <input autoComplete="off" data-lpignore="true" 
            type="checkbox"
            checked={selectedRoles.has(role)}
            onChange={() => handleToggle(role)}
            className="h-4 w-4 rounded border-gray-300 dark:border-zinc-700 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-900 dark:text-white">{role}</span>
        </label>
      ))}
      </div>
    </div>
    
    <p className="text-xs text-gray-500">
      If no roles are selected, this folder and its contents will be visible only to Admins. 
      Permissions apply to all sub-folders unless they have their own specific settings.
    </p>

    <div className="pt-4 flex justify-end space-x-2">
      <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">
      Cancel
      </button>
      <button type="submit" className="px-5 py-2 bg-primary-600 text-white rounded-xl font-bold text-sm hover:bg-primary-700 transition-colors shadow-md">
      Save Permissions
      </button>
    </div>
  </form>
 );
};

export default FolderPermissionsModal;