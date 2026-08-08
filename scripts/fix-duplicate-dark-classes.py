#!/usr/bin/env python3
"""
Fix duplicate dark:* Tailwind classes across all .tsx files.
When two dark:bg-* (or dark:text-*, dark:border-*) classes appear on the same
element, the last one in the compiled CSS wins. This script removes the first
occurrence, keeping only the last (which is what actually renders).

Also fixes dark:text-* and dark:border-* duplicates.
"""
import re
import os
import glob

def fix_duplicate_dark_classes(content):
    """Remove duplicate dark:* classes, keeping the last one."""
    # Pattern: dark:bg-zinc-900 dark:bg-zinc-800 (or any dark:prop-value dark:prop-value)
    # We need to match pairs of the SAME dark:property (bg, text, border, etc.)
    
    # Strategy: find all className strings and process them
    # Pattern matches: dark:bg-zinc-900 dark:bg-zinc-800 → dark:bg-zinc-800
    # Also: dark:bg-zinc-800/50 dark:bg-zinc-900 → dark:bg-zinc-900
    
    changes = 0
    
    # Pattern: two consecutive dark:X-Y dark:X-Z (where X is bg/text/border/etc)
    # The /50 opacity suffix is optional
    pattern = re.compile(
        r'(dark:(bg|text|border)-(?:slate|zinc|gray|red|green|blue|amber|emerald|rose|indigo|violet|sky|orange|yellow|purple|pink|teal|cyan|lime|fuchsia)-\d+(?:/\d+)?)\s+(dark:\2-(?:slate|zinc|gray|red|green|blue|amber|emerald|rose|indigo|violet|sky|orange|yellow|purple|pink|teal|cyan|lime|fuchsia)-\d+(?:/\d+)?)'
    )
    
    def replace_pair(m):
        nonlocal changes
        changes += 1
        # Keep only the last one
        return m.group(3)
    
    # Run the replacement multiple times to catch triple+ duplicates
    for _ in range(5):
        new_content = pattern.sub(replace_pair, content)
        if new_content == content:
            break
        content = new_content
    
    return content, changes

def main():
    src_dir = '/home/z/my-project/src'
    total_files = 0
    total_changes = 0
    
    for filepath in glob.glob(f'{src_dir}/**/*.tsx', recursive=True):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            fixed_content, changes = fix_duplicate_dark_classes(content)
            
            if changes > 0:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(fixed_content)
                total_files += 1
                total_changes += changes
                print(f'  Fixed {changes:3d} in {os.path.relpath(filepath, src_dir)}')
        except Exception as e:
            print(f'  ERROR in {filepath}: {e}')
    
    print(f'\n✓ Fixed {total_changes} duplicate dark: classes across {total_files} files')

if __name__ == '__main__':
    main()
