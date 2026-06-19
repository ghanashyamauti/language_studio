import { useState, useEffect } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import {
  Calendar, UserCheck, UserMinus, Search,
  RefreshCw, BookOpen, Users, Clock, Camera
} from 'lucide-react';

export default function HodStaffAttendance() {
  const [activeTab, setActiveTab] = useState('staff'); // 'staff' | 'lectures'

  // ── Staff Attendance state ─────────────────────────────────────────────────
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // ── Teacher Lectures state ─────────────────────────────────────────────────
  const [lectures, setLectures] = useState([]);
  const [lecturesLoading, setLecturesLoading] = useState(false);
  const [lectureSearch, setLectureSearch] = useState('');

  // ── Fetch ──────────────────────────────────────────────────────────────────
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

  // ── Derived values ─────────────────────────────────────────────────────────
  const stats = {
    total:   records.length,
    present: records.filter(r => r.status === 'Present').length,
    leave:   records.filter(r => r.status === 'On Leave').length,
    absent:  records.filter(r => r.status === 'Absent').length,
  };

  const totalLecturesToday = lectures.reduce((a, t) => a + t.lecture_count, 0);

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

  // ── UI helpers ─────────────────────────────────────────────────────────────
  const StatusBadge = ({ status }) => {
    const map = {
      Present:    'bg-green-50 text-green-700 border-green-100',
      Absent:     'bg-red-50 text-red-600 border-red-100',
      'On Leave': 'bg-amber-50 text-amber-700 border-amber-100',
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

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-jspm-navy">Staff Attendance & Lectures</h1>
          <p className="text-gray-500 text-sm">
            View daily staff attendance and monitor teacher lecture activity
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

      {/* ── Summary Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Staff',       value: stats.total,        icon: Users,     bg: 'bg-blue-50',    text: 'text-blue-600'    },
          { label: 'Present',           value: stats.present,      icon: UserCheck, bg: 'bg-emerald-50', text: 'text-emerald-600' },
          { label: 'On Leave',          value: stats.leave,        icon: Calendar,  bg: 'bg-amber-50',   text: 'text-amber-600'   },
          { label: 'Absent',            value: stats.absent,       icon: UserMinus, bg: 'bg-rose-50',    text: 'text-rose-600'    },
          { label: 'Lectures Today',    value: totalLecturesToday, icon: BookOpen,  bg: 'bg-indigo-50',  text: 'text-indigo-600'  },
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

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        {[
          { id: 'staff',    label: 'Staff Attendance', icon: UserCheck },
          { id: 'lectures', label: "Teacher Lectures",  icon: BookOpen  },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === t.id
                ? 'bg-purple-700 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <t.icon size={14} />
            {t.label}
            {t.id === 'lectures' && lectures.length > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === t.id ? 'bg-white/20 text-white' : 'bg-purple-50 text-purple-600'
              }`}>
                {lectures.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Staff Attendance Tab ────────────────────────────────────────────── */}
      {activeTab === 'staff' && (
        <>
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

          <div className="card overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-500">
                <RefreshCw className="animate-spin text-purple-500" size={24} />
                <span>Loading records for {date}…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-14 gap-3 text-gray-400">
                <Users size={36} className="opacity-25" />
                <p>No staff records match your filters.</p>
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
                      <th className="pb-3 px-4">Face</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-gray-50">
                    {filtered.map(staff => {
                      const key = `${staff.role}_${staff.user_id}`;
                      return (
                        <tr key={key} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                {staff.name?.[0]?.toUpperCase()}
                              </div>
                              <span className="font-semibold text-slate-800">{staff.name}</span>
                            </div>
                          </td>
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
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100">
                                <Camera size={10} /> Registered
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
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
      )}

      {/* ── Teacher Lectures Tab ────────────────────────────────────────────── */}
      {activeTab === 'lectures' && (
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
            <div className="text-sm text-gray-500 font-medium bg-white border border-gray-100 rounded-xl px-4 py-2">
              <span className="font-bold text-jspm-navy">{filteredLectures.reduce((a, t) => a + t.lecture_count, 0)}</span> total lecture slots on{' '}
              <span className="font-semibold">{date}</span>
            </div>
          </div>

          <div className="card overflow-hidden">
            {lecturesLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-500">
                <RefreshCw className="animate-spin text-purple-500" size={24} />
                <span>Loading lecture data…</span>
              </div>
            ) : filteredLectures.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-gray-400 gap-3">
                <BookOpen size={36} className="opacity-25" />
                <p className="font-medium">No lectures recorded for {date}</p>
                <p className="text-xs text-gray-300">Teachers who mark attendance will appear here</p>
              </div>
            ) : (
              <div className="space-y-0 divide-y divide-gray-50">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_140px_90px_1fr] gap-4 px-6 pb-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <span>Teacher</span>
                  <span>Department</span>
                  <span className="text-center">Lectures</span>
                  <span>Slots Covered</span>
                </div>

                {filteredLectures.map((t, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_140px_90px_1fr] gap-4 px-6 py-4 items-start hover:bg-slate-50/60 transition-colors"
                  >
                    {/* Teacher */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 text-purple-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {t.name[0]}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">{t.name}</div>
                        {t.phone && <div className="text-xs text-slate-400">{t.phone}</div>}
                      </div>
                    </div>

                    {/* Department */}
                    <div className="flex items-center">
                      <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-1 rounded-md">
                        {t.department}
                      </span>
                    </div>

                    {/* Lecture count */}
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-jspm-navy leading-none">{t.lecture_count}</span>
                      <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mt-0.5">
                        {t.lecture_count === 1 ? 'Slot' : 'Slots'}
                      </span>
                    </div>

                    {/* Slots */}
                    <div className="flex flex-wrap gap-1.5 items-start">
                      {t.slots.map((s, j) => (
                        <span
                          key={j}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-100 rounded-lg text-xs font-medium text-slate-700 shadow-sm hover:border-purple-200 hover:bg-purple-50 transition-colors"
                        >
                          <span className="font-bold text-purple-700">{s.class_}</span>
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
