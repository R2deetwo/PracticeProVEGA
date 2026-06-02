# Top Prompt: Admin Dashboard Evolution (ppIndex)

**Objective:** Transform the PracticePro Admin Dashboard (`ppIndex`) into a premium, mission-critical interface that mirrors the high-end aesthetic of the primary app. Integrate the new "Legal Intelligence Monitoring" system as a core feature.

## 1. Design Language & Premium UX
*   **Consistency:** Mirror the main app's premium dark mode, glassmorphism, and vibrant accent colors (Emerald, Primary Blue, Amber).
*   **Responsive Layout:** Ensure the sidebar and main content areas use smooth transitions and unified spacing.
*   **Micro-Animations:** Add subtle entrance animations for data cards and transitions between views.

## 2. Core Feature: Legal Intelligence Monitoring
*   **Module Tracking:** Implement a "Legal Intelligence" view derived from the `LegalIntelligence.tsx` component.
*   **Data Sources:** Query the primary PracticePro Convex database (`legal_modules`, `statutes`, `firm_licenses`).
*   **Telemetry Logs:** Show a real-time list of `module_usage_logs` so admins can see which firms are currently using which procedural rules.
*   **License Management:** Build a simplified interface for admins to "Grant" or "Revoke" module licenses for specific Law Firms (`firm_licenses`).

## 3. Data Integration (Convex Unified Architecture)
*   **Single Source of Truth:** Use the shared `keen-jaguar-204.convex.cloud` backend.
*   **Metric Dashboard:** The main landing page of `ppIndex` should show a summary of "Total Legal Queries," "Active FIRMs," and "Module Revenue."
*   **Search & Filtering:** Admins must be able to search for specific modules or filter usage logs by firm.

## 4. UI/UX Components
*   **Analytics Cards:** Use the same premium `StatCard` style from the primary app.
*   **Usage Graphs:** If possible, include a chart showing the trend of AI and Legal rule usage across all firms.
*   **Admin-Only Actions:** Ensure that "Module Management" actions are highly visible and easy to use.

---
**Builder Instruction:** "Maintain the existing structure of `ppIndex` but lift the visual quality to 'Enterprise Grade'. Every page must feel fast, informative, and visually aligned with the main PracticePro ecosystem."
