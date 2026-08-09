import os
import sys

# Extend package __path__ to include backend/app so app.routes, app.services, app.models resolve seamlessly
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(root_dir, 'backend')
backend_app_dir = os.path.join(root_dir, 'backend', 'app')

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

if backend_app_dir not in __path__:
    __path__.insert(0, backend_app_dir)
