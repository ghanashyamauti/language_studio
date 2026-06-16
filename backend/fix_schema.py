from app.database import engine
from sqlalchemy import text

def fix_db():
    with engine.connect() as conn:
        print("Dropping class_subjects table...")
        conn.execute(text("DROP TABLE IF EXISTS class_subjects CASCADE;"))
        print("Recreating class_subjects table with correct columns...")
        conn.execute(text("""
            CREATE TABLE class_subjects (
                class_name VARCHAR NOT NULL,
                subject_id INTEGER NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
                PRIMARY KEY (class_name, subject_id)
            );
        """))
        conn.commit()
        print("Database schema fixed successfully!")

if __name__ == "__main__":
    fix_db()
