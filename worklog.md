---
Task ID: portal-access-dual
Agent: Main
Task: Redesign PortalAccessSettings to show dual portal sections for Komplete/Unified users

Work Log:
- Analyzed current PortalAccessSettings: used `isProperty` to show ONLY one portal type, never both
- For Komplete (unified product), `isProperty=true` meant only "Residents' Portal" shown — wrong for lawyer-first users
- Updated SettingsView nav label for unified to 'Portal Access'
- Completely redesigned PortalAccessSettings with dual sections for Komplete/Unified
- Client Portal (violet, primary) + Residents' Portal (sky, secondary)
- Each section has its own invite button, form, and filtered invite list
- Added contextual hints when no matters/properties exist
- Single-product users (Vega/Atrium) keep existing single-section behavior
- Build succeeded, Convex deployed, pushed to GitHub

Stage Summary:
- PortalAccessSettings now properly shows BOTH portal types for Komplete/Unified
- Client Portal is primary (lawyer-first design), Residents' Portal is secondary
- Both sections always visible with contextual hints, no greyed-out states
- Files changed: SettingsView.tsx, PortalAccessSettings.tsx
