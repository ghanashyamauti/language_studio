from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import Student, Teacher, Admin, HOD
from app.schemas import LoginRequest, TokenResponse
from app.auth import verify_password, create_access_token
from app import activity

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    role = payload.role
    username = payload.username.strip()
    password = payload.password
    ip = request.client.host if request.client else None

    user = None
    token_data = {}
    extra = {}
    actor_id = None
    actor_name = ""

    if role == "student":
        row = db.query(Student).filter(
            (Student.prn == username) | (Student.roll_no == username)
        ).first()
        if row and verify_password(password, row.password_hash):
            user = row
            token_data = {"sub": str(row.student_id), "role": "student", "name": row.name}
            extra = {"class_": row.class_, "semester": row.semester, "roll_no": row.roll_no, "prn": row.prn, "must_change_password": row.must_change_password, "profile_photo": getattr(row, "profile_photo", None)}
            actor_id, actor_name = row.student_id, row.name

    elif role == "teacher":
        norm = username.replace(" ", "")
        row = db.query(Teacher).filter(func.replace(Teacher.phone, " ", "") == norm).first()
        if not row:
            row = db.query(Teacher).filter(Teacher.email == username).first()
        if row and verify_password(password, row.password_hash):
            user = row
            token_data = {"sub": str(row.teacher_id), "role": "teacher", "name": row.name}
            extra = {"must_change_password": row.must_change_password, "profile_photo": getattr(row, "profile_photo", None)}
            actor_id, actor_name = row.teacher_id, row.name

    elif role == "hod":
        norm = username.replace(" ", "")
        row = db.query(HOD).filter(func.replace(HOD.phone, " ", "") == norm).first()
        if not row:
            row = db.query(HOD).filter(HOD.email == username).first()
        if row and verify_password(password, row.password_hash):
            user = row
            managed = [hc.class_name for hc in row.hod_classes]
            token_data = {"sub": str(row.hod_id), "role": "hod", "name": row.name}
            extra = {"phone": row.phone, "department": row.department, "managed_classes": managed, "profile_photo": getattr(row, "profile_photo", None)}
            actor_id, actor_name = row.hod_id, row.name

    elif role == "admin":
        row = db.query(Admin).filter(Admin.email == username).first()
        if row and verify_password(password, row.password_hash):
            user = row
            token_data = {"sub": str(row.admin_id), "role": "admin", "name": row.name}
            actor_id, actor_name = row.admin_id, row.name


    else:
        raise HTTPException(status_code=400, detail="Invalid role")

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Log login
    activity.log(db, role, actor_id, actor_name, "LOGIN", ip=ip)
    db.commit()

    id_field = {"student": "student_id", "teacher": "teacher_id",
                "admin": "admin_id", "hod": "hod_id"}.get(role, "student_id")

    return TokenResponse(
        access_token=create_access_token(token_data),
        role=role,
        name=user.name,
        user_id=getattr(user, id_field),
        extra=extra or None,
    )
