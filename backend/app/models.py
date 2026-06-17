from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint, CheckConstraint, DateTime, Text, Boolean, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Department(Base):
    __tablename__ = "departments"
    dept_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    code = Column(String, unique=True)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    hods = relationship("HOD", back_populates="dept_obj", cascade="all, delete")
    subjects = relationship("Subject", back_populates="dept_obj", cascade="all, delete")
    classes = relationship("HodClass", back_populates="dept_obj", cascade="all, delete")


class StudentSubject(Base):
    __tablename__ = "student_subjects"
    student_id = Column(Integer, ForeignKey("students.student_id", ondelete="CASCADE"), primary_key=True)
    subject_id = Column(Integer, ForeignKey("subjects.subject_id", ondelete="CASCADE"), primary_key=True)


class Student(Base):
    __tablename__ = "students"
    student_id = Column(Integer, primary_key=True, autoincrement=True)
    roll_no = Column(String, nullable=False, unique=True)
    prn = Column(String, unique=True)
    name = Column(String, nullable=False)
    class_ = Column("class", String, nullable=False)
    semester = Column(Integer, nullable=False, default=2)
    password_hash = Column(String, nullable=False)
    must_change_password = Column(Boolean, default=True, nullable=False)
    profile_photo = Column(String, nullable=True)
    attendance = relationship("Attendance", back_populates="student", cascade="all, delete")
    subjects = relationship("Subject", secondary="student_subjects", back_populates="students")
    created_by_role = Column(String, nullable=True)
    created_by_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())



class Teacher(Base):
    __tablename__ = "teachers"
    teacher_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    phone = Column(String, unique=True)
    email = Column(String, unique=True, nullable=True)
    password_hash = Column(String, nullable=False)
    dept_id = Column(Integer, ForeignKey("departments.dept_id", ondelete="SET NULL"), nullable=True)
    must_change_password = Column(Boolean, default=True, nullable=False)
    profile_photo = Column(String, nullable=True)
    
    dept_obj = relationship("Department")
    assignments = relationship("TeacherAssignment", back_populates="teacher", cascade="all, delete")
    attendance = relationship("Attendance", back_populates="teacher")
    created_by_role = Column(String, nullable=True)
    created_by_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TeacherAssignment(Base):
    __tablename__ = "teacher_assignments"
    assignment_id = Column(Integer, primary_key=True, autoincrement=True)
    teacher_id = Column(Integer, ForeignKey("teachers.teacher_id", ondelete="CASCADE"), nullable=False)
    subject = Column(String, nullable=False)
    class_ = Column("class", String, nullable=False)
    teacher = relationship("Teacher", back_populates="assignments")
    __table_args__ = (UniqueConstraint("teacher_id", "subject", "class", name="uq_teacher_subject_class"),)


class Admin(Base):
    __tablename__ = "admins"
    admin_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True)
    password_hash = Column(String, nullable=False)


class HOD(Base):
    __tablename__ = "hods"
    hod_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False, unique=True)
    email = Column(String, unique=True, nullable=True)
    department = Column(String, nullable=True)  # Legacy string
    dept_id = Column(Integer, ForeignKey("departments.dept_id", ondelete="SET NULL"), nullable=True)
    password_hash = Column(String, nullable=False)
    created_by_admin_id = Column(Integer, ForeignKey("admins.admin_id", ondelete="SET NULL"), nullable=True)
    profile_photo = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    dept_obj = relationship("Department", back_populates="hods")
    hod_classes = relationship("HodClass", back_populates="hod", cascade="all, delete")
    dept_mappings = relationship("Department", secondary="hod_departments", backref="hod_objs")


class HodClass(Base):
    __tablename__ = "hod_classes"
    id = Column(Integer, primary_key=True, autoincrement=True)
    hod_id = Column(Integer, ForeignKey("hods.hod_id", ondelete="CASCADE"), nullable=True)
    class_name = Column(String, nullable=False)
    division = Column(String, nullable=True)
    department = Column(String, nullable=True) # Legacy string
    dept_id = Column(Integer, ForeignKey("departments.dept_id", ondelete="SET NULL"), nullable=True)
    semester = Column(Integer, nullable=True, default=2)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    hod = relationship("HOD", back_populates="hod_classes")
    dept_obj = relationship("Department", back_populates="classes")
    dept_mappings = relationship(
        "Department",
        secondary="class_departments",
        primaryjoin="HodClass.class_name == ClassDepartment.class_name",
        secondaryjoin="Department.dept_id == ClassDepartment.dept_id",
        backref="class_objs"
    )
    __table_args__ = (UniqueConstraint("hod_id", "class_name", name="uq_hod_class"),)



