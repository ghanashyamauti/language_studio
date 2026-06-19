from pydantic import BaseModel, field_validator
from typing import Optional, List, Any
from datetime import datetime


# ── Auth ──────────────────────────────────────────────────────────────────────
class AdminResetPasswordRequest(BaseModel):
    new_password: str

class LoginRequest(BaseModel):
    role: str
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str
    user_id: int
    extra: Optional[dict] = None


# ── Students ──────────────────────────────────────────────────────────────────
class StudentOut(BaseModel):
    student_id: int
    roll_no: str
    prn: Optional[str]
    name: str
    class_: str
    semester: int
    created_by_name: Optional[str] = None
    profile_photo: Optional[str] = None
    subjects: List[str] = []
    model_config = {"from_attributes": True}

    @field_validator("subjects", mode="before")
    @classmethod
    def serialize_subjects(cls, v):
        if not v:
            return []
        res = []
        for x in v:
            if isinstance(x, str):
                res.append(x)
            elif hasattr(x, "name"):
                res.append(x.name)
        return res

class CreateStudentRequest(BaseModel):
    roll_no: str
    prn: Optional[str] = None
    name: str
    class_: str
    semester: int = 2
    password: Optional[str] = "Test@123"
    subjects: List[str] = []


class AttendanceRecord(BaseModel):
    date: str
    subject: str
    status: str

