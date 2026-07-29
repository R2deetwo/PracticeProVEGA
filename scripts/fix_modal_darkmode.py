#!/usr/bin/env python3
"""
Fix dark mode issues in modal components — v2 (handles hover: properly).

Strategy:
1. Process hover: classes FIRST (add dark:hover: variants)
2. Process non-hover classes with negative lookbehind that excludes hover:
3. Only add dark: variants when they don't already exist in the className string
"""

import re
import os

MODAL_DIRS = [
    '/home/z/my-project/src/components/modals',
    '/home/z/my-project/src/components/forms',
]

EXTRA_FILES = [
    '/home/z/my-project/src/components/forms/SmartMatterModal.tsx',
    '/home/z/my-project/src/components/settings/SecuritySettings.tsx',
    '/home/z/my-project/src/components/MatterStageTracker.tsx',
    '/home/z/my-project/src/components/MatterBoardView.tsx',
]

# Rules are processed in ORDER. Each rule is (regex, dark_class_to_add).
# Hover rules come FIRST so they match hover:bg-X before bg-X rules run.
HOVER_RULES = [
    # Hover backgrounds — map to dark:hover: variants
    (r'(?<!dark:hover:)hover:bg-slate-50\b', 'dark:hover:bg-zinc-800'),
    (r'(?<!dark:hover:)hover:bg-slate-100\b', 'dark:hover:bg-zinc-800'),
    (r'(?<!dark:hover:)hover:bg-slate-200\b', 'dark:hover:bg-zinc-700'),
    (r'(?<!dark:hover:)hover:bg-white\b', 'dark:hover:bg-zinc-800'),
    (r'(?<!dark:hover:)hover:bg-gray-300\b', 'dark:hover:bg-zinc-700'),
    (r'(?<!dark:hover:)hover:bg-blue-50\b', 'dark:hover:bg-blue-950/40'),
    (r'(?<!dark:hover:)hover:bg-blue-100\b', 'dark:hover:bg-blue-900/40'),
    (r'(?<!dark:hover:)hover:bg-red-50\b', 'dark:hover:bg-red-950/40'),
    (r'(?<!dark:hover:)hover:bg-amber-50\b', 'dark:hover:bg-amber-950/40'),
    (r'(?<!dark:hover:)hover:bg-green-50\b', 'dark:hover:bg-green-950/40'),
    (r'(?<!dark:hover:)hover:bg-primary-50\b', 'dark:hover:bg-primary-900/30'),
    
    # Hover text colors
    (r'(?<!dark:hover:)hover:text-slate-600\b', 'dark:hover:text-zinc-300'),
    (r'(?<!dark:hover:)hover:text-slate-700\b', 'dark:hover:text-zinc-200'),
    (r'(?<!dark:hover:)hover:text-slate-800\b', 'dark:hover:text-white'),
    (r'(?<!dark:hover:)hover:text-gray-600\b', 'dark:hover:text-zinc-300'),
    (r'(?<!dark:hover:)hover:text-gray-700\b', 'dark:hover:text-zinc-200'),
]

