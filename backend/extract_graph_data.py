"""
Compatibility shim for extract_graph_data_from_cypher_results.

The function is defined in services.py. This module re-exports it so:
1. Any legacy code importing from 'extract_graph_data' continues to work
2. AI search and other features that use this function can import it either way
"""
from services import extract_graph_data_from_cypher_results

__all__ = ["extract_graph_data_from_cypher_results"]
