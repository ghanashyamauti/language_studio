"""
seed_admin.py
─────────────
Creates all tables fresh and seeds ONE default admin account.
Everything else (HODs, staff, teachers, students) is added manually through the UI.

Run from backend/ folder with venv active:
    python seed_admin.py
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from passlib.hash import pbkdf2_sha256

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/jspm_attendance")

engine = create_engine(DATABASE_URL)

# Import models AFTER engine is ready
import sys
sys.path.insert(0, ".")
from app.database import Base
from app.models import Admin

# ── Create all tables ──────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)
print("[OK] All tables created")

# ── Seed admin ─────────────────────────────────────────────────────────────
ADMIN_NAME     = "Admin"
ADMIN_EMAIL    = "admin@languagestudio.com"
ADMIN_PASSWORD = "Admin@123"

Session = sessionmaker(bind=engine)
db = Session()

existing = db.query(Admin).filter(Admin.email == ADMIN_EMAIL).first()
if existing:
    print(f"[INFO] Admin already exists: {ADMIN_EMAIL}")
else:
    admin = Admin(
        name=ADMIN_NAME,
        email=ADMIN_EMAIL,
        password_hash=pbkdf2_sha256.hash(ADMIN_PASSWORD),
    )
    db.add(admin)
    db.commit()
    print(f"[OK] Admin created")

db.close()

print()
print("=====================================")
print("  Database ready. Login with:")
print(f"  Role  : Admin")
print(f"  Email : {ADMIN_EMAIL}")
print(f"  Pass  : {ADMIN_PASSWORD}")
print("=====================================")
print()
print("Next steps:")
print("  1. Login as Admin → create HOD accounts")
print("  2. Login as HOD → create classes → import students (Excel/CSV)")
print("  3. Login as HOD → assign teachers to subjects")
print("  4. Teachers can now mark attendance")