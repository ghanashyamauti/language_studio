import csv
import re
from io import StringIO, BytesIO
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException, File, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app import activity
from app.auth import require_role, verify_password, hash_password
from app.models import Teacher, TeacherAssignment, Student, Attendance, Notification, Subject
from app.schemas import MarkAttendanceRequest, ChangePasswordRequest
from app.pdf_utils import generate_attendance_pdf

router = APIRouter(prefix="/teacher", tags=["teacher"])

TIME_PATTERN = re.compile(r"^\d{1,2}:\d{2}\s*(AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(AM|PM)$", re.IGNORECASE)


@router.get("/assignments")
def get_assignments(
    user: dict = Depends(require_role("teacher", "hod", "admin")),
    db: Session = Depends(get_db),
):
    teacher_id = int(user["sub"])
    assigns = db.query(TeacherAssignment).filter(
        TeacherAssignment.teacher_id == teacher_id
    ).order_by(TeacherAssignment.class_, TeacherAssignment.subject).all()

    classes = sorted({a.class_ for a in assigns})
    class_to_subjects = {}
    for a in assigns:
        class_to_subjects.setdefault(a.class_, set()).add(a.subject)
    class_to_subjects = {k: sorted(list(v)) for k, v in class_to_subjects.items()}

    return {"assignments": [{"subject": a.subject, "class_": a.class_} for a in assigns],
            "classes": classes,
            "class_to_subjects": class_to_subjects}


@router.get("/students")
def get_students_for_class(
    class_: str = Query(...),
    subject: str = Query(...),
    date: str = Query(None),
    user: dict = Depends(require_role("teacher", "hod", "admin")),
    db: Session = Depends(get_db),
):
    selected_date = date or datetime.now().strftime("%Y-%m-%d")
    students = db.query(Student).join(Student.subjects).filter(
        Student.class_ == class_,
        Subject.name == subject
    ).order_by(Student.roll_no).all()

    existing = db.query(Attendance).filter(
        Attendance.class_ == class_,
        Attendance.subject == subject,
        Attendance.date == selected_date,
    ).all()
    status_map = {r.student_id: r.status for r in existing}
    already_marked = len(existing) > 0

    return {
        "students": [
            {
                "student_id": s.student_id,
                "roll_no": s.roll_no,
                "name": s.name,
                "status": status_map.get(s.student_id, "Absent"),
            }
            for s in students
        ],
        "date": selected_date,
        "already_marked": already_marked,  # FIX: flag so UI can show warning
    }


@router.post("/mark")
def mark_attendance(
    payload: MarkAttendanceRequest,
    user: dict = Depends(require_role("teacher", "hod", "admin")),
    db: Session = Depends(get_db),
):
    # Validate time format if provided
    if payload.time and not TIME_PATTERN.match(payload.time.strip()):
        raise HTTPException(400, "Invalid time format. Use HH:MM AM/PM - HH:MM AM/PM")

    teacher_id = int(user["sub"])
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
            existing.time = payload.time
            existing.teacher_id = teacher_id
        else:
            db.add(Attendance(
                student_id=student_id,
                teacher_id=teacher_id,
                subject=payload.subject,
                class_=payload.class_,
                date=payload.date,
                time=payload.time,
                status=status,
            ))
    activity.log(db, "teacher", teacher_id, user["name"], "MARK_ATTENDANCE",
                 target=f"{payload.class_} / {payload.subject} / {payload.date}",
                 detail={"date": payload.date, "count": len(payload.statuses)})
    db.commit()
    return {"message": "Attendance saved successfully"}


