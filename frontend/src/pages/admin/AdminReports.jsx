import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../api/client';
import Pagination from '../../components/Pagination';
import { FileDown, Search, AlertTriangle, Filter, Key, X, Building2, GraduationCap, BookOpen, Users } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminReports() {
  const [filters, setFilters] = useState({ dept_id: '', class_: '', subject: '', search: '', start: '', end: '', sort_by: 'roll_no_asc' });
  const [data, setData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [filteredClasses, setFilteredClasses] = useState([]);
  const [filteredSubjects, setFilteredSubjects] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('all');
  const [resetPassword, setResetPassword] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [teacherReport, setTeacherReport] = useState(null);

  // Load departments and classes on mount
  useEffect(() => {
    Promise.all([
      api.get('/admin/departments'),
      api.get('/admin/classes'),
    ]).then(([d, c]) => {
      setDepartments(d.data || []);
      setAllClasses(c.data || []);
      setFilteredClasses(c.data || []);
    });
    const today = new Date();
    const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 6);
    setFilters(f => ({
      ...f,
      end: today.toISOString().split('T')[0],
      start: weekAgo.toISOString().split('T')[0],
    }));
  }, []);

  // When department changes → filter classes
  // A class may belong to multiple departments via dept_ids[]; check all of them.
  useEffect(() => {
    if (!filters.dept_id) {
      setFilteredClasses([]);
    } else {
      const deptIdStr = String(filters.dept_id);
      setFilteredClasses(
        allClasses.filter(c => {
          // 1. Primary dept_id match
          if (String(c.dept_id) === deptIdStr) return true;
          // 2. Multi-department membership array (dept_ids)
          if (Array.isArray(c.dept_ids) && c.dept_ids.some(id => String(id) === deptIdStr)) return true;
          return false;
        })
      );
    }
    setFilters(f => ({ ...f, class_: '', subject: '' }));
    setFilteredSubjects([]);
  }, [filters.dept_id, allClasses]);

  // When class changes → load subjects for that class
  useEffect(() => {
    if (!filters.class_) {
      setFilteredSubjects([]);
      setFilters(f => ({ ...f, subject: '' }));
      return;
    }
    api.get(`/admin/classes/${encodeURIComponent(filters.class_)}/subjects`)
      .then(r => {
        setFilteredSubjects(r.data || []);
        setFilters(f => ({ ...f, subject: '' }));
      })
      .catch(() => setFilteredSubjects([]));
  }, [filters.class_]);

  // Fetch report data
  useEffect(() => {
    if (!filters.start || !filters.end) return;
    setLoading(true);
    
    if (tab === 'teachers') {
      const params = { start: filters.start, end: filters.end, dept_id: filters.dept_id };
      api.get('/admin/reports/teachers', { params })
        .then(r => setTeacherReport(r.data.report || []))
        .finally(() => setLoading(false));
    } else {
      const params = { ...filters, page, limit: 20 };
      api.get('/admin/reports', { params })
        .then(r => setData(r.data))
        .finally(() => setLoading(false));
    }
  }, [filters, page, tab]);

  const exportFile = async (format) => {
    try {
      const params = { ...filters, type: tab };
      const res = await api.get(`/admin/export/${format}`, { params, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_report_${tab}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error('Password must be at least 6 characters');
    try {
      await api.post(`/admin/students/${resetPassword.student_id}/reset-password`, { new_password: newPassword });
      toast.success(`Password updated for ${resetPassword.name}`);
      setResetPassword(null); setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update password');
    }
  };

  const setFilter = (key, val) => {
    setFilters(f => ({ ...f, [key]: val }));
    setPage(1);
  };

  const rows = tab === 'defaulters' ? (data?.defaulters || []) : (data?.report || []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-jspm-blue font-bold">Attendance Reports</h1>
          <p className="text-gray-500 text-sm mt-1">View all students' attendance across departments and classes</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportFile('csv')} className="btn-secondary text-sm flex items-center gap-2">
            <FileDown size={15} /> Excel (CSV)
          </button>
          <button onClick={() => exportFile('pdf')} className="btn-primary text-sm flex items-center gap-2">
            <FileDown size={15} /> PDF
          </button>
        </div>
      </div>

      {data?.defaulters?.length > 0 && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-amber-700 text-sm font-medium">
            {data.defaulters.length} student{data.defaulters.length > 1 ? 's' : ''} below 75% attendance
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-gray-700">
          <Filter size={15} /> Filters
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Department */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><Building2 size={11} /> Department</label>
            <select className="input text-sm" value={filters.dept_id}
              onChange={e => setFilter('dept_id', e.target.value)}>
              <option value="">Select Depts</option>
              {departments.map(d => <option key={d.dept_id} value={d.dept_id}>{d.name}</option>)}
            </select>
          </div>
          {/* Class — filtered by dept */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><GraduationCap size={11} /> Class</label>
            <select className="input text-sm" value={filters.class_}
              onChange={e => setFilter('class_', e.target.value)}
              disabled={!filters.dept_id}>
              <option value="">{filters.dept_id ? 'All Classes' : 'Select Dept First'}</option>
              {filteredClasses.map(c => <option key={c.class_name} value={c.class_name}>{c.class_name}</option>)}
            </select>
          </div>
          {/* Subject — filtered by class */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><BookOpen size={11} /> Subject</label>
            <select className="input text-sm" value={filters.subject}
              onChange={e => setFilter('subject', e.target.value)}
              disabled={!filters.class_}>
              <option value="">{filters.class_ ? 'All Subjects' : 'Select Class First'}</option>
              {filteredSubjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {/* Date range */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" className="input text-sm" value={filters.start}
              onChange={e => setFilter('start', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" className="input text-sm" value={filters.end}
              onChange={e => setFilter('end', e.target.value)} />
          </div>
          {/* Sort */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">Sort By</label>
            <select className="input text-sm" value={filters.sort_by}
              onChange={e => setFilter('sort_by', e.target.value)}>
              <option value="roll_no_asc">Roll No (A-Z)</option>
              <option value="roll_no_desc">Roll No (Z-A)</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
              <option value="percent_asc">Attendance (Lowest First)</option>
              <option value="percent_desc">Attendance (Highest First)</option>
            </select>
          </div>
          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input text-sm pl-8" placeholder="Name or roll no..." value={filters.search}
                onChange={e => setFilter('search', e.target.value)} />
            </div>
          </div>
        </div>
        {/* Active filter chips */}
        {(filters.dept_id || filters.class_ || filters.subject) && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {filters.dept_id && (
              <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-1 rounded-full font-semibold flex items-center gap-1">
                {departments.find(d => String(d.dept_id) === String(filters.dept_id))?.name}
                <button onClick={() => setFilter('dept_id', '')}><X size={10} /></button>
              </span>
            )}
            {filters.class_ && (
              <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-1 rounded-full font-semibold flex items-center gap-1">
                {filters.class_}
                <button onClick={() => setFilter('class_', '')}><X size={10} /></button>
              </span>
            )}
            {filters.subject && (
              <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-1 rounded-full font-semibold flex items-center gap-1">
                {filters.subject}
                <button onClick={() => setFilter('subject', '')}><X size={10} /></button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { id: 'all', label: 'All Students' },
          { id: 'defaulters', label: `⚠ Defaulters (${data?.defaulters?.length || 0})` },
          { id: 'teachers', label: 'Teacher Sessions' }
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-jspm-blue text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-jspm-blue border-t-transparent rounded-full animate-spin" /></div>
        ) : tab === 'teachers' ? (
          teacherReport?.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users size={32} className="mx-auto mb-3 opacity-30" />
              <p>No teacher activity found for this period</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Teacher Name', 'Department', 'Phone', 'Sessions Marked', 'Last Activity'].map(h => (
                    <th key={h} className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {teacherReport?.map((t, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                          {t.name[0]}
                        </div>
                        <span className="font-bold text-gray-900">{t.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-semibold text-jspm-blue bg-blue-50 px-2 py-1 rounded-md">{t.dept_name}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 font-medium">{t.phone}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-black text-jspm-navy">{t.sessions_count}</div>
                        <span className="text-[10px] uppercase font-bold text-gray-400">Marked</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-gray-900 font-semibold">{t.last_marked || 'Never'}</span>
                        {t.last_marked && <span className="text-[10px] text-gray-400">Latest entry</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <GraduationCap size={32} className="mx-auto mb-3 opacity-30" />
            <p>No data found for selected filters</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Roll No', 'Name', 'Class', 'Total', 'Attended', '%', 'Status', 'Creator', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${r.percent < 75 ? 'bg-red-50/40' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.roll_no}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{r.name}</td>
                  <td className="px-4 py-3 text-gray-500">{r.class_}</td>
                  <td className="px-4 py-3 text-center">{r.total}</td>
                  <td className="px-4 py-3 text-center">{r.attended}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold ${r.percent >= 75 ? 'text-emerald-600' : 'text-red-600'}`}>{r.percent.toFixed(1)}%</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${r.percent >= 75 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {r.percent >= 75 ? 'Regular' : 'Defaulter'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-[10px] text-gray-400 font-bold">{r.created_by_name || 'Admin'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setResetPassword(r)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Reset Password">
                      <Key size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && tab !== 'teachers' && data.total_pages > 1 && (
        <div className="mt-4">
          <Pagination page={page} totalPages={data.total_pages} onPageChange={setPage} />
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPassword && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-jspm-navy">Reset Password — {resetPassword.name}</h3>
              <button onClick={() => { setResetPassword(null); setNewPassword(''); }}><X size={20} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <input type="password" className="input" placeholder="New password (min 6 chars)" value={newPassword}
                onChange={e => setNewPassword(e.target.value)} minLength={6} required />
              <button type="submit" className="btn-primary w-full">Update Password</button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
