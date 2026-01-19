#!/usr/bin/env python3
"""
Python runner script for repere Tauri application.

This script is invoked by the Tauri backend to execute Python code
on DataFrames. It reads input data from a Parquet file, executes
user code, and writes the result to another Parquet file.

Usage:
    python python_runner.py <input_parquet> <output_parquet> <code_file> [--matplotlib <output_png>]
"""

import sys
import json
import traceback
from pathlib import Path


def main():
    if len(sys.argv) < 4:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python_runner.py <input_parquet> <output_parquet> <code_file> [--matplotlib <output_png>]'
        }))
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    code_path = Path(sys.argv[3])
    matplotlib_path = None

    # Parse optional matplotlib output path
    if len(sys.argv) > 4 and sys.argv[4] == '--matplotlib':
        if len(sys.argv) > 5:
            matplotlib_path = Path(sys.argv[5])

    stdout_capture = []
    stderr_capture = []

    try:
        import pandas as pd
        import numpy as np

        # Set up matplotlib with non-interactive backend
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt

        # Read input data
        if not input_path.exists():
            raise FileNotFoundError(f'Input file not found: {input_path}')

        df = pd.read_parquet(input_path)

        # Read and execute user code
        if not code_path.exists():
            raise FileNotFoundError(f'Code file not found: {code_path}')

        code = code_path.read_text()

        # Prepare execution namespace
        namespace = {
            'df': df,
            'pd': pd,
            'np': np,
            'plt': plt,
            'result': None,
        }

        # Capture stdout/stderr
        from io import StringIO
        import sys as _sys

        old_stdout = _sys.stdout
        old_stderr = _sys.stderr
        _sys.stdout = StringIO()
        _sys.stderr = StringIO()

        try:
            exec(code, namespace)
        finally:
            stdout_capture = _sys.stdout.getvalue()
            stderr_capture = _sys.stderr.getvalue()
            _sys.stdout = old_stdout
            _sys.stderr = old_stderr

        result = namespace.get('result')

        # Save matplotlib figure if any
        matplotlib_output = None
        if plt.get_fignums():
            if matplotlib_path:
                plt.savefig(matplotlib_path, format='png', dpi=150, bbox_inches='tight', facecolor='white')
                matplotlib_output = str(matplotlib_path)
            plt.close('all')

        # Process result
        if result is None:
            print(json.dumps({
                'success': True,
                'has_result': False,
                'stdout': stdout_capture,
                'stderr': stderr_capture,
                'matplotlib_output': matplotlib_output,
            }))
            return

        if not isinstance(result, pd.DataFrame):
            print(json.dumps({
                'success': False,
                'error': 'result must be a pandas DataFrame',
                'stdout': stdout_capture,
                'stderr': stderr_capture,
            }))
            return

        # Write result to Parquet
        result.to_parquet(output_path, index=False)

        # Get column info
        columns = [{'name': str(c), 'dtype': str(result[c].dtype)} for c in result.columns]

        print(json.dumps({
            'success': True,
            'has_result': True,
            'row_count': len(result),
            'columns': columns,
            'output_path': str(output_path),
            'stdout': stdout_capture,
            'stderr': stderr_capture,
            'matplotlib_output': matplotlib_output,
        }))

    except Exception as e:
        tb = traceback.format_exc()
        print(json.dumps({
            'success': False,
            'error': str(e),
            'traceback': tb,
            'stdout': ''.join(stdout_capture) if isinstance(stdout_capture, list) else stdout_capture,
            'stderr': ''.join(stderr_capture) if isinstance(stderr_capture, list) else stderr_capture,
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
