from sqlalchemy import text
from app.database import engine

def migrate():
    print("Starting robust manual migration...")
    
    # List of columns to add: (table, sql)
    migrations = [
        ("teachers", "ALTER TABLE teachers ADD COLUMN created_by_role VARCHAR"),
        ("teachers", "ALTER TABLE teachers ADD COLUMN created_by_id INTEGER"),
        ("teachers", "ALTER TABLE teachers ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP"),
        
        ("students", "ALTER TABLE students ADD COLUMN created_by_role VARCHAR"),
        ("students", "ALTER TABLE students ADD COLUMN created_by_id INTEGER"),
        ("students", "ALTER TABLE students ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP"),
        
        ("subjects", "ALTER TABLE subjects ADD COLUMN created_by_role VARCHAR"),
        ("subjects", "ALTER TABLE subjects ADD COLUMN created_by_id INTEGER"),
        ("subjects", "ALTER TABLE subjects ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP"),
        ("subjects", "ALTER TABLE subjects ADD COLUMN dept_id INTEGER REFERENCES departments(dept_id) ON DELETE SET NULL"),
        
        ("hod_classes", "ALTER TABLE hod_classes ADD COLUMN dept_id INTEGER REFERENCES departments(dept_id) ON DELETE SET NULL"),
        ("hod_classes", "ALTER TABLE hod_classes ADD COLUMN semester INTEGER DEFAULT 2"),
        ("hod_classes", "ALTER TABLE hod_classes ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP"),
        
        ("departments", "ALTER TABLE departments ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP"),
        ("hods", "ALTER TABLE hods ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP"),
    ]

    for table, sql in migrations:
        with engine.begin() as conn: # engine.begin() handles transaction commit/rollback per command
            try:
                conn.execute(text(sql))
                print(f"Success: {sql}")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    print(f"Skipped: {sql} (already exists)")
                else:
                    print(f"Error: {sql} -> {e}")

    print("Migration complete.")

if __name__ == "__main__":
    migrate()
