# JSPM Attendance System — V2 Changes

## 🐛 All Bugs Fixed

### Admin Portal
| Bug | Fix |
|-----|-----|
| "Create HOD/Staff" buttons caused logout | Now correctly navigate to `/admin/hods` and `/admin/staff` (the route `/hods/new` didn't exist) |
| Import Students used HOD endpoint | Now uses correct `/admin/students/import` endpoint |
| Staff had no Edit functionality | Full edit modal added with PATCH endpoint |
| Login page had hardcoded stats | Now fetches real stats from `/admin/public-stats` API |
| Session expiry caused silent redirect | Now shows "Your session has expired" toast before redirecting |

### HOD Portal
| Bug | Fix |
|-----|-----|
| Remove Student used `roll_no` string (ambiguous) | Now uses `student_id` integer PK — no data integrity risk |
| Assign Teacher used phone string matching | Now uses `teacher_id` directly — no parsing, no silent mismatches |
| HOD `teacher/remove` deleted teacher globally | Endpoint now only unassigns (uses `delete assignment`) |
| `distinct()` query on subjects caused bad SQL | Fixed to `query(column).distinct()` for correct DISTINCT SQL |
| `autoName()` overwrote manually typed class names | Only auto-fills if class_name field is currently empty |
| Class list only showed classes with students | Now UNION of student classes + hod_classes (empty classes visible) |

### Teacher Portal
| Bug | Fix |
|-----|-----|
| `/teacher/mark` without params = blank page crash | Redirect guard added — navigates back to `/teacher/select` immediately |
| Subject dropdown didn't reset when class changed in Report | `useEffect` on `[cls]` now resets subject correctly |
| Custom time input had no format validation | Validates `HH:MM AM/PM - HH:MM AM/PM` pattern before proceeding |
| No warning when re-marking already-marked session | Backend returns `already_marked: true`, UI shows amber banner |
| No minimum password length | Frontend + backend both enforce 6 character minimum |
| Duplicate floating Save button | Removed floating button, only inline header button remains |

### Student Portal
| Bug | Fix |
|-----|-----|
| Period filter page state stale on period switch | Always resets to page 1 when period changes (using ref) |
| Subjects with 0% shown in red for "daily" period | Backend filters out subjects with 0 records — only real data shown |
| `HodClassImport.jsx` was dead/unrouted | Removed from project (HOD imports work through class detail modal) |
| Students couldn't change their password | New `/student/change-password` endpoint + Change Password page added |

---

## ✨ New Features

### Admin
- **Analytics Dashboard** — 30-day attendance trend chart, per-class stats, teacher performance leaderboard, defaulter count
- **Holiday Calendar** — Add/remove institutional holidays (appear in student calendar)
- **Notifications** — Broadcast messages to all students / teachers / HODs / everyone
- **Timetable Manager** — Visual weekly grid to set class schedules
- **Bulk Attendance Correction** — Admin override for any class/subject/date
- **Staff Edit** — Edit name, email, phone, role, department of existing staff
- **Better PDF Export** — JSPM-branded reportlab PDFs with summary table and colour-coded rows

### HOD
- **Analytics** — 30-day trend chart + teacher performance for their classes
- **Low Attendance Alerts** — Dashboard shows students <75% in last 30 days
- **Bulk Attendance Correction** — HODs can correct attendance for their own classes
- **PDF Export** — Class-level attendance report PDF

### Teacher
- **My Performance Page** — Sessions marked per subject in last 30 days
- **PDF Export** — Branded PDF download on report page
- **Timetable View** — See own teaching schedule for the week

### Student
- **Calendar View** — Month calendar showing colour-coded attendance per day, holiday markers, click day for subject breakdown
- **Download My Report** — PDF download of own 90-day attendance
- **Notifications** — See announcements from admin; mark as read
- **Timetable** — View class schedule; today's classes highlighted
- **Change Password** — Students can now update their own password

---

## 🗄️ Database Migration

Run `backend/migrate_v2.sql` on your existing PostgreSQL database BEFORE starting the v2 server:

```bash
psql -U youruser -d yourdb -f backend/migrate_v2.sql
```

New tables added: `holidays`, `notifications`, `timetable`
New columns added: `staff.phone`, `staff.department`, `hods.email`, `hods.department`

The server's `Base.metadata.create_all()` will also create them automatically on first start.

---

## 📦 New Python Dependency

Install `reportlab` for PDF generation:

```bash
pip install reportlab
```

Or just run `pip install -r backend/requirements.txt` which includes it.
