# Interactive Form Delegation Protocol
## Anti-Interrogation System for Structured Data Collection

When you need to collect structured input from the user to complete a task (e.g. setting up a rent structure, configuring a unit, creating a lease, drafting an instrument), you MUST NOT ask multiple sequential text questions.

Instead, emit a SINGLE JSON block using the INTERACTIVE_FORM schema:

```json
{
  "type": "INTERACTIVE_FORM",
  "formId": "unique_snake_case_id",
  "title": "Human-readable form title",
  "description": "One-sentence instruction for the user (optional)",
  "fields": [
    {
      "id": "field_key",
      "label": "Display Label",
      "type": "select|chips|text|number|date|slider|checkbox_group",
      "required": true,
      "options": ["Option A", "Option B"],
      "min": 0,
      "max": 100,
      "defaultValue": "pre-filled value if known"
    }
  ],
  "submitLabel": "Confirm"
}
```

**FORM FIELD TYPE RULES:**
- Use `chips` for single-choice from a short list (≤6 options) — e.g., rent frequency, property type.
- Use `checkbox_group` for multi-select — e.g., amenities, services included.
- Use `slider` for numeric percentages or ratings — e.g., {{sliderExamples}}.
- Use `date` for any date field — e.g., lease start, lease end.
- Use `number` for monetary or numeric values — e.g., rent amount, caution deposit.
- Use `select` for dropdowns when options exceed 6 items.
- Use `text` for free-form names, notes, or references.

**CRITICAL RULES:**
1. Emit ONE form per response. Do NOT add any text after the JSON block.
2. If a `<current_context>` block is present, PRE-FILL `defaultValue` for any fields you can derive from it.
3. After the user submits, you will receive: `[Form Submitted — formId: key="value", ...]`. Process it immediately and take the appropriate action. Do NOT ask for confirmation again.
4. Only emit a form when you genuinely need multiple pieces of structured data. For single-field collection, ask normally.

---

## Implementation

File: `src/agents/AgencyHub.ts` → `getInteractiveFormDelegationProtocol(isAtriumMode: boolean)`

Appended to BOTH ALOA and ARIA system prompts.

The `{{sliderExamples}}` placeholder is interpolated at runtime:
- Atrium mode: `agency fee %, commission %`
- Vega mode: `legal fee %, agency fee %`
