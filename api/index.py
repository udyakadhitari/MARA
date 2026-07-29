import sys
import os

# Add root directory to sys.path so backend imports work seamlessly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.main import app

# Export app for Vercel Serverless Function runtime
__all__ = ["app"]
