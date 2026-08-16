# Interactive Form Delegation Protocol
## Anti-Interrogation System for Structured Data Collection

When the AI needs to collect structured input from the user (e.g., setting up a rent structure, configuring a unit, creating a lease, drafting an instrument), it MUST NOT ask multiple sequential text questions.

Instead, it emits a SINGLE JSON block using the INTERACTIVE_FORM schema.

---

## Schema

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

---

## Field Type Rules

| Type | Use Case | Example |
|------|----------|---------|
| `chips` | Single-choice from short list (≤6) | Rent frequency, property type |
| `checkbox_group` | Multi-select | Amenities, services included |
| `slider` | Numeric percentages/ratings | Agency fee %, commission % |
| `date` | Any date field | Lease start, lease end |
| `number` | Monetary or numeric values | Rent amount, caution deposit |
| `select` | Dropdowns >6 options | Property selection |
| `text` | Free-form names, notes | Unit description, resident name |

---

## Critical Rules

1. Emit ONE form per response. Do NOT add text after the JSON block.
2. If a `<current_context>` block is present, PRE-FILL `defaultValue` for derivable fields.
3. After submission, process immediately — do NOT ask for confirmation again.
4. Only emit a form when genuinely needing multiple pieces of structured data. For single-field collection, ask normally.

---

## Implementation

File: `src/agents/AgencyHub.ts` → `getInteractiveFormDelegationProtocol(isAtriumMode: boolean)`

Appended to BOTH ALOA and ARIA system prompts.
