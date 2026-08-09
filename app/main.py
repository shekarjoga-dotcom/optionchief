import sys
import os

# Root entrypoint shim for Render: uvicorn app.main:app
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(root_dir, 'backend')

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

target_file = os.path.join(backend_dir, 'app', 'main.py')
with open(target_file, 'r', encoding='utf-8') as f:
    code = f.read()

exec(code, globals())
