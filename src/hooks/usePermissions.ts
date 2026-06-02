
import * as React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Task, Matter, UserRole, SubscriptionPlan } from '../types';
import { useDataState } from '../contexts/DataContext';

export const usePermissions = () => {
  const { currentUser, appMode } = useAuth();
  const { appState } = useDataState();
  const currentPlan = appState.firmDetails.subscriptionPlan || SubscriptionPlan.Core;
  
  const permissions = React.useMemo(() => {
    const allFalse = {
        canViewBilling: false,
        canViewArchive: false,
        canViewMessaging: false,
        canManageUsers: false,
        canManageFirmDetails: false,
        canManageTemplates: false,
        canManageCategories: false,
        canClearDoneTasks: false,
        canArchiveMatters: false,
        canDeleteContacts: false,
        canDeleteDocuments: false,
        canEditTask: (task: Task) => false,
        canManageMatterBilling: (matter: Matter) => false,
        canManageExternalCounsel: (matter: Matter) => false,
        shouldShowTestControls: false,
    };
      
    if (!currentUser) {
      return allFalse;
    }
    
    if (currentUser.role === UserRole.Client) {
        return allFalse;
    }

    if (currentUser.role === UserRole.ExternalCounsel) {
        return {
            ...allFalse,
            // External counsel can view messaging within their assigned matter
            canViewMessaging: true,
        };
    }

    const isSolo = appMode === 'solo';
    const isAdmin = currentUser.role === UserRole.Admin;
    // const isProOrAbove = currentPlan !== SubscriptionPlan.Core; // Unused but kept for logic ref

    // Standard Staff (Lawyer/Associate or Paralegal) Permissions
    const isLawyer = currentUser.role === UserRole.Lawyer;
    const isParalegal = currentUser.role === UserRole.Paralegal;

    const canManageMatterBilling = (matter: Matter): boolean => {
        if (!matter) return false;
        if (isSolo || isAdmin) return true;
        // Lawyers assigned to matter can typically bill
        return (isLawyer && matter.assignedUsers.includes(currentUser.id)) || (matter.billingAccess?.includes(currentUser.id) || false);
    };

    const canManageExternalCounsel = (matter: Matter): boolean => {
        if (!matter) return false;
        if (isSolo || isAdmin) return true;
        // Only assigned Lawyers can invite external counsel
        return isLawyer && matter.assignedUsers.includes(currentUser.id);
    };

    return {
      // View-level permissions
      canViewBilling: isSolo || isAdmin, // Only Admin (Head of Chambers) sees full firm billing/profitability
      canViewArchive: isSolo || isAdmin,
      canViewMessaging: !isSolo, // Everyone sees messaging
      
      // High-level action permissions
      // ONLY ADMIN can manage firm-level settings/users
      canManageUsers: !isSolo && isAdmin,
      canManageFirmDetails: isSolo || isAdmin,
      
      // Templates/Categories: Admin only for firm-wide standards
      canManageTemplates: isSolo || isAdmin,
      canManageCategories: isSolo || isAdmin,
      
      canClearDoneTasks: isSolo || isAdmin, // Bulk delete is admin
      
      // Destructive actions - STRICTLY ADMIN (Head of Chambers)
      // Associates/Lawyers cannot permanently delete matters/contacts to preserve firm history
      canArchiveMatters: isSolo || isAdmin,
      canDeleteContacts: isSolo || isAdmin,
      canDeleteDocuments: isSolo || isAdmin, 

      // Item-specific edit permissions
      // Staff can edit tasks they created or are assigned to, or if they are admin
      canEditTask: (task: Task) => isSolo || isAdmin || task.assignedUsers.includes(currentUser.id) || currentUser.id === task.creatorId,
      canManageMatterBilling,
      canManageExternalCounsel,
    };
  }, [currentUser, appMode, currentPlan]);

  return permissions;
};
