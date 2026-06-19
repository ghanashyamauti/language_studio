from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, Request, File, UploadFile, Form
from fastapi.responses import StreamingResponse
import pandas as pd
import io
from io import StringIO
import csv
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func, or_

from app.database import get_db
from app import activity
from app.auth import require_role, hash_password, verify_password
from app.models import (HOD, HodClass, Teacher, TeacherAssignment, Student,
                        Attendance, Notification, Holiday, Department, Subject, SubjectDepartment, ClassSubject, ClassDepartment)
from app.schemas import (CreateClassRequest, AssignTeacherRequest, HodReportRow,
                         RemoveStudentRequest, ChangePasswordRequest,
                         ClassImportRequest, NotificationCreate,
                         AdminResetPasswordRequest, UpdateProfileRequest,
                         CreateTeacherRequest, UpdateTeacherRequest, CreateStudentRequest, SubjectCreate, SubjectUpdate, SubjectOut,
                         TeacherImportRequest, StudentOut)
from app.pdf_utils import generate_attendance_pdf
from app.cache import global_cache

router = APIRouter(prefix="/hod", tags=["hod"])


@router.get("/profile")
def get_profile(
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    hod = db.query(HOD).filter(HOD.hod_id == hod_id).first()
    if not hod:
        raise HTTPException(404, "HOD not found")
    return {
        "name": hod.name,
        "email": hod.email,
        "phone": hod.phone,
        "department": hod.dept_obj.name if hod.dept_obj else hod.department,
        "dept_id": hod.dept_id,
        "dept_ids": [d.dept_id for d in hod.dept_mappings],
        "dept_names": [d.name for d in hod.dept_mappings],
        "profile_photo": hod.profile_photo
    }


@router.put("/profile")
def update_profile(
    payload: UpdateProfileRequest,
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    hod = db.query(HOD).filter(HOD.hod_id == hod_id).first()
    if not hod:
        raise HTTPException(404, "HOD not found")
    
    if payload.phone != hod.phone:
        existing = db.query(HOD).filter(HOD.phone == payload.phone).first()
        if existing:
            raise HTTPException(400, "Phone number already in use")
    
    hod.name = payload.name
    hod.email = payload.email
    hod.phone = payload.phone
    hod.department = payload.department
    db.commit()
    return {"message": "Profile updated successfully"}


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    from app.auth import hash_password as hp, verify_password
    hod_id = int(user["sub"])
    hod = db.query(HOD).filter(HOD.hod_id == hod_id).first()
    if not hod or not verify_password(payload.current_password, hod.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    hod.password_hash = hp(payload.new_password)
    activity.log(db, "hod", hod_id, user["name"], "CHANGE_PASSWORD",
                 target=hod.name, ip=request.client.host)
    db.commit()
    return {"message": "Password updated successfully"}


@router.post("/upload-profile")
def upload_profile(
    file: UploadFile = File(...),
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db)
):
    import os
    import uuid
    from app.s3_utils import upload_file_to_s3
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
        raise HTTPException(400, "Invalid image format")
    
    filename = f"hod_{user['sub']}_{uuid.uuid4().hex}{ext}"
    url_path = upload_file_to_s3(file, filename, file.content_type)
        
    hod_id = int(user["sub"])
    hod = db.query(HOD).filter(HOD.hod_id == hod_id).first()
    if not hod:
        raise HTTPException(404, "HOD not found")
        
    hod.profile_photo = url_path
    db.commit()
    return {"profile_photo": url_path}


def _get_hod_classes(hod_id: int, db: Session):
    hod = db.query(HOD).filter(HOD.hod_id == hod_id).first()
    if not hod:
        return []
    dept_ids = [d.dept_id for d in hod.dept_mappings]
    if hod.dept_id and hod.dept_id not in dept_ids:
        dept_ids.append(hod.dept_id)
        
    class_names = db.query(HodClass.class_name).filter(
        (HodClass.dept_id.in_(dept_ids)) |
        (HodClass.class_name.in_(db.query(ClassDepartment.class_name).filter(ClassDepartment.dept_id.in_(dept_ids)))) |
        (HodClass.hod_id == hod_id)
    ).distinct().all()
    return [r[0] for r in class_names]


@router.get("/dashboard")
def hod_dashboard(
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    cache_key = f"hod:{hod_id}:dashboard"
    cached = global_cache.get(cache_key)
    if cached is not None:
        return cached

    hod = db.query(HOD).filter(HOD.hod_id == hod_id).first()
    if not hod:
        raise HTTPException(404, "HOD not found")

    dept_ids = [d.dept_id for d in hod.dept_mappings]
    if hod.dept_id and hod.dept_id not in dept_ids:
        dept_ids.append(hod.dept_id)

    class_names = _get_hod_classes(hod_id, db)
    classes_data = []
    for cls in class_names:
        hc = db.query(HodClass).filter(HodClass.class_name == cls).first()
        assignments = db.query(TeacherAssignment).filter(TeacherAssignment.class_ == cls).all()
        mappings = db.query(Subject.name).join(ClassSubject).filter(ClassSubject.class_name == cls).all()
        mapped_subjects = [m[0] for m in mappings]
        
        count = db.query(Student).filter(Student.class_ == cls).count()
        
        c_dept_ids = [d.dept_id for d in hc.dept_mappings] if hc else []
        c_dept_names = [d.name for d in hc.dept_mappings] if hc else []
        
        classes_data.append({
            "class_name": cls,
            "division": hc.division if hc else None,
            "department": ", ".join(c_dept_names) if c_dept_names else (hc.department if hc else (hc.dept_obj.name if hc and hc.dept_obj else None)),
            "dept_ids": c_dept_ids,
            "dept_names": c_dept_names,
            "semester": hc.semester if hc else 2,
            "student_count": count,
            "assignments": [{"subject": a.subject, "teacher_id": a.teacher_id} for a in assignments],
            "subjects": sorted(list(set([a.subject for a in assignments] + mapped_subjects)))
        })

    teachers = db.query(Teacher).options(
        joinedload(Teacher.dept_obj),
        selectinload(Teacher.assignments)
    ).order_by(Teacher.name).all()
    all_teachers = [
        {
            "teacher_id": t.teacher_id, 
            "name": t.name, 
            "phone": t.phone,
            "email": t.email,
            "dept_name": t.dept_obj.name if t.dept_obj else None,
            "assignments": [{"subject": a.subject, "class": a.class_} for a in t.assignments if a.class_ in class_names],
            "profile_photo": t.profile_photo
        } for t in teachers
    ]

    today = datetime.now().date()
    thirty_ago = today - timedelta(days=29)
    start = thirty_ago.strftime("%Y-%m-%d")
    end = today.strftime("%Y-%m-%d")

    alerts = []
    if class_names:
        students = db.query(Student).filter(Student.class_.in_(class_names)).all()
        if students:
            student_map = {s.student_id: s for s in students}
            student_ids = list(student_map.keys())
            
            attendance_rows = db.query(Attendance.student_id, Attendance.status).filter(
                Attendance.student_id.in_(student_ids),
                Attendance.date.between(start, end)
            ).all()
            
            attendance_by_student = {}
            for s_id, status in attendance_rows:
                attendance_by_student.setdefault(s_id, []).append(status)
                
            for s_id, statuses in attendance_by_student.items():
                if statuses:
                    present_count = sum(1 for status in statuses if status == "Present")
                    pct = (present_count / len(statuses)) * 100
                    if pct < 75:
                        s = student_map[s_id]
                        alerts.append({
                            "class_": s.class_,
                            "roll_no": s.roll_no,
                            "name": s.name,
                            "percent": round(pct, 1)
                        })

    res = {
        "hod": {
            "hod_id": hod.hod_id, "name": hod.name, "phone": hod.phone,
            "email": hod.email, 
            "department": hod.dept_obj.name if hod.dept_obj else hod.department,
            "dept_id": hod.dept_id,
            "dept_ids": dept_ids,
            "dept_names": [d.name for d in hod.dept_mappings]
        },
        "classes": classes_data,
        "all_teachers": all_teachers,
        "low_attendance_alerts": alerts[:20],
    }
    global_cache.set(cache_key, res)
    return res


@router.get("/classes")
def get_classes(
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    cache_key = f"hod:{hod_id}:classes"
    cached = global_cache.get(cache_key)
    if cached is not None:
        return cached

    class_names = _get_hod_classes(hod_id, db)
    result = []
    for cls in class_names:
        hc = db.query(HodClass).filter(HodClass.class_name == cls).first()
        students = db.query(Student).filter(Student.class_ == cls).order_by(Student.roll_no).all()
        assignments = db.query(TeacherAssignment).filter(TeacherAssignment.class_ == cls).all()
        mappings = db.query(Subject.name).join(ClassSubject).filter(ClassSubject.class_name == cls).all()
        mapped_subjects = [m[0] for m in mappings]
        
        c_dept_ids = [d.dept_id for d in hc.dept_mappings] if hc else []
        c_dept_names = [d.name for d in hc.dept_mappings] if hc else []
        
        result.append({
            "class_name": cls,
            "division": hc.division if hc else None,
            "department": ", ".join(c_dept_names) if c_dept_names else (hc.department if hc else (hc.dept_obj.name if hc and hc.dept_obj else None)),
            "dept_ids": c_dept_ids,
            "dept_names": c_dept_names,
            "semester": hc.semester if hc else 2,
            "students": [{"student_id": s.student_id, "roll_no": s.roll_no, "name": s.name,
                           "prn": s.prn, "semester": s.semester, "subjects": [sub.name for sub in s.subjects]} for s in students],
            "assignments": [{"assignment_id": a.assignment_id, "subject": a.subject,
                              "teacher_id": a.teacher_id} for a in assignments],
            "subjects": sorted(list(set([a.subject for a in assignments] + mapped_subjects)))
        })
    global_cache.set(cache_key, result)
    return result


@router.post("/classes")
def create_class(
    payload: CreateClassRequest,
    request: Request,
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    existing = db.query(HodClass).filter(HodClass.hod_id == hod_id, HodClass.class_name == payload.class_name).first()
    if existing:
        raise HTTPException(400, "Class already exists for this HOD")
    
    primary_dept_id = payload.dept_id or (payload.dept_ids[0] if payload.dept_ids else None)
    
    hc = HodClass(hod_id=hod_id, class_name=payload.class_name,
                  division=payload.division, department=payload.department,
                  dept_id=primary_dept_id,
                  semester=payload.semester)
    db.add(hc)
    db.flush()
    
    for d_id in payload.dept_ids:
        db.add(ClassDepartment(class_name=payload.class_name, dept_id=d_id))
    if not payload.dept_ids and primary_dept_id:
        db.add(ClassDepartment(class_name=payload.class_name, dept_id=primary_dept_id))

    activity.log(db, "hod", hod_id, user["name"], "CREATE_CLASS",
                 target=payload.class_name, ip=request.client.host)
    db.commit()
    return {"message": "Class created", "class_name": payload.class_name}


@router.post("/assign-teacher")
def assign_teacher(
    payload: AssignTeacherRequest,
    request: Request,
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    class_names = _get_hod_classes(hod_id, db)
    if payload.class_name not in class_names:
        raise HTTPException(403, "Class not under your management")

    teacher = db.query(Teacher).filter(Teacher.teacher_id == payload.teacher_id).first()
    if not teacher:
        raise HTTPException(404, "Teacher not found")

    subject_obj = db.query(Subject).filter(
        func.lower(Subject.name) == payload.subject.strip().lower()
    ).first()
    if not subject_obj:
        raise HTTPException(400, f"Subject '{payload.subject}' does not exist in the subject catalog.")
    
    canonical_subject = subject_obj.name

    existing = db.query(TeacherAssignment).filter(
        TeacherAssignment.teacher_id == teacher.teacher_id,
        TeacherAssignment.class_ == payload.class_name,
        TeacherAssignment.subject == canonical_subject,
    ).first()
    if not existing:
        db.add(TeacherAssignment(teacher_id=teacher.teacher_id,
                                  class_=payload.class_name, subject=canonical_subject))
    activity.log(db, "hod", hod_id, user["name"], "ASSIGN_TEACHER",
                 target=f"{teacher.name} → {payload.class_name}/{canonical_subject}",
                 ip=request.client.host)
    db.commit()
    return {"message": f"Teacher {teacher.name} assigned to {payload.subject}"}


@router.delete("/assign-teacher")
def unassign_teacher(
    assignment_id: int = Query(...),
    request: Request = None,
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    class_names = _get_hod_classes(hod_id, db)
    assignment = db.query(TeacherAssignment).filter(
        TeacherAssignment.assignment_id == assignment_id,
        TeacherAssignment.class_.in_(class_names),
    ).first()
    if not assignment:
        raise HTTPException(404, "Assignment not found or not yours")
    teacher = db.query(Teacher).filter(Teacher.teacher_id == assignment.teacher_id).first()
    db.delete(assignment)
    activity.log(db, "hod", hod_id, user["name"], "UNASSIGN_TEACHER",
                 target=f"{teacher.name if teacher else '?'} / {assignment.class_}/{assignment.subject}",
                 ip=request.client.host if request else None)
    db.commit()
    return {"message": "Teacher unassigned"}


@router.post("/students")
def create_student(
    payload: CreateStudentRequest,
    request: Request,
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    class_names = _get_hod_classes(hod_id, db)
    if payload.class_ not in class_names:
        raise HTTPException(403, "Class not under your management")
    
    if db.query(Student).filter(Student.roll_no == payload.roll_no).first():
        raise HTTPException(400, "Student with this roll number already exists")
        
    if not payload.subjects:
        raise HTTPException(400, "At least one subject is required")
        
    subject_objs = db.query(Subject).filter(Subject.name.in_(payload.subjects)).all()
    if len(subject_objs) != len(payload.subjects):
        found = {s.name for s in subject_objs}
        missing = [x for x in payload.subjects if x not in found]
        raise HTTPException(400, f"Subjects not found in catalog: {', '.join(missing)}")
    
    student = Student(
        roll_no=payload.roll_no,
        prn=payload.prn,
        name=payload.name,
        class_=payload.class_,
        semester=payload.semester,
        password_hash=hash_password(payload.password or "Test@123"),
        created_by_role="hod",
        created_by_id=hod_id,
        must_change_password=True,
        subjects=subject_objs
    )
    db.add(student)
    activity.log(db, "hod", hod_id, user["name"], "CREATE_STUDENT", target=payload.name, ip=request.client.host)
    db.commit()
    return {"message": f"Student {student.name} created successfully"}


@router.patch("/students/{student_id}")
def update_student(
    student_id: int,
    payload: CreateStudentRequest,
    request: Request,
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    class_names = _get_hod_classes(hod_id, db)
    student = db.query(Student).filter(
        Student.student_id == student_id,
        Student.class_.in_(class_names),
    ).first()
    if not student:
        raise HTTPException(404, "Student not found in your classes")
    
    student.roll_no = payload.roll_no
    student.name = payload.name
    student.prn = payload.prn
    student.class_ = payload.class_
    student.semester = payload.semester
    if payload.password:
        student.password_hash = hash_password(payload.password)
        
    if not payload.subjects:
        raise HTTPException(400, "At least one subject is required")
        
    subject_objs = db.query(Subject).filter(Subject.name.in_(payload.subjects)).all()
    if len(subject_objs) != len(payload.subjects):
        found = {sub.name for sub in subject_objs}
        missing = [x for x in payload.subjects if x not in found]
        raise HTTPException(400, f"Subjects not found in catalog: {', '.join(missing)}")
        
    student.subjects = subject_objs
        
    activity.log(db, "hod", hod_id, user["name"], "UPDATE_STUDENT", target=student.name, ip=request.client.host)
    db.commit()
    return {"message": "Student updated successfully"}


@router.delete("/students/{student_id}")
def delete_student(
    student_id: int,
    request: Request,
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    class_names = _get_hod_classes(hod_id, db)
    student = db.query(Student).filter(
        Student.student_id == student_id,
        Student.class_.in_(class_names),
    ).first()
    if not student:
        raise HTTPException(404, "Student not found in your classes")
    
    name = student.name
    db.delete(student)
    activity.log(db, "hod", hod_id, user["name"], "DELETE_STUDENT", target=name, ip=request.client.host)
    db.commit()
    return {"message": f"Student {name} deleted"}


@router.post("/teachers")
def create_teacher(
    payload: CreateTeacherRequest,
    request: Request,
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    hod = db.query(HOD).filter(HOD.hod_id == hod_id).first()
    email_val = payload.email.lower().strip()
    
    existing = db.query(Teacher).filter(
        (Teacher.phone == payload.phone) | 
        (Teacher.email == email_val) | 
        (Teacher.name == payload.name)
    ).first()
    if existing:
        raise HTTPException(400, "Teacher with phone, email, or name already exists")
    
    t = Teacher(
        name=payload.name.strip(),
        phone=payload.phone.strip(),
        email=email_val,
        password_hash=hash_password(payload.password or "Teacher@123"),
        dept_id=payload.dept_id or (hod.dept_id if hod else None),
        created_by_role="hod",
        created_by_id=hod_id,
        must_change_password=True
    )
    db.add(t)
    db.flush()
    
    # Process assignments
    class_names = _get_hod_classes(hod_id, db)
    if payload.assignments:
        for a in payload.assignments:
            sub = a.get("subject")
            cls = a.get("class_name") or a.get("class")
            if sub and cls and cls in class_names:
                db.add(TeacherAssignment(teacher_id=t.teacher_id, subject=sub, class_=cls))
                
    activity.log(db, "hod", hod_id, user["name"], "CREATE_TEACHER", target=t.name, ip=request.client.host)
    db.commit()
    return {"message": f"Teacher {t.name} created successfully"}


@router.post("/teachers", status_code=201)
def create_hod_teacher(
    payload: CreateTeacherRequest,
    request: Request,
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    hod = db.query(HOD).filter(HOD.hod_id == hod_id).first()
    email_val = payload.email.lower().strip()
    
    # Check if teacher exists (by phone, email, or name case-insensitive)
    existing = db.query(Teacher).filter(
        (Teacher.phone == payload.phone) | 
        (Teacher.email == email_val) | 
        (func.lower(Teacher.name) == payload.name.lower().strip())
    ).first()
    if existing:
        raise HTTPException(400, f"Teacher with phone, email, or name '{payload.name}' already exists")
    
    t = Teacher(
        name=payload.name, phone=payload.phone, email=email_val,
        dept_id=hod.dept_id,
        password_hash=hash_password(payload.password or "Teacher@123"),
        created_by_role="hod",
        created_by_id=hod_id
    )
    db.add(t)
    db.flush()
    
    # Optional: Initial assignments
    for assign in payload.assignments:
        cls = assign.get("class_name")
        subj = assign.get("subject")
        if cls and subj:
            db.add(TeacherAssignment(teacher_id=t.teacher_id, subject=subj, class_=cls))
            
    activity.log(db, "hod", hod_id, user["name"], "CREATE_TEACHER", target=payload.name, ip=request.client.host)
    db.commit()
    return {"message": "Teacher created", "teacher_id": t.teacher_id}


@router.patch("/teachers/{teacher_id}")
def update_hod_teacher(
    teacher_id: int,
    payload: UpdateTeacherRequest,
    request: Request,
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    hod = db.query(HOD).filter(HOD.hod_id == hod_id).first()
    teacher = db.query(Teacher).filter(Teacher.teacher_id == teacher_id).first()
    if not teacher:
        raise HTTPException(404, "Teacher not found")
        
    is_authorized = True

    if payload.phone != teacher.phone:
        if db.query(Teacher).filter(Teacher.phone == payload.phone).first():
            raise HTTPException(400, "Phone number already in use")

    email_val = payload.email.lower().strip()
    if email_val != (teacher.email or "").lower().strip():
        if db.query(Teacher).filter(Teacher.email == email_val).first():
            raise HTTPException(400, "Email already in use")

    teacher.name = payload.name.strip()
    teacher.phone = payload.phone.strip()
    teacher.email = email_val
    db.commit()
    return {"message": "Teacher updated"}


@router.delete("/teachers/{teacher_id}")
def delete_hod_teacher(
    teacher_id: int,
    request: Request,
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    teacher = db.query(Teacher).filter(Teacher.teacher_id == teacher_id).first()
    if not teacher:
        raise HTTPException(404, "Teacher not found")
        
    # HOD can delete any teacher
    # if teacher.created_by_role != "hod" or teacher.created_by_id != hod_id:
    #     raise HTTPException(403, "Not authorized to delete this teacher. Only the creator can do this.")
        
    name = teacher.name
    db.delete(teacher)
    activity.log(db, "hod", hod_id, user["name"], "DELETE_TEACHER", target=name, ip=request.client.host)
    db.commit()
    return {"message": f"Teacher {name} deleted"}


@router.post("/teachers/{teacher_id}/assignments")
def add_hod_teacher_assignment(
    teacher_id: int,
    payload: AssignTeacherRequest,
    request: Request,
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    class_names = _get_hod_classes(hod_id, db)
    if payload.class_name not in class_names:
        raise HTTPException(403, "Class not in scope")
        
    existing = db.query(TeacherAssignment).filter(
        TeacherAssignment.teacher_id == teacher_id,
        TeacherAssignment.subject == payload.subject,
        TeacherAssignment.class_ == payload.class_name
    ).first()
    if existing:
        raise HTTPException(400, "Assignment already exists")
        
    db.add(TeacherAssignment(teacher_id=teacher_id, subject=payload.subject, class_=payload.class_name))
    activity.log(db, "hod", hod_id, user["name"], "ADD_TEACHER_ASSIGNMENT", 
                 target=f"TID:{teacher_id} → {payload.subject}", ip=request.client.host)
    db.commit()
    return {"message": "Assignment added"}


@router.delete("/teachers/{teacher_id}/assignments/{assignment_id}")
def remove_hod_teacher_assignment(
    teacher_id: int,
    assignment_id: int,
    request: Request,
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    class_names = _get_hod_classes(hod_id, db)
    a = db.query(TeacherAssignment).filter(
        TeacherAssignment.assignment_id == assignment_id,
        TeacherAssignment.teacher_id == teacher_id
    ).first()
    if not a or a.class_ not in class_names:
        raise HTTPException(403, "Not authorized")
        
    db.delete(a)
    activity.log(db, "hod", hod_id, user["name"], "REMOVE_TEACHER_ASSIGNMENT", target=f"AID:{assignment_id}", ip=request.client.host)
    db.commit()
    return {"message": "Assignment removed"}


@router.post("/subjects", status_code=201)
def create_subject(
    payload: SubjectCreate,
    request: Request,
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    hod = db.query(HOD).filter(HOD.hod_id == hod_id).first()
    normalized_name = payload.name.strip().title()
    
    if db.query(Subject).filter(func.lower(Subject.name) == normalized_name.lower()).first():
        raise HTTPException(400, f"Subject '{normalized_name}' already exists")
        
    code = payload.code.strip() if payload.code and payload.code.strip() != "" else None
    primary_dept_id = payload.dept_id or (payload.dept_ids[0] if payload.dept_ids else (hod.dept_id if hod else None))

    sub = Subject(
        name=normalized_name, code=code, dept_id=primary_dept_id,
        created_by_role="hod", created_by_id=hod_id
    )
    db.add(sub)
    db.flush()
    
    if payload.dept_ids:
        for d_id in payload.dept_ids:
            db.add(SubjectDepartment(subject_id=sub.subject_id, dept_id=d_id))
    elif primary_dept_id:
        db.add(SubjectDepartment(subject_id=sub.subject_id, dept_id=primary_dept_id))

    for cls in payload.classes:
        db.add(ClassSubject(class_name=cls, subject_id=sub.subject_id))

    activity.log(db, "hod", hod_id, user["name"], "CREATE_SUBJECT", target=sub.name, ip=request.client.host)
    db.commit()
    return {"message": f"Subject {sub.name} created", "subject_id": sub.subject_id}


@router.patch("/subjects/{subject_id}")
def update_subject(
    subject_id: int,
    payload: SubjectUpdate,
    request: Request,
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
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
        
    s.name = normalized_name
    s.code = payload.code.strip() if payload.code else None
    
    db.query(SubjectDepartment).filter(SubjectDepartment.subject_id == subject_id).delete()
    for d_id in payload.dept_ids:
        db.add(SubjectDepartment(subject_id=subject_id, dept_id=d_id))
        
    db.query(ClassSubject).filter(ClassSubject.subject_id == subject_id).delete()
    for class_name in payload.classes:
        db.add(ClassSubject(class_name=class_name, subject_id=subject_id))
        
    activity.log(db, "hod", hod_id, user["name"], "UPDATE_SUBJECT", target=s.name, ip=request.client.host)
    db.commit()
    return {"message": "Subject updated"}


@router.delete("/subjects/{subject_id}")
def delete_hod_subject(
    subject_id: int,
    request: Request,
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    s = db.query(Subject).filter(Subject.subject_id == subject_id).first()
    if not s:
        raise HTTPException(404, "Subject not found")
        
    # HOD can delete any subject
    # if s.created_by_role != "hod" or s.created_by_id != hod_id:
    #     raise HTTPException(403, "Not authorized to delete this subject. Only the creator can do this.")
        
    name = s.name
    db.delete(s)
    activity.log(db, "hod", hod_id, user["name"], "DELETE_SUBJECT", target=name, ip=request.client.host)
    db.commit()
    return {"message": f"Subject {name} deleted"}


@router.get("/subjects", response_model=List[SubjectOut])
def list_hod_subjects(
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    cache_key = "hod:subjects"
    cached = global_cache.get(cache_key)
    if cached is not None:
        return cached

    subjects = db.query(Subject).options(
        joinedload(Subject.dept_obj),
        selectinload(Subject.dept_mappings),
        selectinload(Subject.class_mappings)
    ).order_by(Subject.name).all()
    
    # Cache creators to prevent N+1 queries in _get_creator_name
    from app.models import Admin
    admin_cache = {a.admin_id: a.name for a in db.query(Admin.admin_id, Admin.name).all()}
    hod_cache = {h.hod_id: h.name for h in db.query(HOD.hod_id, HOD.name).all()}
    
    def get_cached_creator_name(role: str, actor_id: int) -> str:
        if not role or not actor_id:
            return "System"
        if role == "admin":
            return admin_cache.get(actor_id, f"Admin #{actor_id}")
        if role == "hod":
            return hod_cache.get(actor_id, f"HOD #{actor_id}")
        return f"{role} #{actor_id}"

    result = []
    for s in subjects:
        result.append(SubjectOut(
            subject_id=s.subject_id, name=s.name, code=s.code,
            department=s.department, dept_id=s.dept_id,
            dept_name=s.dept_obj.name if s.dept_obj else s.department,
            dept_ids=[d.dept_id for d in s.dept_mappings],
            dept_names=[d.name for d in s.dept_mappings],
            assigned_classes=sorted(list(set([m.class_name for m in s.class_mappings]))),
            created_by_name=get_cached_creator_name(s.created_by_role, s.created_by_id)
        ))
    global_cache.set(cache_key, result)
    return result


def _get_creator_name(db, role, id):
    if role == "admin":
        from app.models import Admin
        a = db.query(Admin).filter(Admin.admin_id == id).first()
        return a.name if a else "Admin"
    elif role == "hod":
        h = db.query(HOD).filter(HOD.hod_id == id).first()
        return h.name if h else "HOD"
    return "System"


@router.get("/students", response_model=List[StudentOut])
def list_hod_students(
    class_: Optional[str] = Query(None),
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    class_names = _get_hod_classes(hod_id, db)
    query = db.query(Student).options(selectinload(Student.subjects))
    if class_:
        if class_ not in class_names:
            raise HTTPException(403, "Class not in scope")
        query = query.filter(Student.class_ == class_)
    else:
        query = query.filter(Student.class_.in_(class_names))
    students = query.order_by(Student.roll_no).all()
    return [
        StudentOut(
            student_id=s.student_id,
            roll_no=s.roll_no,
            prn=s.prn,
            name=s.name,
            class_=s.class_,
            semester=s.semester,
            profile_photo=s.profile_photo,
            subjects=[sub.name for sub in s.subjects],
        )
        for s in students
    ]


@router.post("/students/import")
def import_students(
    payload: ClassImportRequest,
    request: Request,
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    class_names = _get_hod_classes(hod_id, db)
    if payload.class_ not in class_names:
        raise HTTPException(403, "Class not in scope")

    added = updated = 0
    errors = []
    
    f = StringIO(payload.data)
    reader = csv.reader(f)
    for i, parts in enumerate(reader, 1):
        parts = [p.strip() for p in parts]
        if not parts or all(not p for p in parts):
            continue
        if len(parts) < 4:
            errors.append(f"Line {i}: invalid format (needs roll_no, prn, name, subjects)")
            continue
            
        roll, prn, name, subjects_str = parts[0], parts[1], parts[2], parts[3]
        if not roll or not prn or not name or not subjects_str:
            errors.append(f"Line {i}: roll_no, prn, name, and subjects are all mandatory")
            continue
            
        s_temp = subjects_str.replace(";", ",").replace("|", ",")
        subject_names = [s.strip() for s in s_temp.split(",") if s.strip()]
        if not subject_names:
            errors.append(f"Line {i}: subjects list is empty")
            continue
            
        subject_objs = db.query(Subject).filter(Subject.name.in_(subject_names)).all()
        if len(subject_objs) != len(subject_names):
            found_names = {sub.name for sub in subject_objs}
            missing = [n for n in subject_names if n not in found_names]
            errors.append(f"Line {i}: subjects '{', '.join(missing)}' do not exist in catalog")
            continue

        existing = db.query(Student).filter((Student.roll_no == roll) | (Student.prn == prn)).first()
        if existing:
            if existing.roll_no != roll and db.query(Student).filter(Student.roll_no == roll).first():
                 errors.append(f"Line {i}: roll_no {roll} already exists for another student")
                 continue
            existing.prn = prn; existing.name = name; existing.subjects = subject_objs; updated += 1
        else:
            db.add(Student(roll_no=roll, prn=prn, name=name, class_=payload.class_, semester=payload.semester,
                           password_hash=hash_password("Test@123"), created_by_role="hod", created_by_id=hod_id,
                           subjects=subject_objs))
            added += 1
    db.commit()
    return {"added": added, "updated": updated, "errors": errors}


@router.get("/teachers/import-template")
def get_teacher_import_template():
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["name", "phone", "password", "subject", "class"])
    writer.writerow(["John Teacher", "9999999999", "Pass@123", "Maths", "FYMCA"])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue().encode()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=template.csv"})


@router.get("/students/import-template")
def get_student_import_template():
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["roll_no", "prn", "name", "subjects"])
    writer.writerow(["R01", "P01", "Student A", "Maths, Science"])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue().encode()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=template.csv"})


@router.get("/reports/teachers")
def get_teacher_report(
    start: str = Query(None),
    end: str = Query(None),
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    class_names = _get_hod_classes(hod_id, db)
    
    if not start or not end:
        end_date = datetime.now().date()
        start = (end_date - timedelta(days=29)).strftime("%Y-%m-%d")
        end = end_date.strftime("%Y-%m-%d")

    assignments = db.query(TeacherAssignment).filter(TeacherAssignment.class_.in_(class_names)).all()
    teacher_ids = list({a.teacher_id for a in assignments})
    
    report = []
    for tid in teacher_ids:
        teacher = db.query(Teacher).filter(Teacher.teacher_id == tid).first()
        if not teacher: continue
        
        teacher_subjects = list({a.subject for a in assignments if a.teacher_id == tid})
        for subj in teacher_subjects:
            sessions = db.query(Attendance.date, Attendance.time).filter(
                Attendance.teacher_id == tid,
                Attendance.subject == subj,
                Attendance.class_.in_(class_names),
                Attendance.date.between(start, end)
            ).distinct().count()
            
            last_session = db.query(func.max(Attendance.date)).filter(
                Attendance.teacher_id == tid,
                Attendance.subject == subj,
                Attendance.class_.in_(class_names)
            ).scalar()
            
            report.append({
                "teacher_id": tid,
                "name": teacher.name,
                "subject": subj,
                "sessions_count": sessions,
                "last_session": last_session
            })
            
    return {"report": report, "start": start, "end": end}


@router.get("/report")
def hod_report(
    class_: str = Query(...),
    subject: str = Query(None),
    start: str = Query(None),
    end: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort_by: str = Query("roll_no_asc"),
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    class_names = _get_hod_classes(hod_id, db)
    if class_ not in class_names:
        raise HTTPException(403, "Not your class")

    if not start or not end:
        end_date = datetime.now().date()
        start = (end_date - timedelta(days=6)).strftime("%Y-%m-%d")
        end = end_date.strftime("%Y-%m-%d")

    subj_rows = db.query(TeacherAssignment.subject).filter(TeacherAssignment.class_ == class_).distinct().all()
    mapping_rows = db.query(Subject.name).join(ClassSubject).filter(ClassSubject.class_name == class_).all()
    subjects = sorted(list(set([r[0] for r in subj_rows] + [r[0] for r in mapping_rows])))

    if subject:
        students = db.query(Student).join(Student.subjects).filter(
            Student.class_ == class_,
            Subject.name == subject
        ).all()
    else:
        students = db.query(Student).filter(Student.class_ == class_).all()
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
        
        if subject and total == 0:
            continue
            
        report.append({
            "student_id": s.student_id, "roll_no": s.roll_no, "name": s.name,
            "total": total, "attended": attended, "percent": round(percent, 2),
        })

    # Sorting logic
    if sort_by == "roll_no_asc": report.sort(key=lambda x: x["roll_no"])
    elif sort_by == "roll_no_desc": report.sort(key=lambda x: x["roll_no"], reverse=True)
    elif sort_by == "percent_desc": report.sort(key=lambda x: x["percent"], reverse=True)

    total_count = len(report)
    return {
        "report": report[(page - 1) * limit: page * limit],
        "subjects": subjects,
        "start": start, "end": end,
        "page": page,
        "total_pages": (total_count + limit - 1) // limit if total_count > 0 else 1,
    }


@router.get("/analytics")
def hod_analytics(
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    class_names = _get_hod_classes(hod_id, db)
    today = datetime.now().date()
    thirty_ago = today - timedelta(days=29)
    
    trend = []
    for i in range(30):
        d = (thirty_ago + timedelta(days=i)).strftime("%Y-%m-%d")
        total = db.query(func.count(Attendance.attendance_id)).filter(
            Attendance.class_.in_(class_names), Attendance.date == d).scalar()
        present = db.query(func.count(Attendance.attendance_id)).filter(
            Attendance.class_.in_(class_names), Attendance.date == d,
            Attendance.status == "Present").scalar()
        trend.append({"date": d, "total": total, "present": present,
                      "percent": round(present / total * 100, 1) if total else 0})

    teacher_perf = []
    assignments = db.query(TeacherAssignment).filter(TeacherAssignment.class_.in_(class_names)).all()
    teacher_ids = list({a.teacher_id for a in assignments})
    for tid in teacher_ids:
        t = db.query(Teacher).filter(Teacher.teacher_id == tid).first()
        if not t: continue
        sessions = db.query(Attendance.date).filter(
            Attendance.teacher_id == tid,
            Attendance.class_.in_(class_names),
            Attendance.date.between(thirty_ago.strftime("%Y-%m-%d"), today.strftime("%Y-%m-%d")),
        ).distinct().count()
        teacher_perf.append({"teacher_id": tid, "name": t.name, "sessions_last_30d": sessions})
    
    return {"trend": trend, "teacher_performance": teacher_perf, "class_names": class_names}


@router.get("/export/pdf")
def export_pdf(
    class_: str = Query(...), subject: str = Query(None),
    start: str = Query(None), end: str = Query(None),
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    class_names = _get_hod_classes(hod_id, db)
    if class_ not in class_names:
        raise HTTPException(403, "Not your class")
    
    if subject:
        students = db.query(Student).join(Student.subjects).filter(
            Student.class_ == class_,
            Subject.name == subject
        ).order_by(Student.roll_no).all()
    else:
        students = db.query(Student).filter(Student.class_ == class_).order_by(Student.roll_no).all()
    rows_out = []
    for s in students:
        q = db.query(Attendance).filter(Attendance.student_id == s.student_id, Attendance.date.between(start, end))
        if subject: q = q.filter(Attendance.subject == subject)
        recs = q.all()
        total = len(recs); attended = sum(1 for r in recs if r.status == "Present")
        if subject and total == 0: continue
        pct = round(attended/total*100, 2) if total else 0.0
        rows_out.append((s.roll_no, s.name, total, attended, pct))
    
    from app.models import CollegeSettings
    cs = db.query(CollegeSettings).first()
    settings = {"college_name": cs.college_name, "college_address": cs.college_address} if cs else None

    buf = generate_attendance_pdf(
        title=f"Attendance: {class_}", subtitle=f"From {start} to {end}",
        rows=rows_out, settings=settings
    )
    return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=report.pdf"})


@router.get("/notifications")
def get_notifications(
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    notifs = db.query(Notification).filter(
        ((Notification.recipient_role == "hod") & ((Notification.recipient_id == hod_id) | (Notification.recipient_id == None))) |
        (Notification.recipient_role == "all")
    ).order_by(Notification.created_at.desc()).limit(50).all()
    return [{"notification_id": n.notification_id, "title": n.title, "message": n.message, "is_read": n.is_read, "created_at": n.created_at} for n in notifs]


@router.post("/bulk-correction")
def bulk_attendance_correction(
    payload: dict,
    request: Request,
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    hod_id = int(user["sub"])
    class_names = _get_hod_classes(hod_id, db)
    class_ = payload.get("class_")
    subject = payload.get("subject")
    date = payload.get("date")
    statuses = payload.get("statuses", {})

    if class_ not in class_names:
        raise HTTPException(403, "Class not authorized")

    updated = 0
    for sid_str, status in statuses.items():
        sid = int(sid_str)
        existing = db.query(Attendance).filter(
            Attendance.student_id == sid, Attendance.subject == subject,
            Attendance.class_ == class_, Attendance.date == date
        ).first()
        if existing:
            existing.status = status
            updated += 1
            
    db.commit()
    return {"updated": updated, "message": "Correction applied"}


@router.post("/students/import-file")
async def import_students_file(
    class_: str = Form(...),
    semester: int = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db)
):
    hod_id = int(user["sub"])
    class_names = _get_hod_classes(hod_id, db)
    if class_ not in class_names:
        raise HTTPException(403, "Not authorized for this class")
        
    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents)) if file.filename.endswith('.csv') else pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(400, f"Error reading file: {str(e)}")
        
    # Standardize column names
    df.columns = [c.lower().strip().replace(' ', '_') for c in df.columns]
    
    # Required columns check
    required = {'roll_no', 'prn', 'name', 'subjects'}
    if not required.issubset(df.columns):
        if len(df.columns) >= 4:
            df.columns = ['roll_no', 'prn', 'name', 'subjects'] + list(df.columns[4:])
        else:
            raise HTTPException(400, f"File must have at least 4 columns: roll_no, prn, name, subjects. Found: {list(df.columns)}")
            
    added = updated = 0
    errors = []
    
    for i, row in df.iterrows():
        try:
            roll = str(row['roll_no']).strip()
            prn = str(row['prn']).strip()
            name = str(row['name']).strip()
            subjects_str = str(row['subjects']).strip()
            
            if not roll or roll == 'nan' or not name or name == 'nan' or not subjects_str or subjects_str == 'nan':
                errors.append(f"Row {i+2}: Missing roll_no, name, or subjects")
                continue
                
            s_temp = subjects_str.replace(";", ",").replace("|", ",")
            subject_names = [s.strip() for s in s_temp.split(",") if s.strip()]
            if not subject_names:
                errors.append(f"Row {i+2}: Subjects list is empty")
                continue
                
            subject_objs = db.query(Subject).filter(Subject.name.in_(subject_names)).all()
            if len(subject_objs) != len(subject_names):
                found_names = {sub.name for sub in subject_objs}
                missing = [n for n in subject_names if n not in found_names]
                errors.append(f"Row {i+2}: Subjects '{', '.join(missing)}' do not exist in catalog")
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
                existing.subjects = subject_objs
                updated += 1
            else:
                db.add(Student(roll_no=roll, prn=prn, name=name, class_=class_, semester=semester,
                               password_hash=hash_password("Test@123"), created_by_role="hod", created_by_id=hod_id,
                               subjects=subject_objs))
                added += 1
        except Exception as e:
            errors.append(f"Row {i+2}: {str(e)}")
            
    db.commit()
    return {"added": added, "updated": updated, "errors": errors}


@router.post("/teachers/import-file")
async def import_teachers_file(
    file: UploadFile = File(...),
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db)
):
    hod_id = int(user["sub"])
    hod = db.query(HOD).filter(HOD.hod_id == hod_id).first()
    class_names = _get_hod_classes(hod_id, db)
    
    contents = await file.read()
    df = pd.read_csv(io.BytesIO(contents)) if file.filename.endswith('.csv') else pd.read_excel(io.BytesIO(contents))
    
    added = 0
    for _, row in df.iterrows():
        name = str(row.get('name', '')).strip()
        phone = str(row.get('phone', '')).strip()
        email = str(row.get('email', '')).strip()
        subj = str(row.get('subject', '')).strip()
        cls = str(row.get('class', '')).strip()
        if not name or not phone or not email or name == 'nan' or phone == 'nan' or email == 'nan': continue
        
        t = db.query(Teacher).filter((Teacher.phone == phone) | (Teacher.email == email) | (func.lower(Teacher.name) == name.lower())).first()
        if not t:
            t = Teacher(name=name, phone=phone, email=email.lower().strip(), password_hash=hash_password("Teacher@123"),
                        dept_id=hod.dept_id, created_by_role="hod", created_by_id=hod_id)
            db.add(t)
            db.flush()
            added += 1
            
        if subj and cls and cls in class_names:
            exists = db.query(TeacherAssignment).filter(
                TeacherAssignment.teacher_id == t.teacher_id,
                TeacherAssignment.subject == subj,
                TeacherAssignment.class_ == cls
            ).first()
            if not exists:
                db.add(TeacherAssignment(teacher_id=t.teacher_id, subject=subj, class_=cls))
                
    db.commit()
    return {"added": added}


# ── Face Detection Attendance (HOD) ───────────────────────────────────────────
import json
import math as _math

@router.post("/face-register")
def hod_face_register(
    payload: dict,
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    """Register or update face descriptor for an HOD."""
    from app.models import StaffFaceData
    hod_id = int(user["sub"])
    descriptor = payload.get("face_descriptor")

    if not descriptor or not isinstance(descriptor, list) or len(descriptor) < 64:
        raise HTTPException(400, "Invalid face descriptor")

    existing = db.query(StaffFaceData).filter(
        StaffFaceData.role == "hod",
        StaffFaceData.user_id == hod_id,
    ).first()

    if existing:
        existing.face_descriptor = json.dumps(descriptor)
        existing.registered_at = datetime.utcnow()
    else:
        db.add(StaffFaceData(
            role="hod",
            user_id=hod_id,
            face_descriptor=json.dumps(descriptor),
        ))
    db.commit()
    return {"message": "Face registered successfully"}


@router.get("/face-status")
def hod_face_status(
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    """Check if HOD has registered their face."""
    from app.models import StaffFaceData
    hod_id = int(user["sub"])
    existing = db.query(StaffFaceData).filter(
        StaffFaceData.role == "hod",
        StaffFaceData.user_id == hod_id,
    ).first()
    return {"registered": existing is not None, "registered_at": existing.registered_at if existing else None}


@router.post("/face-attendance")
def hod_face_attendance(
    payload: dict,
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    """Mark attendance via face detection for HOD. Blocks if on approved leave."""
    from app.models import StaffFaceData, StaffAttendance, StaffLeave
    hod_id = int(user["sub"])
    descriptor = payload.get("face_descriptor")

    if not descriptor or not isinstance(descriptor, list):
        raise HTTPException(400, "Invalid face descriptor")

    today = datetime.now().strftime("%Y-%m-%d")
    now_time = datetime.now().strftime("%I:%M %p")

    # Check if on approved leave today
    on_leave = db.query(StaffLeave).filter(
        StaffLeave.applicant_role == "hod",
        StaffLeave.applicant_id == hod_id,
        StaffLeave.status == "approved",
        StaffLeave.start_date <= today,
        StaffLeave.end_date >= today,
    ).first()
    if on_leave:
        raise HTTPException(400, f"You are on approved {on_leave.leave_type} today. Cannot mark attendance.")

    # Check if already marked today
    existing = db.query(StaffAttendance).filter(
        StaffAttendance.role == "hod",
        StaffAttendance.user_id == hod_id,
        StaffAttendance.date == today,
    ).first()
    if existing:
        raise HTTPException(400, "Attendance already marked for today")

    # Load stored face descriptor
    face_data = db.query(StaffFaceData).filter(
        StaffFaceData.role == "hod",
        StaffFaceData.user_id == hod_id,
    ).first()
    if not face_data:
        raise HTTPException(400, "Face not registered. Please register your face first.")

    stored = json.loads(face_data.face_descriptor)
    dist = _math.sqrt(sum((x - y) ** 2 for x, y in zip(stored, descriptor)))

    if dist > 0.6:
        raise HTTPException(400, "Face not recognized. Please try again in better lighting.")

    # Mark attendance
    record = StaffAttendance(
        role="hod",
        user_id=hod_id,
        date=today,
        check_in_time=now_time,
        status="Present",
        verified_by="face_detection",
    )
    db.add(record)
    db.commit()
    return {"message": "Attendance marked successfully", "time": now_time, "date": today}


@router.get("/my-attendance")
def hod_my_attendance(
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    user: dict = Depends(require_role("hod")),
    db: Session = Depends(get_db),
):
    """View own attendance history for HOD."""
    from app.models import StaffAttendance
    hod_id = int(user["sub"])

    q = db.query(StaffAttendance).filter(
        StaffAttendance.role == "hod",
        StaffAttendance.user_id == hod_id,
    )
    total = q.count()
    records = q.order_by(StaffAttendance.date.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "records": [
            {
                "id": r.id, "date": r.date, "check_in_time": r.check_in_time,
                "status": r.status, "verified_by": r.verified_by,
            } for r in records
        ],
        "total": total,
        "page": page,
        "total_pages": (total + limit - 1) // limit if total > 0 else 1,
    }

