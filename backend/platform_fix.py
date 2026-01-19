"""
Platform detection fix for Windows multiprocessing issues.
This module should be imported before any other imports that might use platform detection.
"""
import sys
import os

def apply_windows_platform_fix():
    """
    Apply a fix for Windows platform detection issues in multiprocessing contexts.
    This is needed for libraries like neo4j that use platform.system() during import.
    """
    if sys.platform == 'win32':
        # Cache platform information before multiprocessing
        import platform
        
        # Pre-cache platform information to avoid WMI queries in child processes
        try:
            _ = platform.system()
            _ = platform.release()
            _ = platform.version()
        except:
            pass
        
        # Set environment variable to help with subprocess imports
        os.environ['PYTHONINSPECT'] = ''
        os.environ['PYTHONDONTWRITEBYTECODE'] = '1'

# Always apply the fix when this module is imported
apply_windows_platform_fix()

