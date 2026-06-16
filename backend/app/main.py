from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.models import *  # ensure all models are registered
from app.routers import admin, hod, teacher, student, auth

app = FastAPI(title="The Language Studio Attendance API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(hod.router)
app.include_router(teacher.router)
app.include_router(student.router)

@app.get("/")
def root():
    return {"message": "The Language Studio Attendance API v2.1 — Refined Filters Active"}
