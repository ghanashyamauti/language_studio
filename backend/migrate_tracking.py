from app.database import engine
from sqlalchemy import text

def add_tracking_columns():
    with engine.connect() as conn:
        print("Checking for tracking columns...")
        
        tables = ["students", "teachers", "subjects"]
        for table in tables:
            print(f"Updating table: {table}")
            try:
                # Add created_by_role
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS created_by_role VARCHAR;"))
                # Add created_by_id
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS created_by_id INTEGER;"))
                # Add created_at
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;"))
                print(f"Columns added to {table}")
            except Exception as e:
                print(f"Error updating {table}: {e}")
        
        conn.commit()
        print("Database migration completed!")

if __name__ == "__main__":
    add_tracking_columns()
