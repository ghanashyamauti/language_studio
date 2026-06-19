"""
Leave management router — handles leave applications for both teachers and HODs.
- Teachers apply → HOD or Admin reviews
- HODs apply → Admin reviews
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.database import get_db
from app import activity
from app.auth import require_role
from app.models import StaffLeave, Teacher, HOD, Notification
from app.schemas import LeaveApplyRequest, LeaveReviewRequest

router = APIRouter(prefix="/leave", tags=["leave"])


def _get_applicant_name(db: Session, role: str, user_id: int) -> str:
    if role == "teacher":
        t = db.query(Teacher).filter(Teacher.teacher_id == user_id).first()
        return t.name if t else "Unknown"
    elif role == "hod":
        h = db.query(HOD).filter(HOD.hod_id == user_id).first()
        return h.name if h else "Unknown"
    return "Unknown"


def _leave_to_dict(leave: StaffLeave, db: Session) -> dict:
    return {
        "leave_id": leave.leave_id,
        "applicant_role": leave.applicant_role,
        "applicant_id": leave.applicant_id,
        "applicant_name": _get_applicant_name(db, leave.applicant_role, leave.applicant_id),
        "leave_type": leave.leave_type,
        "start_date": leave.start_date,
        "end_date": leave.end_date,
        "reason": leave.reason,
        "status": leave.status,
        "reviewed_by_role": leave.reviewed_by_role,
        "reviewed_by_name": leave.reviewed_by_name,
        "review_comment": leave.review_comment,
        "created_at": leave.created_at,
        "reviewed_at": leave.reviewed_at,
    }


# ── Apply for leave (teacher or hod) ─────────────────────────────────────────
@router.post("/apply")
def apply_leave(
    payload: LeaveApplyRequest,
    request: Request,
    user: dict = Depends(require_role("teacher", "hod")),
    db: Session = Depends(get_db),
):
    role = user["role"]
    user_id = int(user["sub"])

    # Validate leave type
    valid_types = ["Casual Leave", "Sick Leave", "Personal Leave", "Other"]
    if payload.leave_type not in valid_types:
        raise HTTPException(400, f"Invalid leave type. Choose from: {', '.join(valid_types)}")

    # Validate dates
    try:
        start = datetime.strptime(payload.start_date, "%Y-%m-%d").date()
        end = datetime.strptime(payload.end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD")

    if end < start:
        raise HTTPException(400, "End date cannot be before start date")

    today = datetime.now().date()
    if start < today:
        raise HTTPException(400, "Cannot apply for leave on past dates")

    # Check for overlapping leaves (pending or approved)
    overlap = db.query(StaffLeave).filter(
        StaffLeave.applicant_role == role,
        StaffLeave.applicant_id == user_id,
        StaffLeave.status.in_(["pending", "approved"]),
        StaffLeave.start_date <= payload.end_date,
        StaffLeave.end_date >= payload.start_date,
    ).first()
    if overlap:
        raise HTTPException(400, "You already have a leave application for overlapping dates")

    if not payload.reason.strip():
        raise HTTPException(400, "Reason is required")

    leave = StaffLeave(
        applicant_role=role,
        applicant_id=user_id,
        leave_type=payload.leave_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        reason=payload.reason.strip(),
        status="pending",
    )
    db.add(leave)

    activity.log(db, role, user_id, user["name"], "APPLY_LEAVE",
                 target=f"{payload.leave_type}: {payload.start_date} to {payload.end_date}",
                 ip=request.client.host if request.client else None)
    db.commit()
    return {"message": "Leave application submitted", "leave_id": leave.leave_id}


# ── View own leaves ───────────────────────────────────────────────────────────
@router.get("/my-leaves")
def my_leaves(
    status: Optional[str] = Query(None),
    user: dict = Depends(require_role("teacher", "hod")),
    db: Session = Depends(get_db),
):
    role = user["role"]
    user_id = int(user["sub"])

    q = db.query(StaffLeave).filter(
        StaffLeave.applicant_role == role,
        StaffLeave.applicant_id == user_id,
    )
    if status:
        q = q.filter(StaffLeave.status == status)

    leaves = q.order_by(StaffLeave.created_at.desc()).limit(100).all()
    return [_leave_to_dict(l, db) for l in leaves]


# ── Cancel a pending leave ────────────────────────────────────────────────────
@router.delete("/cancel/{leave_id}")
def cancel_leave(
    leave_id: int,
    request: Request,
    user: dict = Depends(require_role("teacher", "hod")),
    db: Session = Depends(get_db),
):
    role = user["role"]
    user_id = int(user["sub"])

    leave = db.query(StaffLeave).filter(
        StaffLeave.leave_id == leave_id,
        StaffLeave.applicant_role == role,
        StaffLeave.applicant_id == user_id,
    ).first()
    if not leave:
        raise HTTPException(404, "Leave not found")
    if leave.status != "pending":
        raise HTTPException(400, "Only pending leaves can be cancelled")

    db.delete(leave)
    activity.log(db, role, user_id, user["name"], "CANCEL_LEAVE",
                 target=f"Leave #{leave_id}",
                 ip=request.client.host if request.client else None)
    db.commit()
    return {"message": "Leave cancelled"}


# ── Get pending leaves for review (HOD sees teacher leaves, Admin sees all) ──
@router.get("/pending")
def pending_leaves(
    user: dict = Depends(require_role("hod", "admin")),
    db: Session = Depends(get_db),
):
    role = user["role"]

    if role == "admin":
        # Admin sees all pending leaves (both teacher and hod)
        leaves = db.query(StaffLeave).filter(
            StaffLeave.status == "pending"
        ).order_by(StaffLeave.created_at.desc()).all()
    else:
        # HOD sees only teacher pending leaves
        leaves = db.query(StaffLeave).filter(
            StaffLeave.applicant_role == "teacher",
            StaffLeave.status == "pending",
        ).order_by(StaffLeave.created_at.desc()).all()

    return [_leave_to_dict(l, db) for l in leaves]


# ── Get all leaves with optional filters ──────────────────────────────────────
@router.get("/all")
def all_leaves(
    status: Optional[str] = Query(None),
    applicant_role: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_role("hod", "admin")),
    db: Session = Depends(get_db),
):
    role = user["role"]

    q = db.query(StaffLeave)

    if role == "hod":
        # HOD only sees teacher leaves
        q = q.filter(StaffLeave.applicant_role == "teacher")
    
    if status:
        q = q.filter(StaffLeave.status == status)
    if applicant_role and role == "admin":
        q = q.filter(StaffLeave.applicant_role == applicant_role)

    total = q.count()
    leaves = q.order_by(StaffLeave.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "leaves": [_leave_to_dict(l, db) for l in leaves],
        "total": total,
        "page": page,
        "total_pages": (total + limit - 1) // limit if total > 0 else 1,
    }


# ── Review a leave (approve / reject) ────────────────────────────────────────
@router.put("/{leave_id}/review")
def review_leave(
    leave_id: int,
    payload: LeaveReviewRequest,
    request: Request,
    user: dict = Depends(require_role("hod", "admin")),
    db: Session = Depends(get_db),
):
    reviewer_role = user["role"]
    reviewer_id = int(user["sub"])

    if payload.status not in ("approved", "rejected"):
        raise HTTPException(400, "Status must be 'approved' or 'rejected'")

    leave = db.query(StaffLeave).filter(StaffLeave.leave_id == leave_id).first()
    if not leave:
        raise HTTPException(404, "Leave not found")

    if leave.status != "pending":
        raise HTTPException(400, "This leave has already been reviewed")

    # HOD cannot approve their own leave or other HOD leaves
    if reviewer_role == "hod":
        if leave.applicant_role == "hod":
            raise HTTPException(403, "Only Admin can review manager leave applications")
        if leave.applicant_role == "teacher":
            hod = db.query(HOD).filter(HOD.hod_id == reviewer_id).first()
            teacher = db.query(Teacher).filter(Teacher.teacher_id == leave.applicant_id).first()
            if hod and teacher:
                is_same = False
                if hod.email and teacher.email and hod.email.lower().strip() == teacher.email.lower().strip():
                    is_same = True
                elif hod.phone and teacher.phone and hod.phone.strip() == teacher.phone.strip():
                    is_same = True
                elif hod.name.strip().lower() == teacher.name.strip().lower():
                    is_same = True
                if is_same:
                    raise HTTPException(403, "Cannot review your own leave")

    # Admin can review everything
    leave.status = payload.status
    leave.reviewed_by_role = reviewer_role
    leave.reviewed_by_id = reviewer_id
    leave.reviewed_by_name = user["name"]
    leave.review_comment = payload.comment
    leave.reviewed_at = datetime.utcnow()

    # Send notification to the applicant
    applicant_name = _get_applicant_name(db, leave.applicant_role, leave.applicant_id)
    status_text = "approved ✅" if payload.status == "approved" else "rejected ❌"
    notification = Notification(
        recipient_role=leave.applicant_role,
        recipient_id=leave.applicant_id,
        title=f"Leave {status_text}",
        message=f"Your {leave.leave_type} from {leave.start_date} to {leave.end_date} has been {status_text} by {user['name']}.{(' Comment: ' + payload.comment) if payload.comment else ''}",
        created_by_role=reviewer_role,
        created_by_id=reviewer_id,
    )
    db.add(notification)

    activity.log(db, reviewer_role, reviewer_id, user["name"],
                 f"{'APPROVE' if payload.status == 'approved' else 'REJECT'}_LEAVE",
                 target=f"{applicant_name}'s {leave.leave_type} ({leave.start_date} to {leave.end_date})",
                 ip=request.client.host if request.client else None)
    db.commit()
    return {"message": f"Leave {payload.status}"}


# ── Get leaves for a specific teacher/hod ─────────────────────────────────────
@router.get("/staff/{staff_role}/{staff_id}")
def staff_leaves(
    staff_role: str,
    staff_id: int,
    user: dict = Depends(require_role("hod", "admin")),
    db: Session = Depends(get_db),
):
    if staff_role not in ("teacher", "hod"):
        raise HTTPException(400, "Invalid role")

    leaves = db.query(StaffLeave).filter(
        StaffLeave.applicant_role == staff_role,
        StaffLeave.applicant_id == staff_id,
    ).order_by(StaffLeave.created_at.desc()).all()

    return [_leave_to_dict(l, db) for l in leaves]


# ── Check if user is on leave today ───────────────────────────────────────────
@router.get("/check-today")
def check_leave_today(
    user: dict = Depends(require_role("teacher", "hod")),
    db: Session = Depends(get_db),
):
    role = user["role"]
    user_id = int(user["sub"])
    today = datetime.now().strftime("%Y-%m-%d")

    on_leave = db.query(StaffLeave).filter(
        StaffLeave.applicant_role == role,
        StaffLeave.applicant_id == user_id,
        StaffLeave.status == "approved",
        StaffLeave.start_date <= today,
        StaffLeave.end_date >= today,
    ).first()

    return {"on_leave": on_leave is not None, "leave": _leave_to_dict(on_leave, db) if on_leave else None}


# ── Leave summary stats (for dashboard cards) ────────────────────────────────
@router.get("/stats")
def leave_stats(
    user: dict = Depends(require_role("hod", "admin")),
    db: Session = Depends(get_db),
):
    role = user["role"]
    
    base_q = db.query(StaffLeave)
    if role == "hod":
        base_q = base_q.filter(StaffLeave.applicant_role == "teacher")

    pending = base_q.filter(StaffLeave.status == "pending").count()
    approved = base_q.filter(StaffLeave.status == "approved").count()
    rejected = base_q.filter(StaffLeave.status == "rejected").count()

    return {"pending": pending, "approved": approved, "rejected": rejected, "total": pending + approved + rejected}