class ActivityLog(Base):
    __tablename__ = "activity_logs"
    log_id = Column(Integer, primary_key=True, autoincrement=True)
    actor_role = Column(String, nullable=False)
    actor_id = Column(Integer, nullable=False)
    actor_name = Column(String, nullable=False)
    action = Column(String, nullable=False)
    target = Column(String, nullable=True)
    detail = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Attendance(Base):
    __tablename__ = "attendance"
    attendance_id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("teachers.teacher_id", ondelete="CASCADE"), nullable=False)
    subject = Column(String, nullable=False)
    class_ = Column("class", String, nullable=False)
    date = Column(String, nullable=False)
    time = Column(String)
    status = Column(String, nullable=False)
    student = relationship("Student", back_populates="attendance")
    teacher = relationship("Teacher", back_populates="attendance")
    __table_args__ = (
        UniqueConstraint("student_id", "subject", "class", "date", name="uq_attendance"),
        CheckConstraint("status IN ('Present','Absent')", name="chk_status"),
    )


class Holiday(Base):
    __tablename__ = "holidays"
    holiday_id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(String, nullable=False, unique=True)
    name = Column(String, nullable=False)
    created_by = Column(String, nullable=False, default="admin")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"
    notification_id = Column(Integer, primary_key=True, autoincrement=True)
    recipient_role = Column(String, nullable=False)  # student | teacher | hod | admin | all
    recipient_id = Column(Integer, nullable=True)    # null = broadcast to all of that role
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_by_role = Column(String, nullable=False)
    created_by_id = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())



class Subject(Base):
    __tablename__ = "subjects"
    subject_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    code = Column(String, unique=True)
    department = Column(String) # Legacy string
    dept_id = Column(Integer, ForeignKey("departments.dept_id", ondelete="SET NULL"), nullable=True)
    created_by_role = Column(String, nullable=True)
    created_by_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    dept_obj = relationship("Department", back_populates="subjects")
    class_mappings = relationship("ClassSubject", back_populates="subject", cascade="all, delete")
    dept_mappings = relationship("Department", secondary="subject_departments", backref="subject_objs")
    students = relationship("Student", secondary="student_subjects", back_populates="subjects")


class ClassSubject(Base):
    __tablename__ = "class_subjects"
    class_name = Column(String, primary_key=True)
    subject_id = Column(Integer, ForeignKey("subjects.subject_id", ondelete="CASCADE"), primary_key=True)
    subject = relationship("Subject", back_populates="class_mappings")


class SubjectDepartment(Base):
    __tablename__ = "subject_departments"
    subject_id = Column(Integer, ForeignKey("subjects.subject_id", ondelete="CASCADE"), primary_key=True)
    dept_id = Column(Integer, ForeignKey("departments.dept_id", ondelete="CASCADE"), primary_key=True)


class HodDepartment(Base):
    __tablename__ = "hod_departments"
    hod_id = Column(Integer, ForeignKey("hods.hod_id", ondelete="CASCADE"), primary_key=True)
    dept_id = Column(Integer, ForeignKey("departments.dept_id", ondelete="CASCADE"), primary_key=True)


class ClassDepartment(Base):
    __tablename__ = "class_departments"
    class_name = Column(String, primary_key=True)
    dept_id = Column(Integer, ForeignKey("departments.dept_id", ondelete="CASCADE"), primary_key=True)


class CollegeSettings(Base):
    __tablename__ = "college_settings"
    id = Column(Integer, primary_key=True, autoincrement=True)
    college_name = Column(String, nullable=False, default="My College")
    college_short_name = Column(String, nullable=True)  # e.g. "RSCOE"
    college_address = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)             # URL or path to logo
    attendance_threshold = Column(Integer, nullable=False, default=75)  # %
    academic_year = Column(String, nullable=True)        # e.g. "2024-25"
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
