import sys
import os
import uvicorn

backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app

if __name__ == '__main__':
    port = int(os.getenv('PORT', 8000))
    print(f'Starting optionchief.in Backend on port {port}...')
    uvicorn.run(app, host='0.0.0.0', port=port)
