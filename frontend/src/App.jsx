import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Public
import LoginPage from './pages/LoginPage';

// Admin
import AdminOverview from './pages/admin/AdminOverview';
import AdminHODs from './pages/admin/AdminHODs';
import AdminTeachers from './pages/admin/AdminTeachers';
import AdminClasses from './pages/admin/AdminClasses';
import AdminStudents from './pages/admin/AdminStudents';
import AdminReports from './pages/admin/AdminReports';
import AdminActivityLogs from './pages/admin/AdminActivityLogs';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminHolidays from './pages/admin/AdminHolidays';
import AdminNotifications from './pages/admin/AdminNotifications';
import AdminSubjects from './pages/admin/AdminSubjects';
import AdminDepartments from './pages/admin/AdminDepartments';
import AdminBulkCorrection from './pages/admin/AdminBulkCorrection';
import AdminSettings from './pages/admin/AdminSettings';
import AdminPassword from './pages/admin/AdminPassword';

// HOD
import HodDashboard from './pages/hod/HodDashboard';
import HodClassDetail from './pages/hod/HodClassDetail';
import HodCreateClass from './pages/hod/HodCreateClass';
import HodAnalytics from './pages/hod/HodAnalytics';
import HodSettings from './pages/hod/HodSettings';
import HodPassword from './pages/hod/HodPassword';
import HodTeachers from './pages/hod/HodTeachers';
import HodStudents from './pages/hod/HodStudents';
import HodSubjects from './pages/hod/HodSubjects';
import HodReports from './pages/hod/HodReports';

// Teacher
import TeacherSelect from './pages/teacher/TeacherSelect';
import TeacherMark from './pages/teacher/TeacherMark';
import TeacherReport from './pages/teacher/TeacherReport';
import TeacherSettings from './pages/teacher/TeacherSettings';
import TeacherPerformance from './pages/teacher/TeacherPerformance';

// Student
import StudentDashboard from './pages/student/StudentDashboard';
import StudentCalendar from './pages/student/StudentCalendar';
import StudentSettings from './pages/student/StudentSettings';
import StudentNotifications from './pages/student/StudentNotifications';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />

        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Admin */}
          <Route path="/admin" element={<ProtectedRoute role="admin"><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/admin/overview" replace />} />
            <Route path="overview" element={<AdminOverview />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="hods" element={<AdminHODs />} />
            <Route path="teachers" element={<AdminTeachers />} />
            <Route path="classes" element={<AdminClasses />} />
            <Route path="students" element={<AdminStudents />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="bulk-correction" element={<AdminBulkCorrection />} />
            <Route path="holidays" element={<AdminHolidays />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="subjects" element={<AdminSubjects />} />
            <Route path="departments" element={<AdminDepartments />} />
            <Route path="activity-logs" element={<AdminActivityLogs />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="password" element={<AdminPassword />} />
          </Route>

          {/* HOD */}
          <Route path="/hod" element={<ProtectedRoute role="hod"><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/hod/dashboard" replace />} />
            <Route path="dashboard" element={<HodDashboard />} />
            <Route path="classes/:className" element={<HodClassDetail />} />
            <Route path="create-class" element={<HodCreateClass />} />
            <Route path="teachers" element={<HodTeachers />} />
            <Route path="students" element={<HodStudents />} />
            <Route path="subjects" element={<HodSubjects />} />
            <Route path="reports" element={<HodReports />} />
            <Route path="analytics" element={<HodAnalytics />} />
            <Route path="settings" element={<HodSettings />} />
            <Route path="password" element={<HodPassword />} />
          </Route>

          {/* Teacher */}
          <Route path="/teacher" element={<ProtectedRoute role="teacher"><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/teacher/select" replace />} />
            <Route path="select" element={<TeacherSelect />} />
            <Route path="mark" element={<TeacherMark />} />
            <Route path="report" element={<TeacherReport />} />
            <Route path="performance" element={<TeacherPerformance />} />
            <Route path="settings" element={<TeacherSettings />} />
          </Route>

          {/* Student */}
          <Route path="/student" element={<ProtectedRoute role="student"><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/student/dashboard" replace />} />
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="calendar" element={<StudentCalendar />} />
            <Route path="notifications" element={<StudentNotifications />} />
            <Route path="settings" element={<StudentSettings />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
