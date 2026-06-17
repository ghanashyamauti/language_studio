from sqlalchemy import text
from app.database import engine

def migrate():
    print("Starting manual profile photo column migration...")
    
    migrations = [
        ("hods", "ALTER TABLE hods ADD COLUMN profile_photo VARCHAR"),
        ("teachers", "ALTER TABLE teachers ADD COLUMN profile_photo VARCHAR"),
        ("students", "ALTER TABLE students ADD COLUMN profile_photo VARCHAR"),
    ]

    for table, sql in migrations:
        with engine.begin() as conn:
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