@router.get("/report")
def teacher_report(
    cls: str = Query(...),
    subject: str = Query(...),
    start: str = Query(None),
    end: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort_by: str = Query("roll_no_asc"),
    user: dict = Depends(require_role("teacher", "hod", "admin")),
    db: Session = Depends(get_db),
):
    if not start or not end:
        end_date = datetime.now().date()
        start = (end_date - timedelta(days=6)).strftime("%Y-%m-%d")
        end = end_date.strftime("%Y-%m-%d")

    students = db.query(Student).join(Student.subjects).filter(
        Student.class_ == cls,
        Subject.name == subject
    ).all()
    student_ids = [s.student_id for s in students]

    # Bulk query attendance records
    attendance_rows = db.query(Attendance.student_id, Attendance.status).filter(
        Attendance.student_id.in_(student_ids),
        Attendance.subject == subject,
        Attendance.class_ == cls,
        Attendance.date.between(start, end)
    ).all()

    # Group in memory
    att_by_student = {}
    for s_id, status in attendance_rows:
        att_by_student.setdefault(s_id, []).append(status)

    report = []
    for s in students:
        rows = att_by_student.get(s.student_id, [])
        total = len(rows)
        attended = sum(1 for status in rows if status == "Present")
        percent = (attended / total * 100) if total > 0 else 0.0
        report.append({
            "roll_no": s.roll_no,
            "name": s.name,
            "total": total,
            "attended": attended,
            "percent": round(percent, 2),
        })

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

    total_count = len(report)
    paginated = report[(page - 1) * limit: page * limit]

    return {
        "report": paginated,
        "start": start, "end": end,
        "subject": subject, "class_": cls,
        "page": page,
        "total_pages": (total_count + limit - 1) // limit if total_count > 0 else 1,
    }


