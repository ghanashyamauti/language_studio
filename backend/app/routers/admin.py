import csv
from typing import List, Optional, Any
from io import StringIO
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException, Request, File, UploadFile, Form
from fastapi.responses import StreamingResponse
import pandas as pd
import io
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.auth import require_role, hash_password
from app.models import Student, Teacher, TeacherAssignment, Attendance, Admin, HOD, HodClass, ActivityLog, Holiday, Notification, CollegeSettings, Subject, Department, ClassSubject
from app.schemas import (
    CreateHODRequest, CreateTeacherRequest, UpdateTeacherRequest, HODOut, TeacherOut,
    ActivityLogOut, BulkImportRequest, TeacherImportRequest,
    AssignClassToHODRequest, HolidayCreate, NotificationCreate,
    PublicStatsResponse, BulkAttendanceCorrectionRequest, AssignTeacherRequest,
    CollegeSettingsUpdate, CollegeSettingsOut, AdminResetPasswordRequest, ChangePasswordRequest,
    AdminCreateClassRequest, AdminUpdateClassRequest, SubjectOut, SubjectCreate, SubjectUpdate,
    DepartmentOut, DepartmentCreate, DepartmentUpdate, StudentOut, CreateStudentRequest,
)
from app.pdf_utils import generate_defaulters_pdf, generate_teacher_report_pdf
from app import activity

router = APIRouter(prefix="/admin", tags=["admin"])


def _get_settings(db: Session) -> CollegeSettings:
    """Get or create the single college settings row."""
    s = db.query(CollegeSettings).first()
    if not s:
        s = CollegeSettings(college_name="Language Craft Studio", logo_url="/lcs-logo.png", attendance_threshold=75)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


def _get_creator_name(db: Session, role: str, id: int) -> str:
    if not role or not id:
        return "System"
    if role == "admin":
        a = db.query(Admin).filter(Admin.admin_id == id).first()
        return a.name if a else f"Admin #{id}"
    if role == "hod":
        h = db.query(HOD).filter(HOD.hod_id == id).first()
        return h.name if h else f"HOD #{id}"
    return f"{role} #{id}"


@router.get("/overview")
def admin_overview(db: Session = Depends(get_db), user: dict = Depends(require_role("admin"))):
    # Total stats
    total_depts = db.query(Department).count()
    total_hods = db.query(HOD).count()
    total_teachers = db.query(Teacher).count()
    total_students = db.query(Student).count()
    total_classes = db.query(HodClass.class_name).distinct().count()
    
    # Detailed department data
    depts_data = []
    depts = db.query(Department).all()
    for d in depts:
        from app.models import HodDepartment
        hod_count = db.query(HOD).filter(
            (HOD.dept_id == d.dept_id) | 
            HOD.hod_id.in_(db.query(HodDepartment.hod_id).filter(HodDepartment.dept_id == d.dept_id))
        ).distinct().count()
        class_count = db.query(HodClass).filter(HodClass.dept_id == d.dept_id).count()
        subject_count = db.query(Subject).filter(Subject.dept_id == d.dept_id).count()
        student_count = db.query(Student).filter(Student.class_.in_(
            db.query(HodClass.class_name).filter(HodClass.dept_id == d.dept_id)
        )).count()
        depts_data.append({
            "dept_id": d.dept_id,
            "name": d.name,
            "hod_count": hod_count,
            "class_count": class_count,
            "subject_count": subject_count,
            "student_count": student_count
        })
        
    # All HODs with their classes
    hods_list = []
    hods = db.query(HOD).all()
    for h in hods:
        hods_list.append({
            "hod_id": h.hod_id,
            "name": h.name,
            "dept_name": ", ".join([d.name for d in h.dept_mappings]) if h.dept_mappings else (h.dept_obj.name if h.dept_obj else h.department),
            "dept_names": [d.name for d in h.dept_mappings],
            "dept_ids": [d.dept_id for d in h.dept_mappings],
            "classes": [hc.class_name for hc in h.hod_classes]
        })
        
    # All Teachers with assignments
    teachers_list = []
    teachers = db.query(Teacher).all()
    for t in teachers:
        teachers_list.append({
            "teacher_id": t.teacher_id,
            "name": t.name,
            "phone": t.phone,
            "assignments": [{"subject": a.subject, "class": a.class_} for a in t.assignments]
        })
        
    return {
        "total_stats": {
            "departments": total_depts,
            "hods": total_hods,
            "teachers": total_teachers,
            "students": total_students,
            "classes": total_classes
        },
        "departments": depts_data,
        "hods": hods_list,
        "teachers": teachers_list
    }


# ── Public stats (no auth) ────────────────────────────────────────────────────
@router.get("/public-stats", response_model=PublicStatsResponse)
def public_stats(db: Session = Depends(get_db)):
    all_class_names = set(
        r.class_ for r in db.query(Student.class_).distinct().all()
    ) | set(
        r.class_name for r in db.query(HodClass.class_name).distinct().all()
    )
    return PublicStatsResponse(
        total_students=db.query(func.count(Student.student_id)).scalar(),
        total_teachers=db.query(func.count(Teacher.teacher_id)).scalar(),
        total_classes=len(all_class_names),
        total_hods=db.query(func.count(HOD.hod_id)).scalar(),
    )


# ── Public settings (no auth — for login page branding) ──────────────────────
@router.get("/public-settings")
def public_settings(db: Session = Depends(get_db)):
    s = _get_settings(db)
    return {
        "college_name": s.college_name,
        "college_short_name": s.college_short_name,
        "college_address": s.college_address,
        "logo_url": s.logo_url,
        "attendance_threshold": s.attendance_threshold,
        "academic_year": s.academic_year,
    }


