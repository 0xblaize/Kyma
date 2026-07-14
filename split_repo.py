import os
import shutil

def split_repo():
    frontend_dir = "frontend"
    if not os.path.exists(frontend_dir):
        os.makedirs(frontend_dir)
        
    items_to_move = [
        "src",
        "public",
        "package.json",
        "package-lock.json",
        "next.config.js",
        "postcss.config.js",
        "tailwind.config.ts",
        "tsconfig.json",
        "next-env.d.ts",
        ".env.local",
        ".env.example",
        "checklist.md"
    ]
    
    for item in items_to_move:
        if os.path.exists(item):
            shutil.move(item, os.path.join(frontend_dir, item))
            print(f"Moved {item} to {frontend_dir}")
            
if __name__ == "__main__":
    split_repo()
