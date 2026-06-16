import { useEffect, useState } from 'react';
import api from '../../api/client';
import { PenSquare, Save, AlertTriangle, Building2, GraduationCap, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminBulkCorrection() {
  const [departments, setDepartments] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [filteredClasses, setFilteredClasses] = useState([]);
  const [filteredSubjects, setFilteredSubjects] = useState([]);

  const [deptId, setDeptId] = useState('');
  const [cls, setCls] = useState('');
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(false);

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
  }, []);

  // When department changes → filter classes, reset class & subject
  useEffect(() => {
    if (!deptId) {
      setFilteredClasses([]);
    } else {
      const deptName = departments.find(d => String(d.dept_id) === String(deptId))?.name;
      setFilteredClasses(allClasses.filter(c =>
        String(c.dept_id) === String(deptId) || c.dept_name === deptName
      ));
    }
    setCls('');
    setSubject('');
    setFilteredSubjects([]);
    setStudents([]);
  }, [deptId, allClasses]);

  // When class changes → load subjects for that class
  useEffect(() => {
    setSubject('');
    setFilteredSubjects([]);
    setStudents([]);
    if (!cls) return;
    api.get(`/admin/classes/${encodeURIComponent(cls)}/subjects`)
      .then(r => setFilteredSubjects(r.data || []))
      .catch(() => setFilteredSubjects([]));
  }, [cls]);

  const loadStudents = async () => {
    if (!cls || !subject || !date) { toast.error('Select class, subject, and date'); return; }
    setLoading(true);
    try {
      const r = await api.get('/teacher/students', { params: { class_: cls, subject, date } });
      setStudents(r.data.students || []);
      const map = {};
      (r.data.students || []).forEach(s => { map[s.student_id] = s.status; });
      setStatuses(map);
    } catch { toast.error('Failed to load students'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    try {
      const r = await api.post('/admin/attendance/correct', { class_: cls, subject, date, statuses });
      toast.success(`Updated ${r.data.updated} records`);
    } catch { toast.error('Failed to save'); }
  };

  const allPresent = () => { const m = {}; students.forEach(s => m[s.student_id] = 'Present'); setStatuses(m); };
  const allAbsent = () => { const m = {}; students.forEach(s => m[s.student_id] = 'Absent'); setStatuses(m); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-jspm-navy">Bulk Attendance Correction</h1>
        <p className="text-gray-500 text-sm">Admin override — correct attendance for any past date</p>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-5">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">Changes here directly update the database. Only correct genuine errors.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
          {/* Department */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1 block">
              <Building2 size={11} /> Department
            </label>
            <select className="input" value={deptId} onChange={e => setDeptId(e.target.value)}>
              <option value="">Select Depts</option>
              {departments.map(d => <option key={d.dept_id} value={d.dept_id}>{d.name}</option>)}
            </select>
          </div>

          {/* Class — filtered by dept */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1 block">
              <GraduationCap size={11} /> Class
            </label>
            <select className="input" value={cls} onChange={e => { setCls(e.target.value); setStudents([]); }} disabled={!deptId}>
              <option value="">{deptId ? '— Select Class —' : 'Select Dept First'}</option>
              {filteredClasses.map(c => <option key={c.class_name} value={c.class_name}>{c.class_name}</option>)}
            </select>
          </div>

          {/* Subject — filtered by class */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1 block">
              <BookOpen size={11} /> Subject
            </label>
            <select className="input" value={subject} onChange={e => { setSubject(e.target.value); setStudents([]); }} disabled={!cls}>
              <option value="">{cls ? (filteredSubjects.length ? '— Select Subject —' : 'No subjects assigned') : 'Select Class First'}</option>
              {filteredSubjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Date</label>
            <input type="date" className="input" value={date} onChange={e => { setDate(e.target.value); setStudents([]); }} />
          </div>

          {/* Load button */}
          <div className="flex items-end">
            <button onClick={loadStudents} disabled={loading || !cls || !subject} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Loading...' : 'Load Students'}
            </button>
          </div>
        </div>

        {/* Hint when subject is empty after class selected */}
        {cls && filteredSubjects.length === 0 && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            ⚠ No subjects assigned to <strong>{cls}</strong> yet. Go to Teacher Management and assign a teacher to a subject for this class first.
          </div>
        )}

        {students.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{students.length} students — <strong>{cls}</strong> / <strong>{subject}</strong> / {date}</span>
              <div className="flex gap-2">
                <button onClick={allPresent} className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-lg font-medium hover:bg-green-200">All Present</button>
                <button onClick={allAbsent} className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200">All Absent</button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {students.map(s => (
                <div key={s.student_id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${statuses[s.student_id] === 'Present' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div>
                    <div className="font-semibold text-sm text-gray-800">{s.name}</div>
                    <div className="text-xs text-gray-500">{s.roll_no}</div>
                  </div>
                  <button
                    onClick={() => setStatuses(p => ({ ...p, [s.student_id]: p[s.student_id] === 'Present' ? 'Absent' : 'Present' }))}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${statuses[s.student_id] === 'Present' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-600 text-white hover:bg-red-700'}`}
                  >
                    {statuses[s.student_id] || 'Absent'}
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button onClick={handleSave} className="btn-primary flex items-center gap-2 px-8">
                <Save size={15} /> Save Changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
