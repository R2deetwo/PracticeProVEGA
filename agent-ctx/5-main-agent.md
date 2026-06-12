# Task 5: Fix KOMPLETE Variant Signing Context Issue

## Agent: Main Agent

## Summary
Fixed the KOMPLETE (unified) variant signing context issue where documents and communications were always signed as "Lawyer/Solicitor" regardless of the user's actual role. Also added Mini ALOA integration for placeholder context gathering.

## Changes Made

### 1. ProductContext.tsx
- Added `SignerContext` interface (signerName, signerTitle, userRole)
- Added `signerContext` to ProductContextValue — only populated for KOMPLETE (isUnified)
- signerTitle derived from UserRole enum or custom firmDetails.settings.signerTitle
- Added `useSignerContext()` hook

### 2. aiService.ts
- Updated `streamDraft` context to accept optional `signerContext`

### 3. geminiService.ts
- Imported SignerContext and getAloaProtocol
- Updated `streamDraft` to build role-aware context based on signerContext
- KOMPLETE mode: uses user's actual name/title, never assumes "Lawyer"
- VEGA/ATRIUM: preserves existing "Lawyer/Solicitor" behavior

### 4. aloaPrompts.ts
- Preserved original ALOA_PRECISION_PROTOCOL (VEGA/ATRIUM)
- Added ALOA_KOMPLETE_PROTOCOL — context-aware, doesn't assume user role
- Added getAloaProtocol() helper function

### 5. DraftProEditor.tsx
- Imported useSignerContext, useAloa
- Passes signerContext to streamDraft
- Added AI Help feature: "Ask ARIA" button per placeholder
- Opens MiniAloa with context + inline AI suggestion via streamMessage
- AI suggestions appear as defaultValues with visual indicators

## Verification
- TypeScript compilation: No errors in modified files
- VEGA/ATRIUM behavior: Completely unchanged (signerContext is null)