# Non-hover rules — negative lookbehind excludes both 'dark:' AND 'hover:'
# The (?<!hover:) prevents matching hover:bg-X (already handled above)
NON_HOVER_RULES = [
    # Background colors (non-hover)
    (r'(?<!dark:)(?<!hover:)bg-gray-200\b', 'dark:bg-zinc-800'),
    (r'(?<!dark:)(?<!hover:)bg-slate-200\b', 'dark:bg-zinc-700'),
    (r'(?<!dark:)(?<!hover:)bg-slate-300\b', 'dark:bg-zinc-700'),
    (r'(?<!dark:)(?<!hover:)bg-blue-50\b', 'dark:bg-blue-950/40'),
    (r'(?<!dark:)(?<!hover:)bg-red-50\b', 'dark:bg-red-950/40'),
    (r'(?<!dark:)(?<!hover:)bg-amber-50\b', 'dark:bg-amber-950/40'),
    (r'(?<!dark:)(?<!hover:)bg-amber-100\b', 'dark:bg-amber-900/40'),
    (r'(?<!dark:)(?<!hover:)bg-green-50\b', 'dark:bg-green-950/40'),
    (r'(?<!dark:)(?<!hover:)bg-green-100\b', 'dark:bg-green-900/40'),
    (r'(?<!dark:)(?<!hover:)bg-indigo-50\b', 'dark:bg-indigo-950/40'),
    (r'(?<!dark:)(?<!hover:)bg-indigo-100\b', 'dark:bg-indigo-900/40'),
    (r'(?<!dark:)(?<!hover:)bg-emerald-50\b', 'dark:bg-emerald-950/40'),
    (r'(?<!dark:)(?<!hover:)bg-emerald-100\b', 'dark:bg-emerald-900/40'),
    (r'(?<!dark:)(?<!hover:)bg-primary-50\b', 'dark:bg-primary-900/30'),
    (r'(?<!dark:)(?<!hover:)bg-primary-100\b', 'dark:bg-primary-900/40'),
    (r'(?<!dark:)(?<!hover:)bg-orange-50\b', 'dark:bg-orange-950/40'),
    
    # Borders (non-hover)
    (r'(?<!dark:)border-blue-100\b', 'dark:border-blue-900/50'),
    (r'(?<!dark:)border-blue-200\b', 'dark:border-blue-900/50'),
    (r'(?<!dark:)border-blue-300\b', 'dark:border-blue-800'),
    (r'(?<!dark:)border-red-100\b', 'dark:border-red-900/50'),
    (r'(?<!dark:)border-red-200\b', 'dark:border-red-900/50'),
    (r'(?<!dark:)border-red-300\b', 'dark:border-red-800'),
    (r'(?<!dark:)border-amber-200\b', 'dark:border-amber-900/50'),
    (r'(?<!dark:)border-amber-100\b', 'dark:border-amber-900/50'),
    (r'(?<!dark:)border-amber-300\b', 'dark:border-amber-800'),
    (r'(?<!dark:)border-gray-100\b', 'dark:border-zinc-800'),
    (r'(?<!dark:)border-gray-200\b', 'dark:border-zinc-700'),
    (r'(?<!dark:)border-primary-200\b', 'dark:border-primary-800'),
    (r'(?<!dark:)border-rose-300\b', 'dark:border-rose-800'),
    
    # Text colors (non-hover)
    (r'(?<!dark:)(?<!hover:)text-blue-700\b', 'dark:text-blue-300'),
    (r'(?<!dark:)(?<!hover:)text-blue-800\b', 'dark:text-blue-200'),
    (r'(?<!dark:)(?<!hover:)text-red-600\b', 'dark:text-red-400'),
    (r'(?<!dark:)(?<!hover:)text-red-700\b', 'dark:text-red-400'),
    (r'(?<!dark:)(?<!hover:)text-green-700\b', 'dark:text-green-300'),
    (r'(?<!dark:)(?<!hover:)text-green-800\b', 'dark:text-green-200'),
    (r'(?<!dark:)(?<!hover:)text-amber-700\b', 'dark:text-amber-300'),
    (r'(?<!dark:)(?<!hover:)text-amber-800\b', 'dark:text-amber-200'),
    (r'(?<!dark:)(?<!hover:)text-indigo-600\b', 'dark:text-indigo-300'),
    (r'(?<!dark:)(?<!hover:)text-indigo-700\b', 'dark:text-indigo-300'),
    (r'(?<!dark:)(?<!hover:)text-emerald-600\b', 'dark:text-emerald-400'),
    (r'(?<!dark:)(?<!hover:)text-emerald-700\b', 'dark:text-emerald-300'),
    (r'(?<!dark:)(?<!hover:)text-orange-700\b', 'dark:text-orange-300'),
    (r'(?<!dark:)(?<!hover:)text-orange-800\b', 'dark:text-orange-200'),
    (r'(?<!dark:)(?<!hover:)text-primary-600\b', 'dark:text-primary-300'),
    (r'(?<!dark:)(?<!hover:)text-primary-700\b', 'dark:text-primary-300'),
    (r'(?<!dark:)(?<!hover:)text-blue-500\b', 'dark:text-blue-400'),
    (r'(?<!dark:)(?<!hover:)text-blue-600\b', 'dark:text-blue-400'),
    (r'(?<!dark:)(?<!hover:)text-red-500\b', 'dark:text-red-400'),
    (r'(?<!dark:)(?<!hover:)text-green-600\b', 'dark:text-green-400'),
    (r'(?<!dark:)(?<!hover:)text-emerald-600\b', 'dark:text-emerald-400'),
    (r'(?<!dark:)(?<!hover:)text-amber-600\b', 'dark:text-amber-400'),
    (r'(?<!dark:)(?<!hover:)text-amber-500\b', 'dark:text-amber-400'),
    (r'(?<!dark:)(?<!hover:)text-indigo-500\b', 'dark:text-indigo-400'),
]

