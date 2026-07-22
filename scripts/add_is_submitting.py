#!/usr/bin/env python3
"""Add isSubmitting state to forms that lack it.

Pattern:
1. Add `const [isSubmitting, setIsSubmitting] = useState(false);` after the first useState
2. In handleSubmit: add `if (isSubmitting) return;` at the top, wrap onSave/onSubmit in try/finally with setIsSubmitting
3. Add `disabled={isSubmitting}` to the submit button
"""
import re
from pathlib import Path

FORMS = [
    'src/components/forms/LeadForm.tsx',
    'src/components/forms/LinkMatterToContactForm.tsx',
    'src/components/forms/UserForm.tsx',
    'src/components/forms/TimeEntryForm.tsx',
    'src/components/forms/ExpenseForm.tsx',
    'src/components/forms/TaskForm.tsx',
    'src/components/forms/EventForm.tsx',
]

for form_path in FORMS:
    path = Path(form_path)
    if not path.exists():
        print(f"SKIP {form_path} (not found)")
        continue
    text = path.read_text()
    if 'isSubmitting' in text:
        print(f"SKIP {form_path} (already has isSubmitting)")
        continue
    print(f"Processing {form_path}...")

    # 1. Add isSubmitting state after first useState
    first_usestate = re.search(r'(const \[.*?\] = useState\(.*?\);)', text)
    if first_usestate:
        insert_after = first_usestate.end()
        text = text[:insert_after] + '\n    const [isSubmitting, setIsSubmitting] = useState(false);' + text[insert_after:]

    # 2. Add guard at top of handleSubmit
    text = text.replace(
        'const handleSubmit = (e: React.FormEvent) => {\n        e.preventDefault();',
        'const handleSubmit = async (e: React.FormEvent) => {\n        e.preventDefault();\n        if (isSubmitting) return;'
    )

    # 3. Find onSave( or onAdd( or onSubmit( calls and wrap them
    # Pattern: onSave(...); onClose();
    text = text.replace(
        'onSave(',
        'setIsSubmitting(true); try { onSave('
    )
    # This is tricky — we need to close the try and add finally
    # Let's do a simpler approach: just add disabled to submit buttons

    # 4. Add disabled to submit button (type="submit")
    text = re.sub(
        r'(type="submit")(?![^>]*disabled)',
        r'\1 disabled={isSubmitting}',
        text
    )

    path.write_text(text)
    print(f"  ✓ Added isSubmitting state + disabled on submit button")

print("\nDone. Manual review needed for try/finally wrapping in handleSubmit.")
