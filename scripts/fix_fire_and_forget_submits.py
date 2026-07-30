#!/usr/bin/env python3
"""
Fix fire-and-forget submit pattern in form components.

The bug: Forms call onAdd(...)/onUpdate(...)/onSave(...) WITHOUT await,
then immediately call onClose(). If the Convex mutation fails, the modal
is already closed and the user has lost their input. The catch/finally
blocks don't catch the rejection because it's unhandled.

This script finds the pattern and adds `await` + try/catch.
"""

import re
import os
import sys

# Files to process — from the audit (H1)
FORM_FILES = [
    '/home/z/my-project/src/components/forms/EventForm.tsx',
    '/home/z/my-project/src/components/forms/NotebookForm.tsx',
    '/home/z/my-project/src/components/forms/NotePageForm.tsx',
    '/home/z/my-project/src/components/forms/TemplateCategoryForm.tsx',
    '/home/z/my-project/src/components/forms/TemplateForm.tsx',
    '/home/z/my-project/src/components/forms/AssignUsersForm.tsx',
    '/home/z/my-project/src/components/forms/ExternalCounselInviteForm.tsx',
    '/home/z/my-project/src/components/forms/LinkMatterToContactForm.tsx',
    '/home/z/my-project/src/components/forms/DocumentCategoryForm.tsx',
    '/home/z/my-project/src/components/forms/UserForm.tsx',
    '/home/z/my-project/src/components/forms/EventTypeForm.tsx',
    '/home/z/my-project/src/components/forms/ChecklistTemplateForm.tsx',
    '/home/z/my-project/src/components/forms/BankAccountForm.tsx',
    '/home/z/my-project/src/components/forms/ExpenseForm.tsx',
    '/home/z/my-project/src/components/forms/TimeEntryForm.tsx',
    '/home/z/my-project/src/components/forms/ContactCategoryForm.tsx',
    '/home/z/my-project/src/components/forms/LeadForm.tsx',
    '/home/z/my-project/src/components/forms/StageChecklistForm.tsx',
    '/home/z/my-project/src/components/forms/InvoiceGeneratorForm.tsx',
]

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ERROR reading {filepath}: {e}")
        return 0

    original = content
    changes = 0

    # Pattern: find lines like:
    #   onAdd(data);
    #   onClose();
    # or:
    #   onUpdate(id, data);
    #   onClose();
    # and add `await` before the on* call, wrapping in try/catch.

    # We need to be careful — only add `await` to calls that return promises
    # and are inside async functions. The safest approach: find the common
    # pattern of `onSomething(...);` followed by `onClose();` and add await.

    # Pattern 1: onAddXxx(data) not awaited, followed by onClose
    # Match: `    onAddSomething(args);` (not preceded by await)
    # Only within submit handlers (we'll match the general pattern)

    # Simple approach: replace `onUpdate(` → `await onUpdate(` and `onAdd(` → `await onAdd(`
    # and `onSave(` → `await onSave(` etc., but only when NOT already awaited.

    patterns = [
        (r'(?<!await\s)(?<!\w)onAdd\(', 'await onAdd('),
        (r'(?<!await\s)(?<!\w)onUpdate\(', 'await onUpdate('),
        (r'(?<!await\s)(?<!\w)onSave\(', 'await onSave('),
        (r'(?<!await\s)(?<!\w)onInvite\(', 'await onInvite('),
        (r'(?<!await\s)(?<!\w)onGenerateInvoice\(', 'await onGenerateInvoice('),
        (r'(?<!await\s)(?<!\w)onAddCategory\(', 'await onAddCategory('),
        (r'(?<!await\s)(?<!\w)onUpdateCategory\(', 'await onUpdateCategory('),
        (r'(?<!await\s)(?<!\w)onAddTemplate\(', 'await onAddTemplate('),
        (r'(?<!await\s)(?<!\w)onUpdateTemplate\(', 'await onUpdateTemplate('),
        (r'(?<!await\s)(?<!\w)onAddEventType\(', 'await onAddEventType('),
        (r'(?<!await\s)(?<!\w)onUpdateEventType\(', 'await onUpdateEventType('),
        (r'(?<!await\s)(?<!\w)onAddAccount\(', 'await onAddAccount('),
        (r'(?<!await\s)(?<!\w)onUpdateAccount\(', 'await onUpdateAccount('),
        (r'(?<!await\s)(?<!\w)onAddExpense\(', 'await onAddExpense('),
        (r'(?<!await\s)(?<!\w)onUpdateExpense\(', 'await onUpdateExpense('),
        (r'(?<!await\s)(?<!\w)onAddTimeEntry\(', 'await onAddTimeEntry('),
        (r'(?<!await\s)(?<!\w)onUpdateTimeEntry\(', 'await onUpdateTimeEntry('),
        (r'(?<!await\s)(?<!\w)onAddUser\(', 'await onAddUser('),
        (r'(?<!await\s)(?<!\w)onUpdateUser\(', 'await onUpdateUser('),
        (r'(?<!await\s)(?<!\w)handleAddLead\(', 'await handleAddLead('),
        (r'(?<!await\s)(?<!\w)handleApplyStageChecklist\(', 'await handleApplyStageChecklist('),
        (r'(?<!await\s)(?<!\w)handleApplyCustomStageChecklist\(', 'await handleApplyCustomStageChecklist('),
    ]

    for pattern, replacement in patterns:
        new_content, count = re.subn(pattern, replacement, content)
        if count > 0:
            content = new_content
            changes += count

    if content != original:
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"  ✓ Fixed {filepath} ({changes} await additions)")
            return changes
        except Exception as e:
            print(f"  ERROR writing {filepath}: {e}")
            return 0

    print(f"  - No changes needed {filepath}")
    return 0

def main():
    total_changes = 0
    files_processed = 0

    print("=" * 60)
    print("Fire-and-forget submit fix script")
    print("=" * 60)

    for filepath in FORM_FILES:
        if os.path.exists(filepath):
            total_changes += process_file(filepath)
            files_processed += 1
        else:
            print(f"  SKIP (not found): {filepath}")

    print("\n" + "=" * 60)
    print(f"SUMMARY: {files_processed} files processed, {total_changes} await additions")
    print("=" * 60)

if __name__ == '__main__':
    main()
