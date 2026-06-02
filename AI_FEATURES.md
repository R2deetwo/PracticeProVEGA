# PracticePro AI & Automation Features

This document outlines the AI-powered features integrated into the PracticePro application, primarily leveraging the Google Gemini API. These features are designed to automate tasks, provide insights, and enhance legal practice management.

## 1. ALOA™ (Advanced Legal Office Assistant)

ALOA is the central AI assistant, accessible via the floating action button and a full-screen interface.

### a. ALOA Live Chat (Voice & Text)
- **Trigger:** Clicking the ALOA FAB and then the microphone icon.
- **Functionality:** Initiates a real-time, low-latency voice conversation with the Gemini `gemini-2.5-flash-native-audio-preview-09-2025` model.
- **Features:**
    - **Voice Streaming:** Captures microphone audio and streams it to the API.
    - **Audio Playback:** Receives and plays back generated audio responses from the model.
    - **Live Transcription:** Displays both user input and model output as text in real-time.
    - **Function Calling:** ALOA can understand commands and interact with the application by calling predefined functions. This allows it to:
        - `navigateTo`: Navigate to any view in the app (e.g., "Go to my tasks").
        - `navigateToAndHighlight`: Navigate to a view and visually highlight a specific item (e.g., "Show me my most urgent matter").
        - `openModal` / `fillForm`: Open forms to create new items like matters or contacts, and pre-fill them with information from the conversation (e.g., "Create a new matter for client X titled Y").
        - `analyzeDocumentById`: Trigger AI analysis on a specific document.
        - `determineJurisdictionForMatter`: Run jurisdictional analysis on a specific matter.
- **Implementation:** `components/aloa/AloaChat.tsx`

### b. ALOA Text Chat & Daily Briefing
- **Trigger:** Opening the ALOA interface.
- **Functionality:** On the first interaction of the day, ALOA provides a "Daily Intelligence Briefing" by summarizing critical deadlines, overdue tasks, and financial opportunities. Subsequent interactions are standard text-based conversations.
- **Implementation:** `services/geminiService.ts` (system prompt builder) and `/api/aloa.ts` (server-side stream handler).

## 2. Document Intelligence (ALDIA)
- **Trigger:** Uploading a new document (PDF, TXT, PNG, JPG).
- **Functionality:** When a document is uploaded, it's sent to a backend API that uses the Gemini `gemini-2.5-flash` model for a comprehensive analysis.
- **Features:**
    - **AI Summary:** Generates a concise summary of the document's content.
    - **Risk Analysis:** Assigns scores (1-10) for Legal, Commercial, Compliance, and Operational risks, providing an overall score and justification.
    - **Metadata Extraction:** Pulls out key information like contract type, parties involved, effective dates, and governing law.
- **Implementation:**
    - Triggered in: `contexts/StateProvider.tsx` (`handleAddDocumentAndAnalyze`)
    - Server-side logic: `/api/analyzeDocument.ts`
    - Results displayed in: `components/details/DocumentDetailView.tsx`

## 3. Data Protection Analysis
- **Trigger:** Part of the document intelligence pipeline when a new document is uploaded.
- **Functionality:** Scans document content for Personally Identifiable Information (PII) like NIN, BVN, names, and addresses. It assesses the risk level and provides recommendations based on the Nigeria Data Protection Act (NDPA).
- **Implementation:**
    - Triggered in: `contexts/StateProvider.tsx`
    - Server-side logic: `/api/analyzeDataProtection.ts`
    - Results displayed in: `components/details/DocumentDetailView.tsx`

## 4. RPC Guidance Agent
- **Trigger:** Automatically after ALDIA generates a document summary.
- **Functionality:** Reviews the AI-generated summary for potential ethical issues, such as overly confident language that could be misconstrued as final legal advice. It provides a status ('approved' or 'warning') and a commentary reminding the lawyer of their duty to verify all AI-generated content.
- **Implementation:**
    - Triggered in: `contexts/StateProvider.tsx`
    - Server-side logic: `/api/reviewSummary.ts`
    - Results displayed in: `components/details/DocumentDetailView.tsx`

## 5. Nigerian Legal Jurisdiction Agent
- **Trigger:** Automatically when a new "Civil Litigation" matter is created.
- **Functionality:** Analyzes the matter details (title, type) to suggest the appropriate court with jurisdiction (Federal High Court vs. State High Court) based on Nigerian constitutional law. It provides a recommendation, reasoning, and a confidence score.
- **Implementation:**
    - Triggered in: `contexts/StateProvider.tsx` (`onAddMatter`)
    - Server-side logic: `/api/determineJurisdiction.ts`
    - Results displayed in: `components/details/MatterDetailView.tsx` as a `JurisdictionalAnalysisTip`.

## 6. Nigerian Court Rules Agent (Filing Deadlines)
- **Trigger:** Manually from the "Event" form or an existing event's detail view when the event is a procedural step (e.g., service of a writ).
- **Functionality:** Calculates the next filing deadline based on the process served, the service date, and the relevant court's civil procedure rules (e.g., Lagos High Court, FHC). It then automatically creates a high-priority task with the calculated due date.
- **Implementation:**
    - Triggered in: `contexts/StateProvider.tsx` (`handleCalculateAndCreateDeadlineTask`)
    - Server-side logic: `/api/calculateFilingDeadline.ts`
    - Results displayed in: A new task and a toast notification.

## 7. AI Feature Management
- **Trigger:** User interaction in `Settings > Firm Settings`.
- **Functionality:** Admins can enable or disable all AI features globally for the firm. They can also customize the personality of the ALOA assistant.
- **Implementation:** `components/settings/FirmSettings.tsx`
