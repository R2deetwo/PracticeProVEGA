
/**
 * Pure functions for legal matter processing.
 */

export const formatCourtReference = (suitNumber: string, court: string): string => {
    if (!suitNumber) return 'Unassigned';
    return `${suitNumber} (${court})`;
};

export const getStageColor = (stage: string): string => {
    const stageLower = stage.toLowerCase();
    if (stageLower.includes('closed') || stageLower.includes('done')) return '#10b981'; // Green
    if (stageLower.includes('review') || stageLower.includes('pending')) return '#f59e0b'; // Amber
    if (stageLower.includes('urgent') || stageLower.includes('overdue')) return '#ef4444'; // Red
    return '#3b82f6'; // Blue
};
