import os
import re
from pathlib import Path

def get_relative_path(from_file, to_dir):
    """Calculate relative path from one file to a directory"""
    from_dir = Path(from_file).parent
    to_path = Path(to_dir)
    
    try:
        rel = os.path.relpath(to_path, from_dir).replace('\\', '/')
        if not rel.startswith('.'):
            rel = './' + rel
        return rel
    except:
        return None

def fix_imports(file_path):
    """Fix @ imports in a single file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    src_dir = Path('src').absolute()
    
    # Find all @ imports
    patterns = [
        (r'from ["\']@/components/', 'components'),
        (r'from ["\']@/lib/', 'lib'),
        (r'from ["\']@/context/', 'context'),
        (r'from ["\']@/types', 'types'),
    ]
    
    for pattern, target_dir in patterns:
        matches = re.finditer(pattern, content)
        for match in matches:
            old_import = match.group(0)
            target_path = src_dir / target_dir
            rel_path = get_relative_path(file_path, target_path)
            
            if rel_path:
                new_import = old_import.replace('@/', rel_path + '/')
                content = content.replace(old_import, new_import)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return True

# Process all TypeScript files
src_path = Path('src')
files_processed = 0

for file_path in src_path.rglob('*.ts*'):
    if fix_imports(file_path):
        files_processed += 1
        print(f"Fixed: {file_path}")

print(f"\nTotal files processed: {files_processed}")
