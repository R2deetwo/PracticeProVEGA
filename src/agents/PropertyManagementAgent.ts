import { AppState, User, HistoryEntry } from '../types';
import { renderAriaIdentity } from '../constants/loadPrompts';
import { buildPortfolioRoster, buildActivePropertyContext } from '../utils/portfolioContext';

export const getAtriumSystemInstruction = (
    appState: AppState,
    currentUser: User,
    currentHistoryEntry: HistoryEntry,
    currentTime?: string
): string => {
    // PORTFOLIO AWARENESS (2026-09-12): the AI used to see only aggregate
    // counts + the 5 most recent titles — it could not resolve "which
    // property is the user referring to?" Now the full roster (IDs,
    // addresses, units, tenants, rent/SC) plus the ACTIVE property (when a
    // detail page is open) are injected, sourced from portfolioContext.ts
    // so the system prompt and the query_firm_data tool share ONE view of
    // what is on record.
    let propertySummary = "";
    if (appState.properties && appState.properties.length > 0) {
        const roster = buildPortfolioRoster(appState.properties);
        const active = buildActivePropertyContext(appState.properties, currentHistoryEntry);
        propertySummary = `
    ${active ? active + '\n' : ''}${roster}
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
