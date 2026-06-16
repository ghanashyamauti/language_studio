import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine
from app.models import Subject

def migrate():
    try:
        Subject.__table__.create(engine)
        print("Subject table created successfully.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    migrate()
