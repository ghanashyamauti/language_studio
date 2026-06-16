import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, BookOpen, ClipboardList, LogOut, Upload, Layers,
  FileText, Activity, ChevronRight, BarChart2, Bell, Calendar, GraduationCap,
  Settings, Shield, UserPlus, PenSquare, TrendingUp, Clock, Lock, Home, Menu, X
} from 'lucide-react';

const navConfig = {
  admin: [
    { to: '/admin/overview', icon: Home, label: 'Overview' },
    { to: '/admin/analytics', icon: BarChart2, label: 'Analytics' },
    { to: '/admin/hods', icon: Users, label: 'Managers' },
    { to: '/admin/teachers', icon: Shield, label: 'Teachers' },
    { to: '/admin/classes', icon: GraduationCap, label: 'Classes' },
    { to: '/admin/students', icon: Users, label: 'Students' },
    { to: '/admin/departments', icon: Layers, label: 'Departments' },
    { to: '/admin/subjects', icon: BookOpen, label: 'Subjects' },
    { to: '/admin/reports', icon: ClipboardList, label: 'Reports' },
    { to: '/admin/bulk-correction', icon: PenSquare, label: 'Bulk Correction' },
    { to: '/admin/holidays', icon: Calendar, label: 'Holidays' },
    { to: '/admin/notifications', icon: Bell, label: 'Notifications' },
    { to: '/admin/activity-logs', icon: Activity, label: 'Activity Logs' },
    { to: '/admin/settings', icon: Settings, label: 'Settings' },
  ],
  hod: [
    { to: '/hod/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/hod/analytics', icon: TrendingUp, label: 'Analytics' },
    { to: '/hod/teachers', icon: Shield, label: 'Teachers' },
    { to: '/hod/students', icon: GraduationCap, label: 'Students' },
    { to: '/hod/subjects', icon: BookOpen, label: 'Subjects' },
    { to: '/hod/reports', icon: ClipboardList, label: 'Reports' },
    { to: '/hod/settings', icon: Settings, label: 'Settings' },
  ],
  teacher: [
    { to: '/teacher/select', icon: PenSquare, label: 'Mark Attendance' },
    { to: '/teacher/report', icon: FileText, label: 'Report' },
    { to: '/teacher/performance', icon: TrendingUp, label: 'My Performance' },
    { to: '/teacher/change-password', icon: Lock, label: 'Change Password' },
  ],
  student: [
    { to: '/student/dashboard', icon: LayoutDashboard, label: 'My Attendance' },
    { to: '/student/calendar', icon: Calendar, label: 'Calendar' },
    { to: '/student/notifications', icon: Bell, label: 'Notifications' },
    { to: '/student/change-password', icon: Lock, label: 'Change Password' },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const role = user?.role || 'student';
  const links = navConfig[role] || [];

  // Close sidebar on route change
  const location = useLocation();
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleColors = {
    admin: 'from-jspm-navy to-jspm-blue',
    hod: 'from-purple-900 to-purple-700',
    teacher: 'from-emerald-900 to-emerald-700',
    student: 'from-jspm-navy to-jspm-blue',
  };

  return (
    <div className="flex h-screen bg-jspm-bg overflow-hidden relative">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:relative z-50 h-full w-64 bg-gradient-to-b ${roleColors[role]} text-white flex flex-col shadow-2xl transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src="/lcs-logo.png" alt="LCS" className="w-10 h-10 rounded-lg object-contain bg-white/10 p-1" />
            <div>
              <div className="text-white font-bold text-sm leading-tight">The Language Studio</div>
              <div className="text-white/50 text-xs capitalize">{role === 'hod' ? 'Manager' : role} Portal</div>
            </div>
          </div>
          <button className="md:hidden text-white/70" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* User info */}
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <div className="text-white text-xs font-semibold truncate max-w-[130px]">{user?.name}</div>
              <div className="text-white/40 text-xs capitalize">{role}</div>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group
                ${isActive
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-white/65 hover:bg-white/10 hover:text-white'}`
              }
            >
              <Icon size={16} className="flex-shrink-0" />
              <span className="flex-1">{label}</span>
              <ChevronRight size={12} className="opacity-0 group-hover:opacity-60 transition-opacity" />
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-white/65 hover:bg-red-500/20 hover:text-red-300 transition-all text-sm font-medium"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top Header for mobile toggle */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500 font-medium">
              <span>The Language Studio Attendance</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-jspm-bg">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
