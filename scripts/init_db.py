"""Run once against the existing empty Azure SQL database before first production use."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from store import Store

if __name__ == '__main__':
    store = Store(os.environ['DATABASE_URL'])
    store.initialize()
    print('Recruitment schema is initialized. No assessment content was imported.')
