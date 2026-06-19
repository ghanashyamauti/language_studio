import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import toast from 'react-hot-toast';
import { Lock, User, ChevronDown, Eye, EyeOff } from 'lucide-react';

const ROLES = [
  { value: 'admin', label: 'Admin', color: 'bg-indigo-600 text-white' },
  { value: 'hod', label: 'Manager', color: 'bg-purple-600 text-white' },
  { value: 'teacher', label: 'Teacher', color: 'bg-emerald-600 text-white' },
  { value: 'student', label: 'Student', color: 'bg-rose-600 text-white' },
];

const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads/')) {
    const base = api.defaults.baseURL || '';
    return `${base}${url}`;
  }
  return url;
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [role, setRole] = useState('student');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    api.get('/admin/public-stats').then(r => setStats(r.data)).catch(() => { });
    api.get('/admin/public-settings').then(r => setSettings(r.data)).catch(() => { });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) { toast.error('Enter username and password'); return; }
    setLoading(true);
    try {
      const result = await login(role, username.trim(), password);
      if (result.success) {
        const routes = { admin: '/admin/overview', hod: '/hod/dashboard', teacher: '/teacher/select', student: '/student/dashboard' };
        navigate(routes[role] || '/login');
      } else {
        toast.error(result.error || 'Invalid credentials');
      }
    } finally { setLoading(false); }
  };

  const placeholders = {
    admin: 'Email address',
    hod: 'Mobile number or Email',
    teacher: 'Mobile number or Email',
    student: 'Roll number',
  };

  const activeRole = ROLES.find(r => r.value === role);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-slate-50">
      {/* Background Cover Image */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img src="/login-bg.png?v=2" alt="" className="w-full h-full object-cover" />
      </div>
      {/* Subtle overlay */}
      <div className="absolute inset-0 bg-slate-900/10 z-0 pointer-events-none" />

      <div className="relative z-10 w-full max-w-xl flex flex-col items-center">
        {/* Header / Logo */}
        <div className="flex flex-col items-center mb-5">
          <div className="bg-white p-1.5 rounded-xl shadow-xl mb-3">
            {settings?.logo_url ? (
              <img src={getImageUrl(settings.logo_url)} alt="Logo" className="h-14 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              <img src="/lcs-logo.png" alt="LCS Logo" className="h-14 object-contain" />
            )}
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 text-center tracking-wide drop-shadow-md">
            Language Craft Studio<br />
            <span className="text-slate-700 text-base md:text-lg font-semibold">{"Attendance Management System"}</span>
          </h1>
        </div>

        {/* Login Form Container */}
        <div className="w-full bg-slate-950/85 hover:bg-slate-950/95 backdrop-blur-md transition-all duration-500 ease-in-out rounded-2xl p-4 md:p-6 shadow-2xl border border-white/10">
          <h2 className="text-lg md:text-xl font-bold text-white mb-4">Sign in here</h2>

          {/* Role selector */}
          <div className="grid grid-cols-4 gap-2 mb-5">
            {ROLES.map(r => (
              <button key={r.value} onClick={() => setRole(r.value)}
                className={`py-1.5 px-0.5 md:px-2 rounded-lg text-[10px] md:text-xs font-semibold transition-all ${role === r.value ? r.color + ' shadow-lg scale-105' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
                {r.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <input
                  type={role === 'admin' ? 'email' : 'text'}
                  className="w-full bg-white text-gray-900 placeholder-gray-500 rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
                  placeholder={placeholders[role]}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="flex-1 relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full bg-white text-gray-900 placeholder-gray-500 rounded-lg py-2.5 pl-3 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-700 transition-colors focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {role === 'student' && (
              <p className="text-xs text-gray-300">Default password: <span className="font-mono bg-black/40 px-1.5 py-0.5 rounded">Test@123</span></p>
            )}

            <button type="submit" disabled={loading}
              className={`w-full py-3 mt-1 rounded-lg font-bold text-white text-base transition-all shadow-xl ${loading ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.01] active:scale-100'} ${activeRole?.color || 'bg-red-500'}`}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="flex justify-center mt-5 text-[11px] text-gray-400">
            {role === 'student' && (
              <button 
                type="button"
                onClick={() => toast.error('Please contact your Class Teacher or Manager to reset your password.', { icon: '🔑', duration: 4000 })}
                className="hover:text-white transition-colors underline decoration-white/20"
              >
                Forgot password?
              </button>
            )}
          </div>
        </div>

        <p className="mt-5 text-slate-700 text-[10px] font-medium">© {new Date().getFullYear()} Language Craft Studio.</p>
      </div>
    </div>
  );
}
