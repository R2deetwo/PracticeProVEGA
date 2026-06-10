const fs = require('fs');
const glob = require('glob');

// Files that still use `useDataState` hook internally (not just receiving appState as a prop)
// We'll fix these by looking for the pattern { appState } = useDataState()
const files = glob.sync('src/**/*.tsx', { absolute: true });

const DOMAINS = {
    MatterState: ["matters", "contacts", "clientMessages"],
    FinanceState: ["invoices", "expenses", "timeEntries", "chatMessages"],
    ExecutionState: ["tasks", "events", "workflows"],
    DocumentState: ["documents", "notePages", "researchNotebooks", "researchSources"],
    CoreState: ["users", "firmDetails", "notifications", "leads", "firmActivity", "emails", "automationRules", "intakeForms", "archive", "theme", "appMode", "eventTypes", "contactCategories", "checklistTemplates", "documentTemplates", "documentTemplateCategories", "documentCategories", "folderPermissions", "firmNotices", "dismissedConflictIds", "externalCounselInvites", "bookmarkedCaseIds", "savedViews", "legalModules", "noteNotebooks", "chatConversations", "researchMessages", "researchAnalysisResults", "isDataLoaded"]
};

const propToStateMap = {};
for (const [state, props] of Object.entries(DOMAINS)) {
    for (const prop of props) {
        propToStateMap[prop] = state;
    }
}

const stateVarMap = {
    "MatterState": "matterState",
    "FinanceState": "financeState",
    "ExecutionState": "executionState",
    "DocumentState": "documentState",
    "CoreState": "coreState"
};

let count = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');

    // Only touch files that still have the old pattern (not already migrated)
    // We look for files that have appState.xxx still referencing old state
    // OR still have useDataState() call

    // 1. Find shorthand property references: { appState } used somewhere
    if (!content.includes('appState') && !content.includes('useDataState')) continue;
    
    let modified = false;
    
    // Replace any remaining shorthand { appState } in objects passed to functions
    // e.g. { appState, action } -> use the merged state
    // For now, just fix property accesses: appState.matters -> matterState.matters
    
    for (const [prop, domain] of Object.entries(propToStateMap)) {
        const targetState = stateVarMap[domain];
        if (prop !== 'isDataLoaded') {
            const regex = new RegExp(`appState\\.${prop}`, 'g');
            if (regex.test(content)) {
                content = content.replace(regex, `${targetState}.${prop}`);
                modified = true;
            }
        }
    }
    
    if (modified) {
        fs.writeFileSync(file, content, 'utf8');
        count++;
        console.log(`Fixed appState.xxx refs in: ${file.replace(process.cwd(), '')}`);
    }
}

console.log(`\nDone. Fixed ${count} files.`);