class SubjectPercent(BaseModel):
    subject: str
    code: str
    total: int
    attended: int
    percent: float

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def password_min_length(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


# ── Teacher ───────────────────────────────────────────────────────────────────
class MarkAttendanceRequest(BaseModel):
    class_: str
    subject: str
    date: str
    time: Optional[str] = ""
    statuses: dict

class BulkAttendanceCorrectionRequest(BaseModel):
    class_: str
    subject: str
    date: str
    statuses: dict   # student_id -> "Present"|"Absent"


# ── Admin ─────────────────────────────────────────────────────────────────────
class CreateHODRequest(BaseModel):
    name: str
    phone: str
    email: str
    department: Optional[str] = None
    dept_id: Optional[int] = None
    dept_ids: List[int] = []
    password: Optional[str] = None
    class_names: Optional[List[str]] = []

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        cleaned = "".join(c for c in v if c.isdigit())
        if len(cleaned) != 10 or len(v) != 10:
            raise ValueError("Mobile number must be exactly 10 digits")
        return cleaned

class UpdateTeacherRequest(BaseModel):
    name: str
    phone: str
    email: str
    dept_id: Optional[int] = None
    password: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        cleaned = "".join(c for c in v if c.isdigit())
        if len(cleaned) != 10 or len(v) != 10:
            raise ValueError("Mobile number must be exactly 10 digits")
        return cleaned

class CreateTeacherRequest(BaseModel):
    name: str
    phone: str
    email: str
    password: str
    dept_id: Optional[int] = None
    assignments: Optional[List[dict]] = []

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        cleaned = "".join(c for c in v if c.isdigit())
        if len(cleaned) != 10 or len(v) != 10:
            raise ValueError("Mobile number must be exactly 10 digits")
        return cleaned

class HODOut(BaseModel):
    hod_id: int
    name: str
    phone: str
    email: Optional[str]
    department: Optional[str]
    dept_id: Optional[int]
    dept_name: Optional[str] = None
    dept_ids: List[int] = []
    dept_names: List[str] = []
    created_at: Optional[datetime]
    classes: List[str] = []
    profile_photo: Optional[str] = None
    model_config = {"from_attributes": True}

class TeacherOut(BaseModel):
    teacher_id: int
    name: str
    phone: str
    email: Optional[str] = None
    dept_id: Optional[int] = None
    dept_name: Optional[str] = None
    assignments: List[dict] = []
    created_by_name: Optional[str] = None
    profile_photo: Optional[str] = None
    model_config = {"from_attributes": True}

class ActivityLogOut(BaseModel):
    log_id: int
    actor_role: str
    actor_id: int
    actor_name: str
    action: str
    target: Optional[str]
    detail: Optional[str]
    ip_address: Optional[str]
    created_at: Optional[datetime]
    model_config = {"from_attributes": True}

class AdminReportRow(BaseModel):
    roll_no: str
    name: str
    class_: str
    total: int
    attended: int
    percent: float

class BulkImportRequest(BaseModel):
    class_: str
    semester: int = 2
    data: str

class TeacherImportRequest(BaseModel):
    data: str

class AssignClassToHODRequest(BaseModel):
    hod_id: int
    class_name: str

class AdminCreateClassRequest(BaseModel):
    class_name: str
    hod_id: Optional[int] = None
    dept_id: Optional[int] = None
    dept_ids: List[int] = []
    semester: int = 2
    subjects: List[int] = []

class AdminUpdateClassRequest(BaseModel):
    class_name: str
    hod_id: Optional[int] = None
    dept_id: Optional[int] = None
    dept_ids: List[int] = []
    semester: Optional[int] = None
    subjects: List[int] = []

class UpdateProfileRequest(BaseModel):
    name: str
    email: Optional[str] = None
    phone: str
    department: Optional[str] = None

# ── Holiday ───────────────────────────────────────────────────────────────────
class HolidayCreate(BaseModel):
    date: str
    name: str

class HolidayOut(BaseModel):
    holiday_id: int
    date: str
    name: str
    created_by: str
    model_config = {"from_attributes": True}

# ── Notifications ─────────────────────────────────────────────────────────────
class NotificationCreate(BaseModel):
    recipient_role: str
    recipient_id: Optional[int] = None
    title: str
    message: str

class NotificationOut(BaseModel):
    notification_id: int
    title: str
    message: str
    is_read: bool
    created_by_role: str
    created_at: Optional[datetime]
    model_config = {"from_attributes": True}

# ── HOD ───────────────────────────────────────────────────────────────────────
class CreateClassRequest(BaseModel):
    class_name: str
    division: Optional[str] = None
    department: Optional[str] = None
    dept_id: Optional[int] = None
    dept_ids: List[int] = []
    semester: int = 2

class AssignTeacherRequest(BaseModel):
    class_name: str
    subject: str
    teacher_id: int   # use teacher_id directly (fixed from phone string)

class HodReportRow(BaseModel):
    roll_no: str
    name: str
    total: int
    attended: int
    percent: float

class RemoveStudentRequest(BaseModel):
    student_id: int   # fixed: use integer PK, not ambiguous string

class RemoveTeacherRequest(BaseModel):
    phone: str

class UpdateTeacherPhoneRequest(BaseModel):
    key: str
    new_phone: str

class ClassImportRequest(BaseModel):
    class_: str
    semester: int = 2
    data: str
    assignments: Optional[str] = ""

class PublicStatsResponse(BaseModel):
    total_students: int
    total_teachers: int
    total_classes: int
    total_hods: int

# ── College Settings ─────────────────────────────────────────────────────────
class CollegeSettingsUpdate(BaseModel):
    college_name: str
    college_short_name: Optional[str] = None
    college_address: Optional[str] = None
    logo_url: Optional[str] = None
    attendance_threshold: int = 75
    academic_year: Optional[str] = None

class CollegeSettingsOut(BaseModel):
    id: int
    college_name: str
    college_short_name: Optional[str]
    college_address: Optional[str]
    logo_url: Optional[str]
    attendance_threshold: int
    academic_year: Optional[str]
    model_config = {"from_attributes": True}

# ── Departments ──────────────────────────────────────────────────────────────
class DepartmentCreate(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None

class DepartmentUpdate(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None

class DepartmentOut(BaseModel):
    dept_id: int
    name: str
    code: Optional[str]
    description: Optional[str]
    model_config = {"from_attributes": True}


# ── Subjects ──────────────────────────────────────────────────────────────────
class SubjectCreate(BaseModel):
    name: str
    code: Optional[str] = None
    department: Optional[str] = None
    dept_id: Optional[int] = None
    dept_ids: List[int] = []
    classes: List[str] = []

class SubjectUpdate(BaseModel):
    name: str
    code: Optional[str] = None
    department: Optional[str] = None
    dept_id: Optional[int] = None
    dept_ids: List[int] = []
    classes: List[str] = []

class SubjectOut(BaseModel):
    subject_id: int
    name: str
    code: Optional[str]
    department: Optional[str]
    dept_id: Optional[int]
    dept_name: Optional[str] = None
    dept_ids: List[int] = []
    dept_names: List[str] = []
    assigned_classes: List[str] = []
    created_by_name: Optional[str] = None
    model_config = {"from_attributes": True}


# ── Leave Management ─────────────────────────────────────────────────────────
class LeaveApplyRequest(BaseModel):
    leave_type: str       # Casual Leave, Sick Leave, Personal Leave, Other
    start_date: str       # YYYY-MM-DD
    end_date: str         # YYYY-MM-DD
    reason: str

class LeaveReviewRequest(BaseModel):
    status: str           # approved or rejected
    comment: Optional[str] = None

class LeaveOut(BaseModel):
    leave_id: int
    applicant_role: str
    applicant_id: int
    applicant_name: Optional[str] = None
    leave_type: str
    start_date: str
    end_date: str
    reason: str
    status: str
    reviewed_by_role: Optional[str] = None
    reviewed_by_name: Optional[str] = None
    review_comment: Optional[str] = None
    created_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


# ── Face Detection Attendance ─────────────────────────────────────────────────
class FaceRegisterRequest(BaseModel):
    face_descriptor: list   # Array of 128 floats

class FaceAttendanceRequest(BaseModel):
    face_descriptor: list   # Array of 128 floats to match

class StaffAttendanceOut(BaseModel):
    id: int
    role: str
    user_id: int
    date: str
    check_in_time: Optional[str] = None
    status: str
    verified_by: str
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}

