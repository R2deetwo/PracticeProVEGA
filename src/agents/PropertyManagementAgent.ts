import { AppState, User, HistoryEntry } from '../types';
import { renderAriaIdentity } from '../constants/loadPrompts';

export const getAtriumSystemInstruction = (
    appState: AppState,
    currentUser: User,
    currentHistoryEntry: HistoryEntry,
    currentTime?: string
): string => {
    let propertySummary = "";
    if (appState.properties && appState.properties.length > 0) {
        propertySummary = `
    CURRENT PROPERTY PORTFOLIO SUMMARY:
    Total Properties: ${appState.properties.length}
    Occupied / Vacant Breakdown: ${appState.properties.filter((p: any) => p.status === 'Occupied').length} Occupied, ${appState.properties.filter((p: any) => p.status === 'Vacant').length} Vacant
    Recent Properties: ${appState.properties.slice(0, 5).map(p => `- ${(p as any).title || p.address || 'Unnamed'} (Status: ${p.status || 'Unknown'})`).join('\n    ')}
        `;
    }

    // ICM: ARIA identity is sourced from ai/prompts/02-aria-property-identity.md
    // via Vite ?raw import. Edit the markdown file to change the identity.
    return renderAriaIdentity({
        userName: currentUser.name,
        userRole: currentUser.role,
        currentView: currentHistoryEntry.view,
        selectedId: currentHistoryEntry.selectedId || 'None',
        currentTime: currentTime || new Date().toISOString(),
        propertySummary,
    });
};
