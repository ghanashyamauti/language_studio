# JSPM Attendance Tracker v2.0

A full-stack rebuild of the JSPM Attendance system using **React + FastAPI + PostgreSQL**.

---

## 🏗️ Tech Stack

| Layer    | Technology                         |
|----------|------------------------------------|
| Frontend | React 18, Vite, Tailwind CSS v3    |
| Backend  | Python 3.12, FastAPI, SQLAlchemy   |
| Database | PostgreSQL                         |
| Auth     | JWT (python-jose) + passlib/bcrypt |
| PDF      | ReportLab (same styling as v1)     |

---

## 📁 Project Structure

```
jspm-attendance/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI entry point
│   │   ├── database.py       # PostgreSQL connection
│   │   ├── models.py         # SQLAlchemy ORM models
│   │   ├── schemas.py        # Pydantic schemas
│   │   ├── auth.py           # JWT auth + role guards
│   │   ├── pdf_utils.py      # PDF generation (original styling)
│   │   └── routers/
│   │       ├── auth.py       # /auth/login
│   │       ├── student.py    # /student/*
│   │       ├── teacher.py    # /teacher/*
│   │       ├── admin.py      # /admin/*
│   │       └── hod.py        # /hod/*
│   ├── migrate_sqlite_to_postgres.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api/client.js        # Axios with JWT interceptor
    │   ├── context/AuthContext  # Global auth state
    │   ├── components/          # Layout, Pagination, ProtectedRoute
    │   └── pages/
    │       ├── LoginPage.jsx
    │       ├── student/
    │       ├── teacher/
    │       ├── admin/
    │       └── hod/
    └── package.json
```

---

## 🚀 Setup Instructions

### 1. PostgreSQL — Create Database

```sql
psql -U postgres
CREATE DATABASE jspm_attendance;
\q
```

### 2. Backend Setup

```bash
cd backend

# Copy and configure environment
cp .env.example .env
# Edit .env: set DATABASE_URL with your postgres password

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Start the API server (auto-creates tables on first run)
uvicorn app.main:app --reload --port 8000
```

API will be running at: http://localhost:8000  
Interactive docs: http://localhost:8000/docs

### 3. Migrate Existing Data (SQLite → PostgreSQL)

After the backend is running (tables created), migrate your existing data:

```bash
python migrate_sqlite_to_postgres.py --sqlite path/to/attendance.db
```

This migrates all 169 students, 7 teachers, 261 attendance records, admins, HODs, and assignments.

### 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend will be at: http://localhost:5173

---

## 🔐 Login Credentials (from migrated data)

| Role    | Username          | Password     |
|---------|-------------------|--------------|
| Student | Roll No or PRN    | Test@123     |
| Teacher | Phone number      | (unchanged)  |
| Admin   | admin@example.com | admin123     |
| HOD     | 9764996844        | Satish123    |

Example student: PRN `42456530002` / Roll `24MCA1A02` (Ghanashyam)

---

## 🌐 API Endpoints

| Method | Endpoint                     | Role     | Description               |
|--------|------------------------------|----------|---------------------------|
| POST   | /auth/login                  | Public   | Login, get JWT token      |
| GET    | /student/dashboard           | Student  | Attendance + subject %    |
| GET    | /teacher/assignments         | Teacher  | Classes & subjects        |
| GET    | /teacher/students            | Teacher  | Students for marking      |
| POST   | /teacher/mark                | Teacher  | Save attendance           |
| GET    | /teacher/report              | Teacher  | Paginated report          |
| GET    | /teacher/export/csv          | Teacher  | CSV export                |
| GET    | /teacher/export/pdf          | Teacher  | PDF export                |
| POST   | /teacher/change-password     | Teacher  | Change password           |
| GET    | /admin/reports               | Admin    | All students report       |
| GET    | /admin/export/csv            | Admin    | CSV export                |
| GET    | /admin/export/pdf            | Admin    | Defaulters PDF            |
| POST   | /admin/students/import       | Admin    | Bulk import students      |
| POST   | /admin/teachers/import       | Admin    | Bulk import teachers      |
| GET    | /hod/dashboard               | HOD      | Teachers & classes        |
| POST   | /hod/student/remove          | HOD      | Remove student            |
| POST   | /hod/teacher/remove          | HOD      | Remove teacher            |
| POST   | /hod/teacher/update-phone    | HOD      | Update teacher phone      |
| POST   | /hod/class/import            | HOD      | Import class + assignments|

---

## 📝 Notes

- JWT tokens expire after 8 hours (configurable in `.env`)
- Password hashes from the original SQLite DB (pbkdf2_sha256) are fully supported — no re-hashing needed
- PDF export uses identical ReportLab styling as the original Flask app
- All pagination defaults to 20 items per page

---

Made with ❤️ for JSPM educators and students
