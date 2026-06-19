import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../api/client';
import toast from 'react-hot-toast';
import {
  Camera, Calendar, UserCheck, UserMinus, Search,
  RefreshCw, Trash2, ShieldOff, BookOpen, Users, Clock
} from 'lucide-react';

export default function AdminStaffAttendance() {
  const [activeTab, setActiveTab] = useState('staff'); // 'staff' | 'lectures'

  // ── Staff Attendance state ──────────────────────────────────────────────────
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [actionLoading, setActionLoading] = useState(null);
  const [faceLoading, setFaceLoading] = useState(null);
  const [confirmFace, setConfirmFace] = useState(null);

  // ── Teacher Lectures state ──────────────────────────────────────────────────
  const [lectures, setLectures] = useState([]);
  const [lecturesLoading, setLecturesLoading] = useState(false);
  const [lectureSearch, setLectureSearch] = useState('');

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/staff-attendance', { params: { date } });
      setRecords(res.data.records || []);
    } catch {
      toast.error('Failed to load staff attendance records');
    } finally {
      setLoading(false);
    }
  };

  const fetchLectures = async () => {
    setLecturesLoading(true);
    try {
      const res = await api.get('/admin/teacher-daily-lectures', { params: { date } });
      setLectures(res.data.data || []);
    } catch {
      toast.error('Failed to load lecture data');
    } finally {
      setLecturesLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
    fetchLectures();
  }, [date]);

  // ── Attendance toggle ───────────────────────────────────────────────────────
  const handleToggleAttendance = async (staff, targetStatus) => {
    const key = `${staff.role}_${staff.user_id}`;
    setActionLoading(key);
    try {
      await api.post('/admin/staff-attendance/mark', {
        role: staff.role,
        user_id: staff.user_id,
        date,
        status: targetStatus,
      });
      toast.success(`Marked ${staff.name} as ${targetStatus}`);
      fetchAttendance();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update attendance');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Face removal ────────────────────────────────────────────────────────────
  const handleRemoveFace = async () => {
    if (!confirmFace) return;
    const key = `face_${confirmFace.role}_${confirmFace.user_id}`;
    setFaceLoading(key);
    setConfirmFace(null);
    try {
      await api.delete(`/admin/staff-face/${confirmFace.role}/${confirmFace.user_id}`);
      toast.success(`Face data removed for ${confirmFace.name}`);
      fetchAttendance();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove face data');
    } finally {
      setFaceLoading(null);
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = {
    total:    records.length,
    present:  records.filter(r => r.status === 'Present').length,
    leave:    records.filter(r => r.status === 'On Leave').length,
    absent:   records.filter(r => r.status === 'Absent').length,
    faceReg:  records.filter(r => r.face_registered).length,
  };

  const filtered = records.filter(r => {
    const matchSearch = r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        r.department?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole   = roleFilter   ? r.role   === roleFilter   : true;
    const matchStatus = statusFilter ? r.status  === statusFilter : true;
    return matchSearch && matchRole && matchStatus;
  });

  const filteredLectures = lectures.filter(t =>
    t.name?.toLowerCase().includes(lectureSearch.toLowerCase()) ||
    t.department?.toLowerCase().includes(lectureSearch.toLowerCase())
  );

  // ── UI helpers ──────────────────────────────────────────────────────────────
  const StatusBadge = ({ status }) => {
    const map = {
      Present:   'bg-green-50 text-green-700 border-green-100',
      Absent:    'bg-red-50 text-red-600 border-red-100',
      'On Leave':'bg-amber-50 text-amber-700 border-amber-100',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${map[status] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>
        {status}
      </span>
    );
  };

  const verifiedLabel = v => {
    if (v === 'face_detection') return 'Camera Verified';
    if (v === 'admin_override') return 'Admin Override';
    if (v === 'approved_leave') return 'On Approved Leave';
    return '—';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-jspm-navy">Staff Attendance & Teacher Lectures</h1>
          <p className="text-gray-500 text-sm">
            Monitor daily check-ins, override attendance, manage face data, and track lecture slots
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-gray-400" />
          <input
            type="date"
            className="input py-2 w-44 font-semibold text-slate-700"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Staff',     value: stats.total,   icon: RefreshCw, bg: 'bg-blue-50',    text: 'text-blue-600'   },
          { label: 'Present',         value: stats.present, icon: UserCheck,  bg: 'bg-emerald-50', text: 'text-emerald-600'},
          { label: 'On Leave',        value: stats.leave,   icon: Calendar,   bg: 'bg-amber-50',   text: 'text-amber-600'  },
          { label: 'Absent',          value: stats.absent,  icon: UserMinus,  bg: 'bg-rose-50',    text: 'text-rose-600'   },
          { label: 'Face Registered', value: stats.faceReg, icon: Camera,     bg: 'bg-purple-50',  text: 'text-purple-600' },
        ].map(({ label, value, icon: Icon, bg, text }) => (
          <div key={label} className="card flex items-center gap-4">
            <div className={`p-3 ${bg} ${text} rounded-xl`}>
              <Icon size={20} />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-500">{label}</div>
              <div className="text-xl font-bold text-slate-800">{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'staff',    label: 'Staff Attendance',  icon: UserCheck },
          { id: 'lectures', label: "Teacher Lectures",  icon: BookOpen  },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === t.id
                ? 'bg-jspm-navy text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <t.icon size={14} />
            {t.label}
            {t.id === 'lectures' && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === t.id ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'
              }`}>
                {lectures.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'staff' ? (
        <>
          {/* Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search by name or department…"
                className="input pl-9"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select className="input w-40" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                <option value="">All Roles</option>
                <option value="hod">Manager (HOD)</option>
                <option value="teacher">Teacher</option>
              </select>
              <select className="input w-44" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
                <option value="On Leave">On Leave</option>
              </select>
            </div>
          </div>

          {/* Staff Table */}
          <div className="card overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-500">
                <RefreshCw className="animate-spin text-blue-500" size={24} />
                <span>Loading records for {date}…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-14 text-gray-400">
                No staff records match your current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      <th className="pb-3 pr-4">Staff Member</th>
                      <th className="pb-3 px-4">Role</th>
                      <th className="pb-3 px-4">Department</th>
                      <th className="pb-3 px-4">Status</th>
                      <th className="pb-3 px-4">Check-in</th>
                      <th className="pb-3 px-4">Verified by</th>
                      <th className="pb-3 px-4">Face Data</th>
                      <th className="pb-3 pl-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-gray-50">
                    {filtered.map(staff => {
                      const key     = `${staff.role}_${staff.user_id}`;
                      const faceKey = `face_${staff.role}_${staff.user_id}`;
                      const isUpdating = actionLoading === key;
                      const isRemoving = faceLoading   === faceKey;

                      return (
                        <tr key={key} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 pr-4 font-semibold text-slate-800">{staff.name}</td>
                          <td className="py-3.5 px-4">
                            {staff.role === 'hod' ? (
                              <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-semibold bg-purple-100 text-purple-700">
                                Manager (HOD)
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-700">
                                Teacher
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">{staff.department}</td>
                          <td className="py-3.5 px-4"><StatusBadge status={staff.status} /></td>
                          <td className="py-3.5 px-4 text-slate-600 font-medium">{staff.check_in_time || '—'}</td>
                          <td className="py-3.5 px-4 text-slate-500 text-xs">{verifiedLabel(staff.verified_by)}</td>
                          <td className="py-3.5 px-4">
                            {staff.face_registered ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100">
                                  <Camera size={10} /> Registered
                                </span>
                                <button
                                  disabled={isRemoving}
                                  onClick={() => setConfirmFace(staff)}
                                  className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-all disabled:opacity-40"
                                  title="Remove registered face"
                                >
                                  {isRemoving
                                    ? <RefreshCw size={13} className="animate-spin" />
                                    : <Trash2 size={13} />}
                                </button>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-400 border border-slate-100">
                                <ShieldOff size={10} /> Not Registered
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 pl-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                disabled={isUpdating || staff.status === 'Present'}
                                onClick={() => handleToggleAttendance(staff, 'Present')}
                                className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 rounded-lg text-xs font-semibold transition-all"
                              >
                                Mark Present
                              </button>
                              <button
                                disabled={isUpdating || staff.status === 'Absent'}
                                onClick={() => handleToggleAttendance(staff, 'Absent')}
                                className="px-2.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-40 rounded-lg text-xs font-semibold transition-all"
                              >
                                Mark Absent
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* ── Teacher Lectures Tab ───────────────────────────────────────────── */
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search teacher or department…"
                className="input pl-9"
                value={lectureSearch}
                onChange={e => setLectureSearch(e.target.value)}
              />
            </div>
            <div className="text-sm text-gray-500 font-medium">
              {filteredLectures.reduce((a, t) => a + t.lecture_count, 0)} total slots on {date}
            </div>
          </div>

          <div className="card overflow-hidden">
            {lecturesLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-500">
                <RefreshCw className="animate-spin text-blue-500" size={24} />
                <span>Loading lecture data…</span>
              </div>
            ) : filteredLectures.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-gray-400 gap-3">
                <BookOpen size={36} className="opacity-25" />
                <p className="font-medium">No lectures recorded for {date}</p>
                <p className="text-xs text-gray-300">Teachers who mark attendance will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      <th className="pb-3 pr-4">Teacher</th>
                      <th className="pb-3 px-4">Department</th>
                      <th className="pb-3 px-4 text-center">Lectures Today</th>
                      <th className="pb-3 px-4">Slots Covered</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-gray-50">
                    {filteredLectures.map((t, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        {/* Teacher name */}
                        <td className="py-3.5 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                              {t.name[0]}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800">{t.name}</div>
                              {t.phone && <div className="text-xs text-slate-400">{t.phone}</div>}
                            </div>
                          </div>
                        </td>

                        {/* Department */}
                        <td className="py-3.5 px-4">
                          <span className="text-xs font-semibold text-jspm-blue bg-blue-50 px-2 py-1 rounded-md">
                            {t.department}
                          </span>
                        </td>

                        {/* Count */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className="text-2xl font-black text-jspm-navy leading-none">{t.lecture_count}</span>
                            <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mt-0.5">
                              {t.lecture_count === 1 ? 'Lecture' : 'Lectures'}
                            </span>
                          </div>
                        </td>

                        {/* Slot pills */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1.5">
                            {t.slots.map((s, j) => (
                              <span
                                key={j}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-lg text-xs font-medium text-slate-700 hover:border-blue-200 hover:bg-blue-50 transition-colors"
                              >
                                <span className="font-bold text-jspm-blue">{s.class_}</span>
                                <span className="text-slate-300">·</span>
                                <span>{s.subject}</span>
                                {s.time && (
                                  <>
                                    <span className="text-slate-300">·</span>
                                    <span className="flex items-center gap-0.5 text-slate-400">
                                      <Clock size={9} />{s.time}
                                    </span>
                                  </>
                                )}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Confirm Face Removal Modal ──────────────────────────────────────── */}
      {confirmFace && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <Trash2 className="text-red-600" size={22} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Remove Face Data</h3>
            </div>

            <p className="text-slate-600 text-sm mb-1">
              You are about to permanently remove the registered face data for:
            </p>
            <div className="bg-slate-50 rounded-xl px-4 py-3 mb-4">
              <div className="font-bold text-slate-800">{confirmFace.name}</div>
              <div className="text-xs text-slate-500 capitalize mt-0.5">{confirmFace.role} · {confirmFace.department}</div>
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-5">
              ⚠ After removal, this staff member will need to re-register their face before they can mark face attendance again.
            </p>

            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmFace(null)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleRemoveFace} className="btn-danger">
                <Trash2 size={14} /> Remove Face Data
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
