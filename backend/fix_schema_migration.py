from sqlalchemy import text
from app.database import engine

def migrate():
    with engine.connect() as conn:
        print("Starting manual migration...")
        
        # Table: teachers
        try:
            conn.execute(text("ALTER TABLE teachers ADD COLUMN created_by_role VARCHAR;"))
            print("Added teachers.created_by_role")
        except Exception as e: print(f"Note: {e}")
        
        try:
            conn.execute(text("ALTER TABLE teachers ADD COLUMN created_by_id INTEGER;"))
            print("Added teachers.created_by_id")
        except Exception as e: print(f"Note: {e}")

        try:
            conn.execute(text("ALTER TABLE teachers ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;"))
            print("Added teachers.created_at")
        except Exception as e: print(f"Note: {e}")

        # Table: students
        try:
            conn.execute(text("ALTER TABLE students ADD COLUMN created_by_role VARCHAR;"))
            print("Added students.created_by_role")
        except Exception as e: print(f"Note: {e}")
        
        try:
            conn.execute(text("ALTER TABLE students ADD COLUMN created_by_id INTEGER;"))
            print("Added students.created_by_id")
        except Exception as e: print(f"Note: {e}")

        try:
            conn.execute(text("ALTER TABLE students ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;"))
            print("Added students.created_at")
        except Exception as e: print(f"Note: {e}")

        # Table: subjects
        try:
            conn.execute(text("ALTER TABLE subjects ADD COLUMN created_by_role VARCHAR;"))
            print("Added subjects.created_by_role")
        except Exception as e: print(f"Note: {e}")
        
        try:
            conn.execute(text("ALTER TABLE subjects ADD COLUMN created_by_id INTEGER;"))
            print("Added subjects.created_by_id")
        except Exception as e: print(f"Note: {e}")

        try:
            conn.execute(text("ALTER TABLE subjects ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;"))
            print("Added subjects.created_at")
        except Exception as e: print(f"Note: {e}")

        try:
            conn.execute(text("ALTER TABLE subjects ADD COLUMN dept_id INTEGER REFERENCES departments(dept_id) ON DELETE SET NULL;"))
            print("Added subjects.dept_id")
        except Exception as e: print(f"Note: {e}")

        # Table: hod_classes
        try:
            conn.execute(text("ALTER TABLE hod_classes ADD COLUMN dept_id INTEGER REFERENCES departments(dept_id) ON DELETE SET NULL;"))
            print("Added hod_classes.dept_id")
        except Exception as e: print(f"Note: {e}")
        
        try:
            conn.execute(text("ALTER TABLE hod_classes ADD COLUMN semester INTEGER DEFAULT 2;"))
            print("Added hod_classes.semester")
        except Exception as e: print(f"Note: {e}")

        try:
            conn.execute(text("ALTER TABLE hod_classes ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;"))
            print("Added hod_classes.created_at")
        except Exception as e: print(f"Note: {e}")

        # Table: departments
        try:
            conn.execute(text("ALTER TABLE departments ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;"))
            print("Added departments.created_at")
        except Exception as e: print(f"Note: {e}")

        # Table: hods
        try:
            conn.execute(text("ALTER TABLE hods ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;"))
            print("Added hods.created_at")
        except Exception as e: print(f"Note: {e}")

        conn.commit()
        print("Migration complete.")

if __name__ == "__main__":
    migrate()
