const fs = require('fs');
const glob = require('glob');
const path = require('path');

const DOMAINS = {
    MatterState: ["matters", "contacts", "clientMessages"],
    FinanceState: ["invoices", "expenses", "timeEntries", "chatMessages"],
    ExecutionState: ["tasks", "events", "workflows"],
    DocumentState: ["documents", "notePages", "researchNotebooks", "researchSources"],
    CoreState: ["users", "firmDetails", "notifications", "leads", "firmActivity", "emails", "automationRules", "intakeForms", "archive", "theme", "appMode", "eventTypes", "contactCategories", "checklistTemplates", "documentTemplates", "documentTemplateCategories", "documentCategories", "folderPermissions", "firmNotices", "dismissedConflictIds", "externalCounselInvites", "bookmarkedCaseIds", "savedViews", "legalModules", "noteNotebooks", "isDataLoaded"]
};

// Map each property back to its required state
const propToStateMap = {};
for (const [state, props] of Object.entries(DOMAINS)) {
    for (const prop of props) {
        propToStateMap[prop] = state;
    }
}

// Find all tsx files
const files = glob.sync('src/**/*.tsx', { absolute: true });

let modifyCount = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');

    if (!content.includes('useDataState') && !content.includes('useDataActions')) {
        continue;
    }

    let requiredStates = new Set();
    
    // Scan for property usages
    for (const prop in propToStateMap) {
        if (content.includes(`appState.${prop}`) || (prop === 'isDataLoaded' && content.includes('isDataLoaded'))) {
            requiredStates.add(propToStateMap[prop]);
        }
    }

    if (requiredStates.size === 0) {
        // Default fallback if we can't detect
        requiredStates.add("CoreState");
    }

    // 1. Replace the destructuring hook call
    // e.g. const { appState } = useDataState();
    let hooksReplacement = "";
    if (requiredStates.has("MatterState")) hooksReplacement += "const { matterState } = useMatterState();\n    ";
    if (requiredStates.has("FinanceState")) hooksReplacement += "const { financeState } = useFinanceState();\n    ";
    if (requiredStates.has("ExecutionState")) hooksReplacement += "const { executionState } = useExecutionState();\n    ";
    if (requiredStates.has("DocumentState")) hooksReplacement += "const { documentState } = useDocumentState();\n    ";
    if (requiredStates.has("CoreState")) hooksReplacement += "const { coreState, isDataLoaded } = useCoreState();\n    ";

    content = content.replace(/const\s*{\s*appState\s*(?:,\s*isDataLoaded\s*)?}\s*=\s*useDataState\(\);\s*/g, hooksReplacement);
    content = content.replace(/const\s*{\s*isDataLoaded\s*(?:,\s*appState\s*)?}\s*=\s*useDataState\(\);\s*/g, hooksReplacement);
    content = content.replace(/const\s*state\s*=\s*useDataState\(\);\s*/g, hooksReplacement); // fallback

    // 2. Replace property accesses
    for (const prop in propToStateMap) {
        if (prop !== 'isDataLoaded') {
            const stateName = propToStateMap[prop];
            const stateVarMap = {
                "MatterState": "matterState",
                "FinanceState": "financeState",
                "ExecutionState": "executionState",
                "DocumentState": "documentState",
                "CoreState": "coreState"
            };
            const targetState = stateVarMap[stateName];
            content = content.replace(new RegExp(`appState\\.${prop}`, 'g'), `${targetState}.${prop}`);
        }
    }
    
    // We'll leave `useDataActions` pointing to CoreState for now to reduce blast radius
    // Since actions don't cause widespread re-renders natively, this is safe.

    // 3. Fix Imports
    const importRegex = /import\s+{([^}]*)}\s+from\s+['"](?:\.\.\/)+contexts\/DataContext['"];/;
    const match = content.match(importRegex);
    if (match) {
        let replacementImports = "";
        const depth = (match[0].match(/\.\.\//g) || []).length;
        const relativePath = "../".repeat(depth) + "contexts/";
        
        if (requiredStates.has("MatterState")) replacementImports += `import { useMatterState } from '${relativePath}MatterContext';\n`;
        if (requiredStates.has("FinanceState")) replacementImports += `import { useFinanceState } from '${relativePath}FinanceContext';\n`;
        if (requiredStates.has("ExecutionState")) replacementImports += `import { useExecutionState } from '${relativePath}ExecutionContext';\n`;
        if (requiredStates.has("DocumentState")) replacementImports += `import { useDocumentState } from '${relativePath}DocumentContext';\n`;
        if (requiredStates.has("CoreState")) replacementImports += `import { useCoreState } from '${relativePath}CoreContext';\n`;
        
        // Preserve DataActions
        if (content.includes('useDataActions')) {
            replacementImports += `import { useDataActions } from '${relativePath}DataContext';\n`;
        }

        content = content.replace(importRegex, replacementImports.trim());
    }

    fs.writeFileSync(file, content, 'utf8');
    modifyCount++;
}

console.log(`Modified ${modifyCount} files.`);
