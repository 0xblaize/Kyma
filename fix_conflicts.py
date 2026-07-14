import os

def fix_conflicts():
    for root, dirs, files in os.walk('frontend/src'):
        for file in files:
            if not file.endswith('.ts') and not file.endswith('.tsx'):
                continue
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            new_lines = []
            in_conflict = False
            keep_mode = False
            changed = False
            
            for line in lines:
                if line.startswith('<<<<<<< HEAD'):
                    in_conflict = True
                    keep_mode = True
                    changed = True
                    continue
                elif line.startswith('======='):
                    keep_mode = False
                    continue
                elif line.startswith('>>>>>>>'):
                    in_conflict = False
                    continue
                
                if not in_conflict or (in_conflict and keep_mode):
                    new_lines.append(line)
            
            if changed:
                with open(path, 'w', encoding='utf-8') as f:
                    f.writelines(new_lines)
                print(f"Fixed {path}")

if __name__ == "__main__":
    fix_conflicts()