ALL_RULES = HOVER_RULES + NON_HOVER_RULES

def process_classname_body(body):
    """Process a className string body and add dark: variants."""
    changes = 0
    new_body = body
    
    for pattern, dark_class in ALL_RULES:
        def replace_light(match):
            nonlocal changes
            full = match.group(0)
            # Don't add if the dark_class is already in the string
            if dark_class in new_body:
                return full
            changes += 1
            return full + ' ' + dark_class
        
        new_body = re.sub(pattern, replace_light, new_body)
    
    return new_body, changes

def process_file(filepath):
    """Process a single file and fix dark mode issues."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ERROR reading {filepath}: {e}")
        return 0
    
    original = content
    total_changes = 0
    
    def fix_simple_classname(match):
        nonlocal total_changes
        prefix = match.group(1)
        body = match.group(2)
        suffix = match.group(3)
        new_body, changes = process_classname_body(body)
        total_changes += changes
        return prefix + new_body + suffix
    
    # Match className="..." (simple string)
    content = re.sub(
        r'(className=")([^"]*?)(")',
        fix_simple_classname,
        content
    )
    
    # Match className={`...`} (template literal, single-line)
    content = re.sub(
        r'(className={`)([^`]*?)(`})',
        fix_simple_classname,
        content
    )
    
    if content != original:
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"  ✓ Fixed {filepath} ({total_changes} changes)")
            return total_changes
        except Exception as e:
            print(f"  ERROR writing {filepath}: {e}")
            return 0
    
    print(f"  - No changes needed {filepath}")
    return 0

def main():
    total_changes = 0
    files_processed = 0
    
    print("=" * 60)
    print("Modal Dark Mode Fix Script v2 (hover-aware)")
    print("=" * 60)
    
    for modal_dir in MODAL_DIRS:
        if not os.path.exists(modal_dir):
            print(f"Directory not found: {modal_dir}")
            continue
        
        print(f"\nProcessing: {modal_dir}")
        for filename in sorted(os.listdir(modal_dir)):
            if filename.endswith('.tsx') or filename.endswith('.ts'):
                filepath = os.path.join(modal_dir, filename)
                total_changes += process_file(filepath)
                files_processed += 1
    
    for filepath in EXTRA_FILES:
        if os.path.exists(filepath):
            print(f"\nProcessing: {filepath}")
            total_changes += process_file(filepath)
            files_processed += 1
    
    print("\n" + "=" * 60)
    print(f"SUMMARY: {files_processed} files processed, {total_changes} dark mode fixes applied")
    print("=" * 60)

if __name__ == '__main__':
    main()
