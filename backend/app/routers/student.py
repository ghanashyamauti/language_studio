from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from io import StringIO
import csv
from app.database import get_db
from app.auth import require_role, verify_password, hash_password
from app.models import Attendance, TeacherAssignment, Student, Holiday, Notification
from app.schemas import ChangePasswordRequest

router = APIRouter(prefix="/student", tags=["student"])

SUBJECT_CODE_MAP = {
    "fbda": "230GDIM22",
    "bse": "230USYB01",
    "wireless communication": "230GETB38",
    "e-commerce": "230VBCB14",
    "e commerce": "230VBCB14",
    "ccf": "250GCAM65",
    "field project": "231GCAM24",
    "project": "231GCAM24",
    "dsa": "230GCAM11",
}

def normalize(name: str) -> str:
    return (name or "").strip().lower().replace("\u00a0", " ").replace("  ", " ")


@router.get("/dashboard")
def student_dashboard(
    period: str = Query("weekly"),
    start: str = Query(None),
    end: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    student_id = int(user["sub"])
    today = datetime.now().date()
    if not start or not end:
        if period == "daily":
            start_date = today
        elif period == "monthly":
            start_date = today - timedelta(days=29)
        else:
            start_date = today - timedelta(days=6)
        start = start_date.strftime("%Y-%m-%d")
        end = today.strftime("%Y-%m-%d")

    records_q = db.query(Attendance).filter(
        Attendance.student_id == student_id,
        Attendance.date.between(start, end),
    ).order_by(Attendance.date.desc())

    total = records_q.count()
    records = records_q.offset((page - 1) * limit).limit(limit).all()

    student = db.query(Student).filter(Student.student_id == student_id).first()
    class_name = student.class_ if student else ""

    subj_rows = db.query(TeacherAssignment.subject).filter(
        TeacherAssignment.class_ == class_name
    ).distinct().order_by(TeacherAssignment.subject).all()
    all_subjects = [r.subject for r in subj_rows]

    if not all_subjects:
        att_subj = db.query(Attendance.subject).filter(
            Attendance.class_ == class_name
        ).distinct().all()
        all_subjects = [r.subject for r in att_subj]

    percents = []
    for sub in all_subjects:
        sub_records = db.query(Attendance).filter(
            Attendance.student_id == student_id,
            Attendance.subject == sub,
            Attendance.date.between(start, end),
        ).all()
        total_sub = len(sub_records)
        attended = sum(1 for r in sub_records if r.status == "Present")
        # Only include subjects with actual data in the period
        if total_sub == 0:
            continue
        percent = (attended / total_sub * 100) if total_sub > 0 else 0.0
        percents.append({
            "subject": sub,
            "code": SUBJECT_CODE_MAP.get(normalize(sub), ""),
            "total": total_sub,
            "attended": attended,
            "percent": round(percent, 2),
        })

    below = [p for p in percents if p["percent"] < 75.0]

    # Fetch holidays in range
    holidays = db.query(Holiday).filter(Holiday.date.between(start, end)).all()

    return {
        "records": [{"date": r.date, "subject": r.subject, "status": r.status} for r in records],
        "percents": percents,
        "below": below,
        "holidays": [{"date": h.date, "name": h.name} for h in holidays],
        "period": period,
        "start": start,
        "end": end,
        "total": total,
        "page": page,
        "total_pages": (total + limit - 1) // limit if total > 0 else 1,
    }


@router.get("/calendar")
def student_calendar(
    year: int = Query(None),
    month: int = Query(None),
    user: dict = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """Return day-level attendance summary for calendar view."""
    today = datetime.now().date()
    if not year:
        year = today.year
    if not month:
        month = today.month

    # First and last day of month
    first_day = f"{year}-{month:02d}-01"
    if month == 12:
        last_day = f"{year+1}-01-01"
    else:
        last_day = f"{year}-{month+1:02d}-01"

    import datetime as dt
    last_date = (dt.date(year, month % 12 + 1, 1) - dt.timedelta(days=1)).strftime("%Y-%m-%d") if month < 12 else f"{year}-12-31"

    student_id = int(user["sub"])
    records = db.query(Attendance).filter(
        Attendance.student_id == student_id,
        Attendance.date >= first_day,
        Attendance.date <= last_date,
    ).all()

    # Group by date
    day_map = {}
    for r in records:
        if r.date not in day_map:
            day_map[r.date] = {"total": 0, "present": 0, "subjects": []}
        day_map[r.date]["total"] += 1
        if r.status == "Present":
            day_map[r.date]["present"] += 1
        day_map[r.date]["subjects"].append({"subject": r.subject, "status": r.status})

    holidays = db.query(Holiday).filter(Holiday.date >= first_day, Holiday.date <= last_date).all()
    holiday_map = {h.date: h.name for h in holidays}

    return {
        "year": year,
        "month": month,
        "days": day_map,
        "holidays": holiday_map,
    }


@router.get("/notifications")
def get_notifications(
    user: dict = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    student_id = int(user["sub"])
    notifs = db.query(Notification).filter(
        ((Notification.recipient_role == "student") & 
         ((Notification.recipient_id == student_id) | (Notification.recipient_id == None))) |
        (Notification.recipient_role == "all")
    ).order_by(Notification.created_at.desc()).limit(50).all()
    return [{"notification_id": n.notification_id, "title": n.title,
             "message": n.message, "is_read": n.is_read, "created_at": n.created_at} for n in notifs]


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    user: dict = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    n = db.query(Notification).filter(Notification.notification_id == notification_id).first()
    if n:
        n.is_read = True
        db.commit()
    return {"message": "Marked as read"}


@router.get("/export/pdf")
def export_my_report(
    user: dict = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """Download student's own attendance report as PDF."""
    from app.pdf_utils import generate_student_report_pdf
    student_id = int(user["sub"])
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(404, "Student not found")

    today = datetime.now().date()
    start = (today - timedelta(days=89)).strftime("%Y-%m-%d")
    end = today.strftime("%Y-%m-%d")

    subj_rows = db.query(TeacherAssignment.subject).filter(
        TeacherAssignment.class_ == student.class_
    ).distinct().all()
    subjects = [r.subject for r in subj_rows]

    subject_data = []
    for sub in subjects:
        recs = db.query(Attendance).filter(
            Attendance.student_id == student_id,
            Attendance.subject == sub,
            Attendance.date.between(start, end),
        ).all()
        total = len(recs)
        attended = sum(1 for r in recs if r.status == "Present")
        if total > 0:
            subject_data.append((sub, attended, total, round(attended/total*100, 2)))

    from app.models import CollegeSettings
    s = db.query(CollegeSettings).first()
    settings_dict = {"college_name": s.college_name, "college_address": s.college_address} if s else None

    buf = generate_student_report_pdf(student.name, student.roll_no, student.class_, subject_data, start, end, settings=settings_dict)
    return StreamingResponse(buf, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=my_attendance_{student.roll_no}.pdf"})


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    user: dict = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    student_id = int(user["sub"])
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student or not verify_password(payload.current_password, student.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    student.password_hash = hash_password(payload.new_password)
    student.must_change_password = False  # Clear force-change flag
    db.commit()
    return {"message": "Password updated successfully"}
