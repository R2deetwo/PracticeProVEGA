# 🛠️ Migration Guide: Legal Intelligence Integration

**Objective:** Sync the premium "Legal Intelligence Monitoring" UI from the `ppIndex` standalone app into the main `PracticePro Team` dashboard.

---

## 1. Technical Source & Context
*   **Source App:** `ppIndex` (Repository: `c:\Users\USER\Desktop\ppIndex`)
*   **Target App:** `PracticePro Team` (Main Monitoring App)
*   **Backend:** Shared Convex Database (`keen-jaguar-204.convex.cloud`)

---

## 2. Component Migration (The "Legal Intelligence" Tab)
The UI inside the "Legal Intelligence" tab should no longer be a "Coming Soon" placeholder. It should be replaced with the logic found in:
👉 **File:** `ppIndex/views/LegalIntelligence.tsx`

### Logic to Copy:
1.  **Convex Queries:**
    ```typescript
    const modules = useQuery(api.legalRepo.getAllModules);
    const licenses = useQuery(api.legalRepo.getAllLicenses);
    const usageLogs = useQuery(api.legalRepo.getUsageLogs, {});
    ```
2.  **View Architecture:**
    - **Modules Tab:** Displays the current Legal Rule modules (Lagos Rules, FHC, etc.).
    - **Licenses Tab:** A firm-by-firm list of who has access to which modules.
    - **Live Logs Tab:** Real-time telemetry showing legal research queries as they happen.

---

## 3. UI/UX Consistency
To match the main monitoring app's theme:
*   **Emerald Badges:** Use for "Active" and "Live" status.
*   **Indigo Accents:** Use for "Modules" and "Libraries".
*   **Glassmorphism:** Use the same `bg-white/10` or `bg-slate-900/40` backdrop blur styles used in the `Platform Health` view.

---

## 4. Final Verification
Once integrated, the "Legal Intelligence" tab in the `PracticePro Team` app should show the **Live Telemetry** from the unified backend. If the list is empty, ensure the user has run the seed script:
`npx convex run seedLegalRepo:seed`

---
### Builder Message:
"Maintain the existing navigation of the Team Dashboard, but completely replace the 'Legal Intelligence' view content with the live, connected implementation from `ppIndex`."
