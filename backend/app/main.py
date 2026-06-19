import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from passlib.hash import pbkdf2_sha256
from app.database import engine, Base, SessionLocal
from app.models import *  # ensure all models are registered
from app.routers import admin, hod, teacher, student, auth, leave


app = FastAPI(title="Language Craft Studio Attendance API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.cache import global_cache
from fastapi import Request

@app.middleware("http")
async def cache_invalidation_middleware(request: Request, call_next):
    response = await call_next(request)
    if request.method not in ("GET", "HEAD", "OPTIONS") and response.status_code < 400:
        # Targeted invalidation based on what was mutated
        path = request.url.path
        if "/admin/" in path:
            # Invalidate admin caches when admin data is mutated
            global_cache.invalidate("admin:")
        if "/hod/" in path:
            global_cache.invalidate("hod:")
        if "/teacher/" in path:
            global_cache.invalidate("teacher:")
        if "/student/" in path:
            global_cache.invalidate("student:")
    return response

os.makedirs("uploads", exist_ok=True)
from fastapi.staticfiles import StaticFiles
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

Base.metadata.create_all(bind=engine)

@app.on_event("startup")
def startup_event():
    auto_seed = os.getenv("AUTO_SEED", "false").lower() in ("true", "1", "yes")
    if auto_seed:
        db = SessionLocal()
        try:
            admin_email = os.getenv("SEED_ADMIN_EMAIL", "admin@languagestudio.com")
            existing = db.query(Admin).filter(Admin.email == admin_email).first()
            if not existing:
                admin_name = os.getenv("SEED_ADMIN_NAME", "Admin")
                admin_password = os.getenv("SEED_ADMIN_PASSWORD", "Admin@123")
                admin_user = Admin(
                    name=admin_name,
                    email=admin_email,
                    password_hash=pbkdf2_sha256.hash(admin_password),
                )
                db.add(admin_user)
                db.commit()
                print(f"[AUTO-SEED] Admin created: {admin_email}")
            else:
                print(f"[AUTO-SEED] Admin already exists: {admin_email}")
        except Exception as e:
            print(f"[AUTO-SEED] Error seeding database: {e}")
        finally:
            db.close()

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(hod.router)
app.include_router(teacher.router)
app.include_router(student.router)
app.include_router(leave.router)

# ── Startup cache warmup ──────────────────────────────────────────────────────
import threading
import time as _time

def _warmup_cache():
    """Pre-populate expensive caches in a background thread so first request is instant."""
    _time.sleep(1)  # let the server finish starting
    try:
        db = SessionLocal()
        from app.routers.admin import admin_overview, public_settings, public_stats, list_departments
        fake_user = {"sub": "warmup", "role": "admin", "name": "Warmup"}
        
        print("[WARMUP] Pre-populating caches...")
        t0 = _time.monotonic()
        
        # Warmup public endpoints (called on every page load)
        public_settings(db=db)
        print(f"[WARMUP] public-settings cached in {(_time.monotonic() - t0) * 1000:.0f}ms")
        
        t1 = _time.monotonic()
        public_stats(db=db)
        print(f"[WARMUP] public-stats cached in {(_time.monotonic() - t1) * 1000:.0f}ms")
        
        # Warmup admin overview (the heaviest endpoint)
        t2 = _time.monotonic()
        admin_overview(user=fake_user, db=db)
        print(f"[WARMUP] admin overview cached in {(_time.monotonic() - t2) * 1000:.0f}ms")
        
        # Warmup departments (called on many pages)
        t3 = _time.monotonic()
        list_departments(user=fake_user, db=db)
        print(f"[WARMUP] departments cached in {(_time.monotonic() - t3) * 1000:.0f}ms")
        
        total = (_time.monotonic() - t0) * 1000
        print(f"[WARMUP] All caches populated in {total:.0f}ms total")
        db.close()
    except Exception as e:
        import traceback
        print(f"[WARMUP] Error: {e}")
        traceback.print_exc()

@app.on_event("startup")
def warmup_caches():
    threading.Thread(target=_warmup_cache, daemon=True).start()

# ── Request timing middleware ─────────────────────────────────────────────────
import time as time_mod

@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    start = time_mod.monotonic()
    response = await call_next(request)
    elapsed = (time_mod.monotonic() - start) * 1000
    if elapsed > 100:  # Log slow requests (>100ms)
        print(f"[SLOW] {request.method} {request.url.path} took {elapsed:.0f}ms")
    return response

@app.get("/")
def root():
    return {"message": "Language Craft Studio Attendance API v2.1 — Refined Filters Active"}
