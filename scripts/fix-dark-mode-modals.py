#!/usr/bin/env python3
"""
Fix dark mode issues in modal components.
Adds dark: variants to common light-mode classes that are missing them.
Only adds dark: variants if they're not already present on the same line.
"""
import os
import re

# Mapping of light-mode classes to their dark: equivalents
REPLACEMENTS = [
    # Backgrounds
    (r'bg-white(?!.*dark:bg)', 'bg-white dark:bg-zinc-900'),
    (r'bg-slate-50(?!.*dark:bg)', 'bg-slate-50 dark:bg-zinc-900'),
    (r'bg-gray-50(?!.*dark:bg)', 'bg-gray-50 dark:bg-zinc-800'),
    (r'bg-slate-100(?!.*dark:bg)', 'bg-slate-100 dark:bg-zinc-800'),
    (r'bg-gray-100(?!.*dark:bg)', 'bg-gray-100 dark:bg-zinc-800'),
    # Text
    (r'text-slate-900(?!.*dark:text)', 'text-slate-900 dark:text-white'),
    (r'text-gray-900(?!.*dark:text)', 'text-gray-900 dark:text-white'),
    (r'text-slate-800(?!.*dark:text)', 'text-slate-800 dark:text-zinc-100'),
    (r'text-slate-700(?!.*dark:text)', 'text-slate-700 dark:text-zinc-300'),
    (r'text-gray-700(?!.*dark:text)', 'text-gray-700 dark:text-zinc-300'),
    (r'text-slate-600(?!.*dark:text)', 'text-slate-600 dark:text-zinc-400'),
    (r'text-gray-600(?!.*dark:text)', 'text-gray-600 dark:text-zinc-400'),
    # Borders
    (r'border-slate-200(?!.*dark:border)', 'border-slate-200 dark:border-zinc-700'),
    (r'border-gray-200(?!.*dark:border)', 'border-gray-200 dark:border-zinc-700'),
    (r'border-slate-300(?!.*dark:border)', 'border-slate-300 dark:border-zinc-700'),
    (r'border-gray-300(?!.*dark:border)', 'border-gray-300 dark:border-zinc-700'),
    (r'border-slate-100(?!.*dark:border)', 'border-slate-100 dark:border-zinc-800'),
]

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    for pattern, replacement in REPLACEMENTS:
        # Use a function to avoid replacing already-fixed lines
        def replace_match(match):
            line = match.group(0)
            # Check if the dark: variant is already present
            dark_class = replacement.split('dark:')[1].split(' ')[0]
            if f'dark:{dark_class}' in line:
                return line
            # Only replace the specific class, not the whole line
            light_class = pattern.replace('(?!.*dark:bg)', '').replace('(?!.*dark:text)', '').replace('(?!.*dark:border)', '')
            # Escape for regex replacement
            return line.replace(light_class, replacement, 1)
        
        # Apply line by line to check for existing dark: variants
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if re.search(pattern, line):
                # Check if dark: variant already exists
                dark_prop = 'dark:bg' if 'bg-' in pattern else ('dark:text' if 'text-' in pattern else 'dark:border')
                if dark_prop not in line:
                    light_class = re.search(r'(bg-\S+|text-\S+|border-\S+)', pattern).group(1).replace('(?!.*dark:bg)', '').replace('(?!.*dark:text)', '').replace('(?!.*dark:border)', '')
                    # Only replace the FIRST occurrence in the line
                    lines[i] = line.replace(light_class, replacement, 1)
        content = '\n'.join(lines)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

# Process all modal files
modal_dir = '/home/z/my-project/src/components/modals'
fixed = []
for filename in os.listdir(modal_dir):
    if filename.endswith('.tsx'):
        filepath = os.path.join(modal_dir, filename)
        if fix_file(filepath):
            fixed.append(filename)

print(f"Fixed {len(fixed)} files:")
for f in sorted(fixed):
    print(f"  ✓ {f}")