@router.get("/performance")
def teacher_performance(
    user: dict = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    """Show teacher's own attendance marking stats."""
    teacher_id = int(user["sub"])
    today = datetime.now().date()
    thirty_ago = today - timedelta(days=29)
    start = thirty_ago.strftime("%Y-%m-%d")
    end = today.strftime("%Y-%m-%d")

    # Sessions per class per subject in last 30 days
    assigns = db.query(TeacherAssignment).filter(TeacherAssignment.teacher_id == teacher_id).all()
    
    # Bulk query distinct class/subject/date
    attendance_rows = db.query(Attendance.class_, Attendance.subject, Attendance.date).filter(
        Attendance.teacher_id == teacher_id,
        Attendance.date.between(start, end)
    ).distinct().all()
    
    # Group in memory
    sessions_by_class_subject = {}
    for class_, subject, date in attendance_rows:
        sessions_by_class_subject.setdefault((class_, subject), set()).add(date)

    stats = []
    for a in assigns:
        dates = sessions_by_class_subject.get((a.class_, a.subject), set())
        stats.append({"class_": a.class_, "subject": a.subject, "sessions_marked": len(dates)})

    last_marked = db.query(Attendance.date).filter(
        Attendance.teacher_id == teacher_id
    ).order_by(Attendance.date.desc()).first()

    return {"stats": stats, "last_marked": last_marked[0] if last_marked else None, "period_days": 30}


@router.get("/notifications")
def get_notifications(
    user: dict = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    teacher_id = int(user["sub"])
    notifs = db.query(Notification).filter(
        ((Notification.recipient_role == "teacher") &
         ((Notification.recipient_id == teacher_id) | (Notification.recipient_id == None))) |
        (Notification.recipient_role == "all")
    ).order_by(Notification.created_at.desc()).limit(50).all()
    return [{"notification_id": n.notification_id, "title": n.title,
             "message": n.message, "is_read": n.is_read, "created_at": n.created_at} for n in notifs]


@router.get("/export/csv")
def export_csv(
    cls: str = Query(...),
    subject: str = Query(...),
    start: str = Query(None),
    end: str = Query(None),
    user: dict = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    if not start or not end:
        end_date = datetime.now().date()
        start = (end_date - timedelta(days=6)).strftime("%Y-%m-%d")
        end = end_date.strftime("%Y-%m-%d")

    students = db.query(Student).join(Student.subjects).filter(
        Student.class_ == cls,
        Subject.name == subject
    ).order_by(Student.roll_no).all()
    time_rows = db.query(Attendance.time).filter(
        Attendance.class_ == cls, Attendance.subject == subject,
        Attendance.date.between(start, end), Attendance.time.isnot(None),
    ).distinct().all()
    lecture_times = ", ".join([t.time for t in time_rows if t.time]) or "N/A"

    buf = StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Roll No", "Name", "Total Lectures", "Attended", "% Attendance", "Class", "Subject", "From", "To", "Lecture Time"])

    for s in students:
        rows = db.query(Attendance).filter(
            Attendance.student_id == s.student_id,
            Attendance.subject == subject,
            Attendance.class_ == cls,
            Attendance.date.between(start, end),
        ).all()
        total = len(rows)
        attended = sum(1 for r in rows if r.status == "Present")
        percent = (attended / total * 100) if total > 0 else 0.0
        writer.writerow([s.roll_no, s.name, total, attended, f"{round(percent,2)}%", cls, subject, start, end, lecture_times])

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue().encode("utf-8")]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=attendance_{cls}_{subject}_{start}_to_{end}.csv"},
    )


@router.get("/export/pdf")
def export_pdf(
    cls: str = Query(...),
    subject: str = Query(...),
    start: str = Query(None),
    end: str = Query(None),
    user: dict = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    if not start or not end:
        end_date = datetime.now().date()
        start = (end_date - timedelta(days=6)).strftime("%Y-%m-%d")
        end = end_date.strftime("%Y-%m-%d")

    students = db.query(Student).join(Student.subjects).filter(
        Student.class_ == cls,
        Subject.name == subject
    ).order_by(Student.roll_no).all()
    time_rows = db.query(Attendance.time).filter(
        Attendance.class_ == cls, Attendance.subject == subject,
        Attendance.date.between(start, end), Attendance.time.isnot(None),
    ).distinct().all()
    lecture_times = [t.time for t in time_rows if t.time]

    rows_out = []
    for s in students:
        rows = db.query(Attendance).filter(
            Attendance.student_id == s.student_id,
            Attendance.subject == subject,
            Attendance.class_ == cls,
            Attendance.date.between(start, end),
        ).all()
        total = len(rows)
        attended = sum(1 for r in rows if r.status == "Present")
        pct = round((attended / total * 100), 2) if total > 0 else 0.0
        rows_out.append((s.roll_no, s.name, total, attended, pct))

    from app.models import CollegeSettings
    s = db.query(CollegeSettings).first()
    settings_dict = {"college_name": s.college_name, "college_address": s.college_address} if s else None

    buf = generate_attendance_pdf(
        title=f"Attendance Report: {cls} - {subject}",
        subtitle=f"From {start} to {end}",
        rows=rows_out,
        lecture_times=lecture_times,
        settings=settings_dict
    )
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=attendance_{cls}_{subject}_{start}_to_{end}.pdf"},
    )


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    user: dict = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    teacher_id = int(user["sub"])
    teacher = db.query(Teacher).filter(Teacher.teacher_id == teacher_id).first()
    if not teacher or not verify_password(payload.current_password, teacher.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    teacher.password_hash = hash_password(payload.new_password)
    teacher.must_change_password = False
    db.commit()
    return {"message": "Password updated successfully"}


@router.post("/upload-profile")
def upload_profile(
    file: UploadFile = File(...),
    user: dict = Depends(require_role("teacher")),
    db: Session = Depends(get_db)
):
    import os
    import uuid
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
        raise HTTPException(400, "Invalid image format")
    
    os.makedirs("uploads", exist_ok=True)
    filename = f"teacher_{user['sub']}_{uuid.uuid4().hex}{ext}"
    filepath = os.path.join("uploads", filename)
    
    try:
        content = file.file.read()
        with open(filepath, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(500, f"Could not save file: {e}")
        
    teacher_id = int(user["sub"])
    teacher = db.query(Teacher).filter(Teacher.teacher_id == teacher_id).first()
    if not teacher:
        raise HTTPException(404, "Teacher not found")
        
    url_path = f"/uploads/{filename}"
    teacher.profile_photo = url_path
    db.commit()
    return {"profile_photo": url_path}