# ── College Settings (admin auth) ─────────────────────────────────────────────
@router.get("/settings", response_model=CollegeSettingsOut)
def get_settings(
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    return _get_settings(db)


@router.put("/settings", response_model=CollegeSettingsOut)
def update_settings(
    payload: CollegeSettingsUpdate,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    s = _get_settings(db)
    s.college_name = payload.college_name
    s.college_short_name = payload.college_short_name
    s.college_address = payload.college_address
    s.logo_url = payload.logo_url
    s.attendance_threshold = max(1, min(100, payload.attendance_threshold))
    s.academic_year = payload.academic_year
    db.commit()
    db.refresh(s)
    return s


# ── Student Password Reset (Admin) ────────────────────────────────────────────
@router.post("/students/{student_id}/reset-password")
def admin_reset_student_password(
    student_id: int,
    request: Request,
    payload: AdminResetPasswordRequest = None,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(404, "Student not found")
    
    if payload and payload.new_password:
        student.password_hash = hash_password(payload.new_password)
        student.must_change_password = False
        msg = "Password updated"
    else:
        student.password_hash = hash_password("Test@123")
        student.must_change_password = True
        msg = f"Password reset for {student.name}. New password: Test@123"
        
    activity.log(db, "admin", int(user["sub"]), user["name"],
                 "RESET_STUDENT_PASSWORD", target=f"{student.name} ({student.roll_no})",
                 ip=request.client.host)
    db.commit()
    return {"message": msg}


@router.get("/students", response_model=List[StudentOut])
def list_students(
    dept_id: Optional[int] = Query(None),
    class_name: Optional[str] = Query(None),
    search: str = Query(""),
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    q = db.query(Student)
    
    if dept_id:
        dept_classes = db.query(HodClass.class_name).filter(HodClass.dept_id == dept_id).all()
        class_names = [c[0] for c in dept_classes]
        q = q.filter(Student.class_.in_(class_names))
        
    if class_name:
        q = q.filter(Student.class_ == class_name)
        
    if search:
        q = q.filter((Student.name.ilike(f"%{search}%")) | (Student.roll_no.ilike(f"%{search}%")))
        
    students = q.order_by(Student.roll_no).all()
    return [
        StudentOut(
            student_id=s.student_id,
            roll_no=s.roll_no,
            prn=s.prn,
            name=s.name,
            class_=s.class_,
            semester=s.semester,
            created_by_name=_get_creator_name(db, s.created_by_role, s.created_by_id)
        ) for s in students
    ]


@router.patch("/students/{student_id}")
def update_student(
    student_id: int,
    payload: CreateStudentRequest,
    request: Request,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    s = db.query(Student).filter(Student.student_id == student_id).first()
    if not s:
        raise HTTPException(404, "Student not found")
        
    # Check roll_no conflict
    if payload.roll_no != s.roll_no:
        if db.query(Student).filter(Student.roll_no == payload.roll_no).first():
            raise HTTPException(400, "Roll number already in use")
            
    s.name = payload.name
    s.roll_no = payload.roll_no
    if payload.prn != s.prn:
        if db.query(Student).filter(Student.prn == payload.prn).first():
            raise HTTPException(400, "PRN already in use")
    s.prn = payload.prn
    s.class_ = payload.class_
    s.semester = payload.semester
    if payload.password and payload.password != "Test@123":
        s.password_hash = hash_password(payload.password)
        s.must_change_password = False
        
    activity.log(db, "admin", int(user["sub"]), user["name"],
                 "UPDATE_STUDENT", target=s.name, ip=request.client.host)
    db.commit()
    return {"message": "Student updated"}


@router.delete("/students/{student_id}")
def admin_delete_student(
    student_id: int,
    request: Request,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    s = db.query(Student).filter(Student.student_id == student_id).first()
    if not s:
        raise HTTPException(404, "Student not found")
    name = s.name
    db.delete(s)
    activity.log(db, "admin", int(user["sub"]), user["name"], "DELETE_STUDENT", target=name, ip=request.client.host)
    db.commit()
    return {"message": "Student deleted"}

@router.post("/students", status_code=201)
def admin_create_student(
    payload: CreateStudentRequest,
    request: Request,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    if db.query(Student).filter(Student.roll_no == payload.roll_no).first():
        raise HTTPException(400, "Student with this roll number already exists")
    if payload.prn and db.query(Student).filter(Student.prn == payload.prn).first():
        raise HTTPException(400, "Student with this PRN already exists")
    
    student = Student(
        roll_no=payload.roll_no,
        prn=payload.prn,
        name=payload.name,
        class_=payload.class_,
        semester=payload.semester,
        password_hash=hash_password(payload.password or "Test@123"),
        created_by_role="admin",
        created_by_id=int(user["sub"])
    )
    db.add(student)
    activity.log(db, "admin", int(user["sub"]), user["name"], "CREATE_STUDENT", target=payload.name, ip=request.client.host)
    db.commit()
    return {"message": f"Student {student.name} created successfully"}


@router.post("/hods/{hod_id}/reset-password")
def admin_reset_hod_password(
    hod_id: int,
    payload: AdminResetPasswordRequest,
    request: Request,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    hod = db.query(HOD).filter(HOD.hod_id == hod_id).first()
    if not hod:
        raise HTTPException(status_code=404, detail="HOD not found")
    hod.password_hash = hash_password(payload.new_password)
    activity.log(db, "admin", int(user["sub"]), user["name"],
                 "RESET_HOD_PASSWORD", target=hod.name, ip=request.client.host)
    db.commit()
    return {"message": "HOD password updated"}

@router.post("/teachers/{teacher_id}/reset-password")
def admin_reset_teacher_password(
    teacher_id: int,
    payload: AdminResetPasswordRequest,
    request: Request,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    t = db.query(Teacher).filter(Teacher.teacher_id == teacher_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Teacher not found")
    t.password_hash = hash_password(payload.new_password)
    activity.log(db, "admin", int(user["sub"]), user["name"],
                 "RESET_TEACHER_PASSWORD", target=t.name, ip=request.client.host)
    db.commit()
    return {"message": "Teacher password updated"}

@router.post("/change-password")
def change_admin_password(
    payload: ChangePasswordRequest,
    request: Request,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    admin_id = int(user["sub"])
    admin = db.query(Admin).filter(Admin.admin_id == admin_id).first()
    if not admin or not verify_password(payload.current_password, admin.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    admin.password_hash = hash_password(payload.new_password)
    activity.log(db, "admin", int(user["sub"]), user["name"],
                 "CHANGE_PASSWORD", target=admin.name, ip=request.client.host)
    db.commit()
    return {"message": "Password updated successfully"}


# ── Helpers ───────────────────────────────────────────────────────────────────
def _get_creator_name(db: Session, role: str, actor_id: int):
    if not role or not actor_id:
        return "System"
    if role == "admin":
        a = db.query(Admin).filter(Admin.admin_id == actor_id).first()
        return a.name if a else f"Admin #{actor_id}"
    if role == "hod":
        h = db.query(HOD).filter(HOD.hod_id == actor_id).first()
        return h.name if h else f"HOD #{actor_id}"
    return f"{role} #{actor_id}"

def _build_report(db, students, start, end, subject=None):
    report = []
    for s in students:
        q = db.query(Attendance).filter(
            Attendance.student_id == s.student_id,
            Attendance.date.between(start, end),
        )
        if subject:
            q = q.filter(Attendance.subject == subject)
        rows = q.all()
        total = len(rows)
        attended = sum(1 for r in rows if r.status == "Present")
        percent = (attended / total * 100) if total > 0 else 0.0
        report.append({
            "student_id": s.student_id, "roll_no": s.roll_no, "name": s.name, "class_": s.class_,
            "total": total, "attended": attended, "percent": round(percent, 2),
            "created_by_name": _get_creator_name(db, s.created_by_role, s.created_by_id)
        })
    return report


# ── Overview ──────────────────────────────────────────────────────────────────
# ── Department Management ──────────────────────────────────────────────────────
@router.get("/departments", response_model=List[DepartmentOut])
def list_departments(user: dict = Depends(require_role("admin", "hod")), db: Session = Depends(get_db)):
    return db.query(Department).order_by(Department.name).all()


@router.post("/departments", status_code=201)
def create_department(
    payload: DepartmentCreate,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    if db.query(Department).filter(Department.name == payload.name).first():
        raise HTTPException(400, "Department already exists")
    
    code = payload.code.strip() if payload.code and payload.code.strip() != "" else None
    if code and db.query(Department).filter(Department.code == code).first():
        raise HTTPException(400, "Department code already in use")
        
    data = payload.model_dump()
    data['code'] = code
    db.add(Department(**data))
    db.commit()
    return {"message": "Department created"}


@router.patch("/departments/{dept_id}")
def update_department(
    dept_id: int,
    payload: DepartmentUpdate,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    d = db.query(Department).filter(Department.dept_id == dept_id).first()
    if not d:
        raise HTTPException(404, "Department not found")
        
    code = payload.code.strip() if payload.code and payload.code.strip() != "" else None
    if code and code != d.code:
        if db.query(Department).filter(Department.code == code).first():
            raise HTTPException(400, "Department code already in use")

    d.name = payload.name
    d.code = code
    d.description = payload.description
    db.commit()
    return {"message": "Department updated"}


@router.delete("/departments/{dept_id}")
def delete_department(
    dept_id: int,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    d = db.query(Department).filter(Department.dept_id == dept_id).first()
    if not d:
        raise HTTPException(404, "Department not found")
    db.delete(d)
    db.commit()
    return {"message": "Department deleted"}


@router.get("/overview")
def admin_overview(
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    # Get all entities
    depts = db.query(Department).all()
    hods = db.query(HOD).all()
    teachers = db.query(Teacher).all()
    classes = db.query(HodClass).all()
    students = db.query(Student).all()
    subjects = db.query(Subject).all()

    # Build departmental breakdown
    dept_stats = []
    for d in depts:
        d_hods = [h for h in hods if h.dept_id == d.dept_id]
        d_subjects = [s for s in subjects if s.dept_id == d.dept_id]
        d_classes = [c for c in classes if c.dept_id == d.dept_id]
        
        class_names = [c.class_name for c in d_classes]
        d_students = [s for s in students if s.class_ in class_names]
        
        dept_stats.append({
            "dept_id": d.dept_id,
            "name": d.name,
            "code": d.code,
            "hod_count": len(d_hods),
            "subject_count": len(d_subjects),
            "class_count": len(d_classes),
            "student_count": len(d_students),
            "hods": [{"id": h.hod_id, "name": h.name} for h in d_hods]
        })

    # Legacy flat lists for compatibility
    hod_list = []
    for h in hods:
        classes_h = [hc.class_name for hc in h.hod_classes]
        hod_list.append({
            "hod_id": h.hod_id, "name": h.name, "phone": h.phone,
            "email": h.email, "department": h.department, "dept_id": h.dept_id,
            "dept_name": h.dept_obj.name if h.dept_obj else h.department,
            "classes": classes_h,
        })

    teacher_list = []
    for t in teachers:
        assigns = db.query(TeacherAssignment).filter(TeacherAssignment.teacher_id == t.teacher_id).all()
        teacher_list.append({
            "teacher_id": t.teacher_id, "name": t.name, "phone": t.phone,
            "assignments": [{"subject": a.subject, "class": a.class_} for a in assigns],
        })

    return {
        "departments": dept_stats,
        "hods": hod_list,
        "teachers": teacher_list,
        "total_stats": {
            "departments": len(depts),
            "hods": len(hods),
            "teachers": len(teachers),
            "students": len(students),
            "classes": len(set(s.class_ for s in students) | set(c.class_name for c in classes))
        }
    }


# ── Analytics ─────────────────────────────────────────────────────────────────
@router.get("/analytics")
def admin_analytics(
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Rich analytics: daily trend, per-class stats, teacher performance."""
    today = datetime.now().date()
    thirty_ago = today - timedelta(days=29)

    # Daily attendance trend (last 30 days)
    trend = []
    for i in range(30):
        d = (thirty_ago + timedelta(days=i)).strftime("%Y-%m-%d")
        total = db.query(func.count(Attendance.attendance_id)).filter(Attendance.date == d).scalar()
        present = db.query(func.count(Attendance.attendance_id)).filter(
            Attendance.date == d, Attendance.status == "Present").scalar()
        trend.append({"date": d, "total": total, "present": present,
                      "percent": round(present / total * 100, 1) if total else 0})

    # Per-class attendance overview
    student_classes = set(r.class_ for r in db.query(Student.class_).distinct().all())
    hod_class_names = set(r.class_name for r in db.query(HodClass.class_name).distinct().all())
    all_classes = sorted(student_classes | hod_class_names)

    class_stats = []
    for cls in all_classes:
        students = db.query(func.count(Student.student_id)).filter(Student.class_ == cls).scalar()
        att = db.query(Attendance).filter(
            Attendance.class_ == cls,
            Attendance.date.between(thirty_ago.strftime("%Y-%m-%d"), today.strftime("%Y-%m-%d"))
        ).all()
        total_att = len(att)
        present_att = sum(1 for a in att if a.status == "Present")
        class_stats.append({
            "class_name": cls,
            "students": students,
            "attendance_percent": round(present_att / total_att * 100, 1) if total_att else 0,
        })

    # Teacher performance: sessions marked in last 30 days
    teachers = db.query(Teacher).all()
    teacher_perf = []
    for t in teachers:
        sessions = db.query(func.count(func.distinct(
            func.concat(Attendance.class_, Attendance.subject, Attendance.date)
        ))).filter(
            Attendance.teacher_id == t.teacher_id,
            Attendance.date.between(thirty_ago.strftime("%Y-%m-%d"), today.strftime("%Y-%m-%d"))
        ).scalar()
        last_marked = db.query(func.max(Attendance.date)).filter(Attendance.teacher_id == t.teacher_id).scalar()
        teacher_perf.append({
            "teacher_id": t.teacher_id,
            "name": t.name,
            "sessions_last_30d": sessions or 0,
            "last_marked": last_marked,
        })
    teacher_perf.sort(key=lambda x: x["sessions_last_30d"], reverse=True)

    # Defaulters count
    start_str = thirty_ago.strftime("%Y-%m-%d")
    end_str = today.strftime("%Y-%m-%d")
    students = db.query(Student).all()
    defaulter_count = 0
    for s in students:
        rows = db.query(Attendance).filter(
            Attendance.student_id == s.student_id,
            Attendance.date.between(start_str, end_str),
        ).all()
        if rows:
            pct = sum(1 for r in rows if r.status == "Present") / len(rows) * 100
            if pct < 75:
                defaulter_count += 1

    return {
        "trend": trend,
        "class_stats": class_stats,
        "teacher_performance": teacher_perf,
        "defaulter_count": defaulter_count,
        "period": {"start": start_str, "end": end_str},
    }


# ── HOD Management ────────────────────────────────────────────────────────────
@router.get("/hods", response_model=List[HODOut])
def list_hods(user: dict = Depends(require_role("admin")), db: Session = Depends(get_db)):
    hods = db.query(HOD).order_by(HOD.name).all()
    return [
        HODOut(
            hod_id=h.hod_id, name=h.name, phone=h.phone, email=h.email,
            department=h.department, dept_id=h.dept_id,
            dept_name=h.dept_obj.name if h.dept_obj else h.department,
            dept_ids=[d.dept_id for d in h.dept_mappings],
            dept_names=[d.name for d in h.dept_mappings],
            classes=[hc.class_name for hc in h.hod_classes],
            created_at=h.created_at
        ) for h in hods
    ]


@router.post("/hods", status_code=201)
def create_hod(
    payload: CreateHODRequest,
    request: Request,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    if db.query(HOD).filter(HOD.phone == payload.phone).first():
        raise HTTPException(400, "Phone already in use")
        
    email = payload.email.strip() if payload.email and payload.email.strip() != "" else None
    if email and db.query(HOD).filter(HOD.email == email).first():
        raise HTTPException(400, "Email already in use")

    department = payload.department.strip() if payload.department and payload.department.strip() != "" else None
    primary_dept_id = payload.dept_id or (payload.dept_ids[0] if payload.dept_ids else None)

    hod = HOD(
        name=payload.name, phone=payload.phone, email=email,
        department=department, dept_id=primary_dept_id,
        password_hash=hash_password(payload.password or "Manager@123"),
        created_by_admin_id=int(user["sub"]),
    )
    db.add(hod)
    db.flush()

    from app.models import HodDepartment
    for d_id in payload.dept_ids:
        exists = db.query(HodDepartment).filter(HodDepartment.hod_id == hod.hod_id, HodDepartment.dept_id == d_id).first()
        if not exists:
            db.add(HodDepartment(hod_id=hod.hod_id, dept_id=d_id))
    if not payload.dept_ids and primary_dept_id:
        db.add(HodDepartment(hod_id=hod.hod_id, dept_id=primary_dept_id))

    for cls in (payload.class_names or []):
        exists = db.query(HodClass).filter(HodClass.hod_id == hod.hod_id, HodClass.class_name == cls).first()
        if not exists:
            db.add(HodClass(hod_id=hod.hod_id, class_name=cls, dept_id=primary_dept_id))

    activity.log(db, "admin", int(user["sub"]), user["name"],
                 "CREATE_HOD", target=payload.name,
                 detail={"classes": payload.class_names}, ip=request.client.host)
    db.commit()
    return {"hod_id": hod.hod_id, "message": "HOD created successfully"}


@router.patch("/hods/{hod_id}")
def update_hod(
    hod_id: int,
    payload: CreateHODRequest,
    request: Request,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    hod = db.query(HOD).filter(HOD.hod_id == hod_id).first()
    if not hod:
        raise HTTPException(404, "HOD not found")
        
    if payload.phone != hod.phone and db.query(HOD).filter(HOD.phone == payload.phone).first():
        raise HTTPException(400, "Phone already in use")

    email = payload.email.strip() if payload.email and payload.email.strip() != "" else None
    if email and email != hod.email and db.query(HOD).filter(HOD.email == email).first():
        raise HTTPException(400, "Email already in use")
        
    department = payload.department.strip() if payload.department and payload.department.strip() != "" else None
    primary_dept_id = payload.dept_id or (payload.dept_ids[0] if payload.dept_ids else None)

    hod.name = payload.name
    hod.phone = payload.phone
    hod.email = email
    hod.department = department
    hod.dept_id = primary_dept_id
    if payload.password:
        hod.password_hash = hash_password(payload.password)
        
    from app.models import HodDepartment
    db.query(HodDepartment).filter(HodDepartment.hod_id == hod_id).delete()
    for d_id in payload.dept_ids:
        db.add(HodDepartment(hod_id=hod_id, dept_id=d_id))
    if not payload.dept_ids and primary_dept_id:
        db.add(HodDepartment(hod_id=hod_id, dept_id=primary_dept_id))

    db.query(HodClass).filter(HodClass.hod_id == hod_id).delete()
    for cls in (payload.class_names or []):
        db.add(HodClass(hod_id=hod_id, class_name=cls, dept_id=primary_dept_id))
    activity.log(db, "admin", int(user["sub"]), user["name"],
                 "UPDATE_HOD", target=hod.name, ip=request.client.host)
    db.commit()
    return {"message": "HOD updated"}


@router.delete("/hods/{hod_id}")
def delete_hod(
    hod_id: int,
    request: Request,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    hod = db.query(HOD).filter(HOD.hod_id == hod_id).first()
    if not hod:
        raise HTTPException(404, "HOD not found")
    # Show affected classes before delete
    affected_classes = [hc.class_name for hc in hod.hod_classes]
    name = hod.name
    db.delete(hod)
    activity.log(db, "admin", int(user["sub"]), user["name"], "DELETE_HOD",
                 target=name, detail={"affected_classes": affected_classes},
                 ip=request.client.host)
    db.commit()
    return {"message": "HOD deleted", "affected_classes": affected_classes}


@router.post("/hods/assign-class")
def assign_class_to_hod(
    payload: AssignClassToHODRequest,
    request: Request,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    hod = db.query(HOD).filter(HOD.hod_id == payload.hod_id).first()
    if not hod:
        raise HTTPException(404, "HOD not found")
    exists = db.query(HodClass).filter(HodClass.hod_id == payload.hod_id, HodClass.class_name == payload.class_name).first()
    if not exists:
        db.add(HodClass(hod_id=payload.hod_id, class_name=payload.class_name))
    activity.log(db, "admin", int(user["sub"]), user["name"],
                 "ASSIGN_CLASS_TO_HOD", target=f"{hod.name} → {payload.class_name}", ip=request.client.host)
    db.commit()
    return {"message": "Class assigned"}


# ── Class Management ─────────────────────────────────────────────────────────
@router.get("/classes")
def list_classes(user: dict = Depends(require_role("admin")), db: Session = Depends(get_db)):
    """Return all strictly valid classes from the catalog with rich details."""
    classes = db.query(HodClass).all()
    result = []
    for c in classes:
        student_count = db.query(Student).filter(Student.class_ == c.class_name).count()
        hod_name = db.query(HOD.name).filter(HOD.hod_id == c.hod_id).scalar() if c.hod_id else None
        # Get dept info from dept_id if available, else from HOD's dept
        dept_name = None
        dept_id = c.dept_id
        if c.dept_obj:
            dept_name = c.dept_obj.name
        elif c.hod_id:
            hod = db.query(HOD).filter(HOD.hod_id == c.hod_id).first()
            if hod and hod.dept_obj:
                dept_name = hod.dept_obj.name
                dept_id = hod.dept_id
        # Get subjects assigned to this class
        class_subjects = db.query(ClassSubject.subject_id).filter(ClassSubject.class_name == c.class_name).all()
        assigned_subject_ids = [s[0] for s in class_subjects]
        
        result.append({
            "class_name": c.class_name,
            "department": c.department,
            "dept_id": dept_id,
            "dept_name": dept_name,
            "division": c.division,
            "semester": c.semester,
            "hod": hod_name,
            "student_count": student_count,
            "assigned_subjects": assigned_subject_ids
        })
    return sorted(result, key=lambda x: x["class_name"])

@router.post("/classes", status_code=201)
def create_class(
    payload: AdminCreateClassRequest,
    request: Request,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Create a class (optionally assign to a HOD)."""
    class_name = payload.class_name.strip()
    hod_id = payload.hod_id
    dept_id = payload.dept_id

    # If HOD is selected, prefer their department if not explicitly provided
    if hod_id and not dept_id:
        hod = db.query(HOD).filter(HOD.hod_id == hod_id).first()
        if hod:
            dept_id = hod.dept_id

    # Check if a mapping for this class already exists
    exists = db.query(HodClass).filter(HodClass.class_name == class_name).first()
    if exists:
        # If it exists, update it
        exists.hod_id = hod_id
        exists.dept_id = dept_id
        exists.semester = payload.semester
    else:
        # Create new mapping
        db.add(HodClass(
            class_name=class_name,
            hod_id=hod_id,
            dept_id=dept_id,
            semester=payload.semester
        ))

    activity.log(db, "admin", int(user["sub"]), user["name"],
                 "CREATE_CLASS", target=class_name, ip=request.client.host)
    
    # Assign subjects
    # Remove old ones if we are "re-creating"
    db.query(ClassSubject).filter(ClassSubject.class_name == class_name).delete()
    for sub_id in payload.subjects:
        db.add(ClassSubject(class_name=class_name, subject_id=sub_id))
    
    db.commit()
    return {"message": f"Class '{class_name}' created/updated"}


@router.patch("/classes/{class_name}")
def update_class(
    class_name: str,
    payload: AdminUpdateClassRequest,
    request: Request,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Update a class name, semester, and HOD assignment."""
    new_name = payload.class_name.strip()
    new_semester = payload.semester
    hod_id = payload.hod_id

    if not new_name:
        raise HTTPException(400, "class_name is required")

    # Update HOD assignments (HodClass rows)
    # Since class name is used as an identifier in Student and Attendance,
    # if the name changes, we need to update those tables too.
    
    if new_name != class_name:
        # Check if new name already exists
        exists = db.query(HodClass).filter(HodClass.class_name == new_name).first()
        if exists:
            raise HTTPException(400, f"Class '{new_name}' already exists")
        
        # Update Student table
        db.query(Student).filter(Student.class_ == class_name).update({"class_": new_name})
        # Update Attendance table
        db.query(Attendance).filter(Attendance.class_ == class_name).update({"class_": new_name})
        # Update TeacherAssignment table
        db.query(TeacherAssignment).filter(TeacherAssignment.class_ == class_name).update({"class_": new_name})
        # Update HodClass table
        db.query(HodClass).filter(HodClass.class_name == class_name).update({"class_name": new_name})
        # Update ClassSubject table
        db.query(ClassSubject).filter(ClassSubject.class_name == class_name).update({"class_name": new_name})

    # Update semester if provided
    if new_semester is not None:
        db.query(HodClass).filter(HodClass.class_name == (new_name or class_name)).update({"semester": new_semester})
        db.query(Student).filter(Student.class_ == (new_name or class_name)).update({"semester": new_semester})

    # Update HOD/Dept assignment
    if hod_id is not None or payload.dept_id is not None:
        # Update existing HodClass row
        hc = db.query(HodClass).filter(HodClass.class_name == (new_name or class_name)).first()
        if hc:
            if hod_id is not None: hc.hod_id = hod_id if hod_id != 0 else None
            if payload.dept_id is not None: hc.dept_id = payload.dept_id
            if new_semester is not None: hc.semester = new_semester
        elif hod_id or payload.dept_id:
            # Create if it didn't exist
            db.add(HodClass(
                hod_id=hod_id if hod_id != 0 else None,
                dept_id=payload.dept_id,
                class_name=(new_name or class_name),
                semester=new_semester or 2
            ))

    # Update assigned subjects
    db.query(ClassSubject).filter(ClassSubject.class_name == (new_name or class_name)).delete()
    for sub_id in payload.subjects:
        db.add(ClassSubject(class_name=(new_name or class_name), subject_id=sub_id))

    activity.log(db, "admin", int(user["sub"]), user["name"],
                 "UPDATE_CLASS", target=f"{class_name} → {new_name}", ip=request.client.host)
    db.commit()
    return {"message": "Class updated successfully"}


@router.delete("/classes/{class_name}")
def delete_class(
    class_name: str,
    request: Request,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Remove a class from all HOD assignments (does not delete students)."""
    deleted = db.query(HodClass).filter(HodClass.class_name == class_name).delete()
    activity.log(db, "admin", int(user["sub"]), user["name"],
                 "DELETE_CLASS", target=class_name, ip=request.client.host)
    db.commit()
    return {"message": f"Class '{class_name}' removed", "rows_deleted": deleted}


# ── Teacher Management ────────────────────────────────────────────────────────
@router.get("/teachers", response_model=List[TeacherOut])
def list_teachers(user: dict = Depends(require_role("admin")), db: Session = Depends(get_db)):
    teachers = db.query(Teacher).order_by(Teacher.name).all()
    return [
        TeacherOut(
            teacher_id=t.teacher_id, 
            name=t.name, 
            phone=t.phone,
            dept_id=t.dept_id,
            dept_name=t.dept_obj.name if t.dept_obj else None,
            assignments=[{"id": a.assignment_id, "subject": a.subject, "class": a.class_} for a in t.assignments],
            created_by_name=_get_creator_name(db, t.created_by_role, t.created_by_id)
        ) for t in teachers
    ]


@router.post("/teachers", status_code=201)
def create_teacher(
    payload: CreateTeacherRequest,
    request: Request,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    # Check if teacher exists (by phone or name)
    existing = db.query(Teacher).filter((Teacher.phone == payload.phone) | (func.lower(Teacher.name) == payload.name.lower().strip())).first()
    if existing:
        raise HTTPException(400, f"Teacher with phone '{payload.phone}' or name '{payload.name}' already exists")
    t = Teacher(
        name=payload.name, phone=payload.phone,
        dept_id=payload.dept_id,
        password_hash=hash_password(payload.password),
        created_by_role="admin",
        created_by_id=int(user["sub"])
    )
    db.add(t)
    activity.log(db, "admin", int(user["sub"]), user["name"],
                 "CREATE_TEACHER", target=payload.name, ip=request.client.host)
    db.commit()
    return {"message": "Teacher created"}


@router.patch("/teachers/{teacher_id}")
def update_teacher(
    teacher_id: int,
    payload: UpdateTeacherRequest,
    request: Request,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    t = db.query(Teacher).filter(Teacher.teacher_id == teacher_id).first()
    if not t:
        raise HTTPException(404, "Teacher not found")
    
    # Check if phone is being changed to an existing one
    if payload.phone != t.phone:
        if db.query(Teacher).filter(Teacher.phone == payload.phone).first():
            raise HTTPException(400, "Phone already in use")
    
    t.name = payload.name
    t.phone = payload.phone
    t.dept_id = payload.dept_id
    if payload.password:
        t.password_hash = hash_password(payload.password)
        t.must_change_password = True
    activity.log(db, "admin", int(user["sub"]), user["name"],
                 "UPDATE_TEACHER", target=t.name, ip=request.client.host)
    db.commit()
    return {"message": "Teacher updated"}


@router.post("/teachers/{teacher_id}/assignments")
def add_assignment(
    teacher_id: int,
    payload: AssignTeacherRequest,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    # Check for duplicate
    existing = db.query(TeacherAssignment).filter(
        TeacherAssignment.teacher_id == teacher_id,
        TeacherAssignment.subject == payload.subject,
        TeacherAssignment.class_ == payload.class_name
    ).first()
    if existing:
        raise HTTPException(400, "Assignment already exists")
    
    db.add(TeacherAssignment(teacher_id=teacher_id, subject=payload.subject, class_=payload.class_name))
    db.commit()
    return {"message": "Assignment added"}


@router.delete("/teachers/{teacher_id}/assignments/{assignment_id}")
def remove_assignment(
    teacher_id: int,
    assignment_id: int,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    a = db.query(TeacherAssignment).filter(
        TeacherAssignment.assignment_id == assignment_id,
        TeacherAssignment.teacher_id == teacher_id
    ).first()
    if not a:
        raise HTTPException(404, "Assignment not found")
    db.delete(a)
    db.commit()
    return {"message": "Assignment removed"}


# ── Subject Management ────────────────────────────────────────────────────────
@router.get("/subjects", response_model=List[SubjectOut])
def list_subjects(user: dict = Depends(require_role("admin", "hod")), db: Session = Depends(get_db)):
    subjects = db.query(Subject).order_by(Subject.name).all()
    result = []
    for s in subjects:
        # Find all classes where this subject is taught
        class_mappings = db.query(ClassSubject.class_name).filter(ClassSubject.subject_id == s.subject_id).all()
        assigned_classes = sorted(list(set([m[0] for m in class_mappings])))
        
        # Get multiple departments
        dept_ids = [d.dept_id for d in s.dept_mappings]
        dept_names = [d.name for d in s.dept_mappings]
        
        result.append(SubjectOut(
            subject_id=s.subject_id, name=s.name, code=s.code,
            department=s.department, dept_id=s.dept_id,
            dept_name=s.dept_obj.name if s.dept_obj else s.department,
            dept_ids=dept_ids,
            dept_names=dept_names,
            assigned_classes=assigned_classes,
            created_by_name=_get_creator_name(db, s.created_by_role, s.created_by_id)
        ))
        
    return result


@router.post("/subjects", status_code=201)
def create_subject(
    payload: SubjectCreate,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    normalized_name = payload.name.strip().title()
    if db.query(Subject).filter(func.lower(Subject.name) == normalized_name.lower()).first():
        raise HTTPException(400, f"Subject '{normalized_name}' already exists")
        
    code = payload.code.strip() if payload.code and payload.code.strip() != "" else None
    if code and db.query(Subject).filter(Subject.code == code).first():
        raise HTTPException(400, "Subject code already in use")

    new_sub = Subject(
        name=normalized_name,
        code=code,
        dept_id=payload.dept_id or (payload.dept_ids[0] if payload.dept_ids else None),
        created_by_role="admin",
        created_by_id=int(user["sub"])
    )
    db.add(new_sub)
    db.flush()
    
    # Assign multiple departments
    if payload.dept_ids:
        for d_id in payload.dept_ids:
            db.add(SubjectDepartment(subject_id=new_sub.subject_id, dept_id=d_id))
            
    # Assign multiple classes
    for class_name in payload.classes:
        db.add(ClassSubject(class_name=class_name, subject_id=new_sub.subject_id))
        
    db.commit()
    return {"message": "Subject created"}


@router.patch("/subjects/{subject_id}")
def update_subject(
    subject_id: int,
    payload: SubjectUpdate,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    s = db.query(Subject).filter(Subject.subject_id == subject_id).first()
    if not s:
        raise HTTPException(404, "Subject not found")
    normalized_name = payload.name.strip().title()
    
    conflict = db.query(Subject).filter(
        func.lower(Subject.name) == normalized_name.lower(),
        Subject.subject_id != subject_id
    ).first()
    if conflict:
        raise HTTPException(400, f"Subject '{normalized_name}' already exists")
        
    code = payload.code.strip() if payload.code and payload.code.strip() != "" else None
    if code and code != s.code and db.query(Subject).filter(Subject.code == code).first():
        raise HTTPException(400, "Subject code already in use")

    s.name = normalized_name
    s.code = code
    s.dept_id = payload.dept_id or (payload.dept_ids[0] if payload.dept_ids else None)
    
    # Update departments
    db.query(SubjectDepartment).filter(SubjectDepartment.subject_id == subject_id).delete()
    for d_id in payload.dept_ids:
        db.add(SubjectDepartment(subject_id=subject_id, dept_id=d_id))
        
    # Update assigned classes
    db.query(ClassSubject).filter(ClassSubject.subject_id == subject_id).delete()
    for class_name in payload.classes:
        db.add(ClassSubject(class_name=class_name, subject_id=subject_id))
        
    db.commit()
    return {"message": "Subject updated"}


@router.delete("/subjects/{subject_id}")
def delete_subject(
    subject_id: int,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    s = db.query(Subject).filter(Subject.subject_id == subject_id).first()
    if not s:
        raise HTTPException(404, "Subject not found")
    db.delete(s)
    db.commit()
    return {"message": "Subject deleted"}


@router.get("/classes/{class_name}/subjects")
def get_class_subjects(
    class_name: str,
    user: dict = Depends(require_role("admin", "hod", "teacher")),
    db: Session = Depends(get_db),
):
    # Get subjects from assignments for this class
    a_subjects = db.query(TeacherAssignment.subject).filter(TeacherAssignment.class_ == class_name).all()
    # And from class-subject mappings
    from app.models import ClassSubject, Subject
    m_subjects = db.query(Subject.name).join(ClassSubject).filter(ClassSubject.class_name == class_name).all()
    
    unique_subjects = sorted(list(set([s[0] for s in a_subjects] + [s[0] for s in m_subjects])))
    return unique_subjects


@router.delete("/teachers/{teacher_id}")
def delete_teacher(
    teacher_id: int,
    request: Request,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    t = db.query(Teacher).filter(Teacher.teacher_id == teacher_id).first()
    if not t:
        raise HTTPException(404, "Teacher not found")
    name = t.name
    db.delete(t)
    activity.log(db, "admin", int(user["sub"]), user["name"], "DELETE_TEACHER", target=name, ip=request.client.host)
    db.commit()
    return {"message": "Teacher deleted"}


# ── Activity Logs ─────────────────────────────────────────────────────────────
@router.get("/activity-logs")
def get_activity_logs(
    actor_role: str = Query(None),
    action: str = Query(None),
    search: str = Query(""),
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    q = db.query(ActivityLog)
    if actor_role:
        q = q.filter(ActivityLog.actor_role == actor_role)
    if action:
        q = q.filter(ActivityLog.action == action)
    if search:
        q = q.filter(
            (ActivityLog.actor_name.ilike(f"%{search}%")) |
            (ActivityLog.target.ilike(f"%{search}%"))
        )
    total = q.count()
    logs = q.order_by(ActivityLog.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "logs": [{"log_id": l.log_id, "actor_role": l.actor_role, "actor_name": l.actor_name,
                  "action": l.action, "target": l.target, "detail": l.detail,
                  "ip_address": l.ip_address, "created_at": l.created_at} for l in logs],
        "total": total, "page": page,
        "total_pages": (total + limit - 1) // limit if total > 0 else 1,
    }


# ── Attendance Reports ────────────────────────────────────────────────────────
@router.get("/reports")
def admin_reports(
    class_: str = Query(None), 
    subject: str = Query(None),
    dept_id: Optional[int] = Query(None),
    search: str = Query(""), 
    start: str = Query(None), 
    end: str = Query(None),
    page: int = Query(1, ge=1), 
    limit: int = Query(20, ge=1, le=100),
    sort_by: str = Query("roll_no_asc"),
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    if not start or not end:
        end_date = datetime.now().date()
        start = (end_date - timedelta(days=6)).strftime("%Y-%m-%d")
        end = end_date.strftime("%Y-%m-%d")

    # Get metadata for filter dropdowns
    all_hod_classes = db.query(HodClass.class_name, HodClass.dept_id).all()
    all_subjects = db.query(Subject).all()
    subjects_list = sorted([s.name for s in all_subjects])

    # Build student query with robust filtering
    q = db.query(Student)
    
    # Filter by Department if provided
    if dept_id:
        # Get all class names for this department
        class_names = [r[0] for r in db.query(HodClass.class_name).filter(HodClass.dept_id == dept_id).all()]
        # If no classes found for this dept, we must filter for something that returns nothing
        if not class_names:
            q = q.filter(Student.student_id == -1)
        else:
            q = q.filter(Student.class_.in_(class_names))
    
    # Filter by Class (overrides or refines department)
    if class_ and class_.strip():
        q = q.filter(Student.class_ == class_.strip())

    # Filter by Subject
    if subject and subject.strip():
        subj_name = subject.strip()
        # Find classes taking this subject
        mapped_classes = db.query(ClassSubject.class_name).join(Subject).filter(Subject.name == subj_name).all()
        assigned_classes = db.query(TeacherAssignment.class_).filter(TeacherAssignment.subject == subj_name).all()
        subj_classes = list(set([c[0] for c in mapped_classes] + [c[0] for c in assigned_classes]))
        
        # Student MUST be in a class that has this subject
        q = q.filter(Student.class_.in_(subj_classes))

    # Search filter
    if search and search.strip():
        s_term = f"%{search.strip()}%"
        q = q.filter((Student.roll_no.ilike(s_term)) | (Student.name.ilike(s_term)))

    students = q.all()
    report = _build_report(db, students, start, end, subject)

    # Filter out 0-lecture students if a subject is selected
    if subject:
        report = [r for r in report if r["total"] > 0]

    # Sorting
    if sort_by == "roll_no_asc":
        report.sort(key=lambda x: x["roll_no"])
    elif sort_by == "roll_no_desc":
        report.sort(key=lambda x: x["roll_no"], reverse=True)
    elif sort_by == "name_asc":
        report.sort(key=lambda x: x["name"].lower())
    elif sort_by == "name_desc":
        report.sort(key=lambda x: x["name"].lower(), reverse=True)
    elif sort_by == "percent_asc":
        report.sort(key=lambda x: x["percent"])
    elif sort_by == "percent_desc":
        report.sort(key=lambda x: x["percent"], reverse=True)

    defaulters = [r for r in report if r["percent"] < 75.0]
    total = len(report)

    return {
        "report": report[(page - 1) * limit: page * limit],
        "defaulters": defaulters,
        "classes": sorted(list(set(c.class_name for c in all_hod_classes))), 
        "subjects": subjects_list,
        "start": start, "end": end,
        "page": page, "total_pages": (total + limit - 1) // limit if total > 0 else 1,
    }



# ── Bulk Attendance Correction (Admin) ────────────────────────────────────────
@router.get("/reports/teachers")
def admin_teacher_report(
    start: str = Query(None),
    end: str = Query(None),
    dept_id: Optional[int] = Query(None),
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    if not start or not end:
        end_date = datetime.now().date()
        start = (end_date - timedelta(days=29)).strftime("%Y-%m-%d")
        end = end_date.strftime("%Y-%m-%d")

    q = db.query(Teacher)
    if dept_id:
        q = q.filter(Teacher.dept_id == dept_id)
        
    teachers = q.all()
    report = []
    for t in teachers:
        # Count sessions marked (distinct class, subject, date)
        sessions = db.query(func.count(func.distinct(
            func.concat(Attendance.class_, Attendance.subject, Attendance.date)
        ))).filter(
            Attendance.teacher_id == t.teacher_id,
            Attendance.date.between(start, end)
        ).scalar()
        
        last_marked = db.query(func.max(Attendance.date)).filter(Attendance.teacher_id == t.teacher_id).scalar()
        
        report.append({
            "teacher_id": t.teacher_id,
            "name": t.name,
            "phone": t.phone,
            "dept_name": t.dept_obj.name if t.dept_obj else "N/A",
            "sessions_count": sessions or 0,
            "last_marked": last_marked,
        })
    
    report.sort(key=lambda x: x["sessions_count"], reverse=True)
    return {"report": report, "start": start, "end": end}


@router.post("/attendance/correct")
def correct_attendance(
    payload: BulkAttendanceCorrectionRequest,
    request: Request,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    from app.models import TeacherAssignment
    updated = 0
    # Pre-fetch teacher_id for the class/subject
    assign = db.query(TeacherAssignment).filter(
        TeacherAssignment.class_ == payload.class_,
        TeacherAssignment.subject == payload.subject
    ).first()
    teacher_id = assign.teacher_id if assign else None

    for student_id_str, status in payload.statuses.items():
        if status not in ("Present", "Absent"):
            continue
        student_id = int(student_id_str)
        existing = db.query(Attendance).filter(
            Attendance.student_id == student_id,
            Attendance.subject == payload.subject,
            Attendance.class_ == payload.class_,
            Attendance.date == payload.date,
        ).first()
        if existing:
            existing.status = status
            updated += 1
        elif teacher_id:
            db.add(Attendance(
                student_id=student_id,
                teacher_id=teacher_id,
                subject=payload.subject,
                class_=payload.class_,
                date=payload.date,
                status=status
            ))
            updated += 1
            
    activity.log(db, "admin", int(user["sub"]), user["name"], "BULK_CORRECTION",
                 target=f"{payload.class_}/{payload.subject}/{payload.date}",
                 detail={"updated": updated}, ip=request.client.host)
    db.commit()
    return {"updated": updated, "message": f"Updated {updated} attendance records"}


# ── Holidays ─────────────────────────────────────────────────────────────────
@router.get("/holidays")
def list_holidays(db: Session = Depends(get_db)):
    holidays = db.query(Holiday).order_by(Holiday.date).all()
    return [{"holiday_id": h.holiday_id, "date": h.date, "name": h.name, "created_by": h.created_by} for h in holidays]


@router.post("/holidays", status_code=201)
def create_holiday(
    payload: HolidayCreate,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    existing = db.query(Holiday).filter(Holiday.date == payload.date).first()
    if existing:
        raise HTTPException(400, f"Holiday already exists on {payload.date}")
    h = Holiday(date=payload.date, name=payload.name, created_by=user["name"])
    db.add(h)
    db.commit()
    return {"message": "Holiday added", "holiday_id": h.holiday_id}


@router.delete("/holidays/{holiday_id}")
def delete_holiday(
    holiday_id: int,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    h = db.query(Holiday).filter(Holiday.holiday_id == holiday_id).first()
    if not h:
        raise HTTPException(404, "Holiday not found")
    db.delete(h)
    db.commit()
    return {"message": "Holiday removed"}


# ── Notifications ─────────────────────────────────────────────────────────────
@router.get("/notifications")
def list_notifications(
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    notifs = db.query(Notification).order_by(Notification.created_at.desc()).limit(100).all()
    return [{"notification_id": n.notification_id, "title": n.title, "message": n.message,
             "recipient_role": n.recipient_role, "recipient_id": n.recipient_id,
             "is_read": n.is_read, "created_at": n.created_at} for n in notifs]


@router.post("/notifications", status_code=201)
def create_notification(
    payload: NotificationCreate,
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    n = Notification(
        recipient_role=payload.recipient_role,
        recipient_id=payload.recipient_id,
        title=payload.title,
        message=payload.message,
        created_by_role="admin",
        created_by_id=int(user["sub"]),
    )
    db.add(n)
    db.commit()
    return {"message": "Notification sent", "notification_id": n.notification_id}



# ── Exports ───────────────────────────────────────────────────────────────────
@router.get("/export/csv")
def export_csv(
    class_: str = Query(None), 
    subject: str = Query(None),
    dept_id: Optional[int] = Query(None),
    start: str = Query(None), 
    end: str = Query(None),
    type: str = Query("all"),
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    if not start or not end:
        end_date = datetime.now().date()
        start = (end_date - timedelta(days=6)).strftime("%Y-%m-%d")
        end = end_date.strftime("%Y-%m-%d")
        
    q = db.query(Student)
    if dept_id:
        dept_classes = db.query(HodClass.class_name).filter(HodClass.dept_id == dept_id).all()
        q = q.filter(Student.class_.in_([c[0] for c in dept_classes]))
    
    if class_ and class_.strip():
        q = q.filter(Student.class_ == class_.strip())
    
    if subject and subject.strip():
        subj_name = subject.strip()
        mapped_classes = db.query(ClassSubject.class_name).join(Subject).filter(Subject.name == subj_name).all()
        assigned_classes = db.query(TeacherAssignment.class_).filter(TeacherAssignment.subject == subj_name).all()
        subj_classes = list(set([c[0] for c in mapped_classes] + [c[0] for c in assigned_classes]))
        if subj_classes:
            q = q.filter(Student.class_.in_(subj_classes))
        else:
            q = q.filter(Student.student_id == -1)

    if type == "teachers":
        q_teach = db.query(Teacher)
        if dept_id: q_teach = q_teach.filter(Teacher.dept_id == dept_id)
        teachers = q_teach.all()
        
        buf = StringIO()
        writer = csv.writer(buf)
        writer.writerow(["Teacher Name", "Department", "Phone", "Sessions Marked", "Last Activity", "Period From", "Period To"])
        for t in teachers:
            sessions = db.query(func.count(func.distinct(func.concat(Attendance.class_, Attendance.subject, Attendance.date)))).filter(
                Attendance.teacher_id == t.teacher_id, Attendance.date.between(start, end)
            ).scalar()
            last = db.query(func.max(Attendance.date)).filter(Attendance.teacher_id == t.teacher_id).scalar()
            writer.writerow([t.name, t.dept_obj.name if t.dept_obj else "N/A", t.phone, sessions or 0, last or "Never", start, end])
        buf.seek(0)
        return StreamingResponse(iter([buf.getvalue().encode("utf-8")]), media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=teacher_sessions_{start}_to_{end}.csv"})

    students = q.order_by(Student.roll_no).all()
    buf = StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Roll No", "Name", "Class", "Total Lectures", "Attended", "% Attendance"])
    for s in students:
        q2 = db.query(Attendance).filter(Attendance.student_id == s.student_id, Attendance.date.between(start, end))
        if subject:
            q2 = q2.filter(Attendance.subject == subject)
        rows = q2.all()
        total = len(rows)
        attended = sum(1 for r in rows if r.status == "Present")
        percent = (attended / total * 100) if total > 0 else 0.0
        if subject and total == 0:
            continue
        writer.writerow([s.roll_no, s.name, s.class_, total, attended, f"{round(percent,2)}%"])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue().encode("utf-8")]), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=attendance_report.csv"})


@router.get("/export/pdf")
def export_pdf(
    start: str = Query(None), 
    end: str = Query(None),
    class_: str = Query(None, alias="class_"),
    subject: str = Query(None),
    dept_id: Optional[int] = Query(None),
    type: str = Query("all"), # all | defaulters | teachers
    user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    if not start or not end:
        end_date = datetime.now().date()
        start = (end_date - timedelta(days=60)).strftime("%Y-%m-%d") # Default to 60 days for PDF
        end = end_date.strftime("%Y-%m-%d")
    
    if type == "teachers":
        q_teach = db.query(Teacher)
        if dept_id: q_teach = q_teach.filter(Teacher.dept_id == dept_id)
        teachers = q_teach.all()
        report_rows = []
        for t in teachers:
            sessions = db.query(func.count(func.distinct(func.concat(Attendance.class_, Attendance.subject, Attendance.date)))).filter(
                Attendance.teacher_id == t.teacher_id, Attendance.date.between(start, end)
            ).scalar()
            last = db.query(func.max(Attendance.date)).filter(Attendance.teacher_id == t.teacher_id).scalar()
            report_rows.append((t.name, t.dept_obj.name if t.dept_obj else "N/A", t.phone, sessions or 0, last or "Never"))
        
        buf = generate_teacher_report_pdf("Faculty Session Report", f"Period: {start} to {end}", report_rows, settings=_get_settings_dict(db))
        return StreamingResponse(buf, media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=teacher_report_{start}_{end}.pdf"})

    # 1. Get students
    q = db.query(Student)
    if dept_id:
        dept_classes = db.query(HodClass.class_name).filter(HodClass.dept_id == dept_id).all()
        q = q.filter(Student.class_.in_([c[0] for c in dept_classes]))

    if class_ and class_.strip():
        q = q.filter(Student.class_ == class_.strip())
        
    if subject and subject.strip():
        subj_name = subject.strip()
        mapped_classes = db.query(ClassSubject.class_name).join(Subject).filter(Subject.name == subj_name).all()
        assigned_classes = db.query(TeacherAssignment.class_).filter(TeacherAssignment.subject == subj_name).all()
        subj_classes = list(set([c[0] for c in mapped_classes] + [c[0] for c in assigned_classes]))
        if subj_classes:
            q = q.filter(Student.class_.in_(subj_classes))
        else:
            q = q.filter(Student.student_id == -1)

    students = q.order_by(Student.roll_no).all()
    
    report_rows = []
    for s in students:
        q_att = db.query(Attendance).filter(Attendance.student_id == s.student_id, Attendance.date.between(start, end))
        if subject:
            q_att = q_att.filter(Attendance.subject == subject)
        
        att_records = q_att.all()
        total = len(att_records)
        attended = sum(1 for r in att_records if r.status == "Present")
        percent = (attended / total * 100) if total > 0 else 0.0
        
        if subject and total == 0:
            continue
            
        # Format for PDF: (roll, name, class, attended, total, percent)
        report_rows.append((s.roll_no, s.name, s.class_, attended, total, round(percent, 2)))

    # 2. Filter if defaulters requested
    if type == "defaulters":
        report_rows = [r for r in report_rows if r[5] < 75]
        title = "Defaulters Report (< 75%)"
        subtitle = f"Period: {start} to {end}"
        if class_: subtitle += f" | Class: {class_}"
        buf = generate_defaulters_pdf(title, report_rows, settings=_get_settings_dict(db))
    else:
        title = "Full Attendance Report"
        subtitle = f"Period: {start} to {end}"
        if class_: subtitle += f" | Class: {class_}"
        # generate_attendance_pdf expects (roll, name, total, attended, percent)
        # we have (roll, name, class, attended, total, percent)
        # let's adapt it or use a custom one. 
        # Actually, let's use generate_defaulters_pdf but with a blue title for "All"
        buf = generate_defaulters_pdf(title, report_rows, settings=_get_settings_dict(db))

    return StreamingResponse(buf, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=attendance_report_{type}.pdf"})

def _get_settings_dict(db):
    s = _get_settings(db)
    return {"college_name": s.college_name, "college_address": s.college_address}


# ── Bulk Imports ──────────────────────────────────────────────────────────────
@router.post("/students/import")
def import_students(
    payload: BulkImportRequest,
    request: Request,
    user: dict = Depends(require_role("admin", "hod")),
    db: Session = Depends(get_db),
):
    added = updated = 0
    errors = []
    
    # Validate Class
    if not db.query(HodClass).filter(HodClass.class_name == payload.class_).first():
        raise HTTPException(400, f"Class '{payload.class_}' does not exist. Please create it in the system first.")

    for i, raw in enumerate(payload.data.splitlines(), 1):
        line = raw.strip()
        if not line:
            continue
        roll = prn = name = None
        if "," in line:
            parts = [p.strip() for p in line.split(",") if p.strip()]
            if len(parts) >= 3:
                roll, prn, name = parts[0], parts[1], ",".join(parts[2:]).strip()
        else:
            parts = line.split()
            if len(parts) >= 3:
                roll, prn = parts[0], parts[1]
                name = " ".join(parts[2:])
        if not roll or not prn or not name:
            errors.append(f"Line {i}: invalid format")
            continue
        existing = db.query(Student).filter((Student.roll_no == roll) | (Student.prn == prn)).first()
        if existing:
            if existing.roll_no != roll and db.query(Student).filter(Student.roll_no == roll).first():
                 errors.append(f"Line {i}: roll_no {roll} already exists for another student")
                 continue
            existing.prn = prn; existing.name = name
            existing.class_ = payload.class_; existing.semester = payload.semester
            updated += 1
        else:
            db.add(Student(roll_no=roll, prn=prn, name=name,
                           class_=payload.class_, semester=payload.semester,
                           password_hash=hash_password("Test@123"),
                           created_by_role=user["role"], created_by_id=int(user["sub"])))
            added += 1
    activity.log(db, user["role"], int(user["sub"]), user["name"],
                 "IMPORT_STUDENTS", target=payload.class_,
                 detail={"added": added, "updated": updated}, ip=request.client.host)
    db.commit()
    return {"added": added, "updated": updated, "errors": errors}


@router.post("/teachers/import")
def import_teachers(
    payload: TeacherImportRequest,
    request: Request,
    user: dict = Depends(require_role("admin", "hod")),
    db: Session = Depends(get_db),
):
    added = updated = 0
    errors = []
    for i, raw in enumerate(payload.data.splitlines(), 1):
        line = raw.strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 4: # Class is optional in some contexts but here we need it for assignment
            errors.append(f"Line {i}: need name,phone,password,subject,class")
            continue
        
        # Name, Phone, Password, Subject, Class
        name = parts[0]
        phone = parts[1]
        password = parts[2] if len(parts) > 2 and parts[2].strip() else "Teacher@123"
        subject = parts[3] if len(parts) > 3 else "Unknown"
        cls = ",".join(parts[4:]) if len(parts) > 4 else "Unknown"
        
        existing = db.query(Teacher).filter((Teacher.phone == phone) | (Teacher.name == name)).first()
        if existing:
            existing.name = name; existing.phone = phone
            teacher_id = existing.teacher_id; updated += 1
        else:
            t = Teacher(name=name, phone=phone, 
                        password_hash=hash_password(password),
                        must_change_password=True,
                        created_by_role=user["role"], created_by_id=int(user["sub"]))
            db.add(t); db.flush(); teacher_id = t.teacher_id; added += 1
            
        # Subject Validation
        subj_obj = db.query(Subject).filter(Subject.name == subject).first()
        if not subj_obj:
            errors.append(f"Line {i}: Subject '{subject}' does not exist in catalog. Skipping assignment.")
            continue

        # Class Validation
        class_obj = db.query(HodClass).filter(HodClass.class_name == cls).first()
        if not class_obj:
            errors.append(f"Line {i}: Class '{cls}' does not exist in catalog. Skipping assignment.")
            continue

        if not db.query(TeacherAssignment).filter(
            TeacherAssignment.teacher_id == teacher_id,
            TeacherAssignment.subject == subject, TeacherAssignment.class_ == cls
        ).first():
            db.add(TeacherAssignment(teacher_id=teacher_id, subject=subject, class_=cls))
            
    activity.log(db, user["role"], int(user["sub"]), user["name"],
                 "IMPORT_TEACHERS", detail={"added": added, "updated": updated}, ip=request.client.host)
    db.commit()
    return {"added": added, "updated": updated, "errors": errors}


@router.post("/teachers/import-file")
async def import_teachers_from_file(
    file: UploadFile = File(...),
    request: Request = None,
    user: dict = Depends(require_role("admin", "hod")),
    db: Session = Depends(get_db),
):
    """Import teachers and assignments from CSV/Excel."""
    try:
        contents = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        elif file.filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(400, "Unsupported file format")
    except Exception as e:
        raise HTTPException(400, f"Error reading file: {str(e)}")

    # Standardize column names
    df.columns = [c.lower().strip().replace(' ', '_') for c in df.columns]
    
    # Required columns check: name, phone, subject, class (password optional)
    required = {'name', 'phone', 'subject', 'class'}
    if not required.issubset(df.columns):
        # Fallback to positional if headers don't match
        if len(df.columns) >= 4:
             df.columns = ['name', 'phone', 'password', 'subject', 'class'] + list(df.columns[5:])
        else:
            raise HTTPException(400, f"File must have name, phone, subject, class columns. Found: {list(df.columns)}")

    added = updated = 0
    errors = []
    
    for i, row in df.iterrows():
        try:
            name = str(row['name']).strip()
            phone = str(row['phone']).strip()
            password = str(row.get('password', 'Teacher@123')).strip()
            if password == 'nan' or not password: password = "Teacher@123"
            subject = str(row['subject']).strip()
            cls = str(row['class']).strip()
            
            if not name or name == 'nan' or not phone or phone == 'nan':
                errors.append(f"Row {i+2}: Missing name or phone")
                continue
                
            existing = db.query(Teacher).filter((Teacher.phone == phone) | (Teacher.name == name)).first()
            if existing:
                existing.name = name; existing.phone = phone
                teacher_id = existing.teacher_id; updated += 1
            else:
                t = Teacher(name=name, phone=phone, 
                            password_hash=hash_password(password),
                            must_change_password=True,
                            created_by_role=user["role"], created_by_id=int(user["sub"]))
                db.add(t); db.flush(); teacher_id = t.teacher_id; added += 1
                
            # Subject Validation
            subj_obj = db.query(Subject).filter(Subject.name == subject).first()
            if not subj_obj:
                errors.append(f"Row {i+2}: Subject '{subject}' does not exist in catalog. Skipping assignment.")
                continue

            # Class Validation
            class_obj = db.query(HodClass).filter(HodClass.class_name == cls).first()
            if not class_obj:
                errors.append(f"Row {i+2}: Class '{cls}' does not exist in catalog. Skipping assignment.")
                continue

            # Assignment
            if not db.query(TeacherAssignment).filter(
                TeacherAssignment.teacher_id == teacher_id,
                TeacherAssignment.subject == subject, TeacherAssignment.class_ == cls
            ).first():
                db.add(TeacherAssignment(teacher_id=teacher_id, subject=subject, class_=cls))
                
        except Exception as e:
            errors.append(f"Row {i+2}: {str(e)}")

    activity.log(db, user["role"], int(user["sub"]), user["name"], "IMPORT_TEACHERS_FILE",
                 detail={"added": added, "updated": updated, "filename": file.filename},
                 ip=request.client.host if request else None)
    db.commit()
    return {"added": added, "updated": updated, "errors": errors}


@router.get("/teachers/import-template")
def get_teacher_import_template():
    """Download a template CSV for teacher import."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["name", "phone", "password", "subject", "class"])
    writer.writerow(["Dr. Khan A.A.", "9923684446", "Khan@123", "FBDA", "SYMCA Div A"])
    writer.writerow(["Dr. Aarif Sir", "7006867886", "Aarif@123", "BSE", "SYMCA Div B"])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue().encode("utf-8")]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=teacher_import_template.csv"}
    )


@router.get("/students/import-template")
def get_student_import_template():
    """Download a template CSV for student import."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["roll_no", "prn", "name"])
    writer.writerow(["T23CO001", "23CO001", "John Doe"])
    writer.writerow(["T23CO002", "23CO002", "Jane Smith"])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue().encode("utf-8")]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=student_import_template.csv"}
    )


@router.post("/students/import-file")
async def import_students_from_file(
    class_: str = Form(...),
    semester: int = Form(...),
    file: UploadFile = File(...),
    request: Request = None,
    user: dict = Depends(require_role("admin", "hod")),
    db: Session = Depends(get_db),
):
    """Import students from a CSV or Excel file."""
    try:
        contents = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        elif file.filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(400, "Unsupported file format. Please upload CSV or Excel.")
    except Exception as e:
        raise HTTPException(400, f"Error reading file: {str(e)}")

    # Standardize column names
    df.columns = [c.lower().strip().replace(' ', '_') for c in df.columns]
    
    # Required columns check
    required = {'roll_no', 'prn', 'name'}
    if not required.issubset(df.columns):
        # Try to find columns by position if names don't match
        if len(df.columns) >= 3:
            df.columns = ['roll_no', 'prn', 'name'] + list(df.columns[3:])
        else:
            raise HTTPException(400, f"File must have at least 3 columns: roll_no, prn, name. Found: {list(df.columns)}")

    added = updated = 0
    errors = []
    
    # Validate Class
    if not db.query(HodClass).filter(HodClass.class_name == class_).first():
        raise HTTPException(400, f"Class '{class_}' does not exist. Please create it in the system first.")
    
    for i, row in df.iterrows():
        try:
            roll = str(row['roll_no']).strip()
            prn = str(row['prn']).strip()
            name = str(row['name']).strip()
            
            if not roll or roll == 'nan' or not name or name == 'nan':
                errors.append(f"Row {i+2}: Missing roll_no or name")
                continue
                
            existing = db.query(Student).filter((Student.roll_no == roll) | (Student.prn == prn)).first()
            if existing:
                if existing.roll_no != roll and db.query(Student).filter(Student.roll_no == roll).first():
                     errors.append(f"Row {i+2}: roll_no {roll} already exists for another student")
                     continue
                existing.prn = prn
                existing.name = name
                existing.class_ = class_
                existing.semester = semester
                updated += 1
            else:
                db.add(Student(
                    roll_no=roll, prn=prn, name=name,
                    class_=class_, semester=semester,
                    password_hash=hash_password("Test@123"),
                    created_by_role=user["role"], created_by_id=int(user["sub"])
                ))
                added += 1
        except Exception as e:
            errors.append(f"Row {i+2}: {str(e)}")

    activity.log(db, user["role"], int(user["sub"]), user["name"],
                 "IMPORT_STUDENTS_FILE", target=class_,
                 detail={"added": added, "updated": updated, "filename": file.filename}, 
                 ip=request.client.host if request else None)
    db.commit()
    return {"added": added, "updated": updated, "errors": errors}
