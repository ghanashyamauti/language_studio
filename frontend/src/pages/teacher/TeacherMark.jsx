import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { Save, ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TeacherMark() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const cls = params.get('class');
  const subject = params.get('subject');
  const date = params.get('date') || new Date().toISOString().slice(0, 10);
  const time = params.get('time') || '';

  const [students, setStudents] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alreadyMarked, setAlreadyMarked] = useState(false);

  // FIX: guard — redirect if params missing
  useEffect(() => {
    if (!cls || !subject) {
      toast.error('No class or subject selected');
      navigate('/teacher/select', { replace: true });
      return;
    }
    api.get('/teacher/students', { params: { class_: cls, subject, date } })
      .then(r => {
        setStudents(r.data.students || []);
        setAlreadyMarked(r.data.already_marked || false);
        const map = {};
        (r.data.students || []).forEach(s => { map[s.student_id] = s.status; });
        setStatuses(map);
      })
      .catch(() => toast.error('Failed to load students'))
      .finally(() => setLoading(false));
  }, [cls, subject, date]);

  const toggle = (id) => setStatuses(p => ({ ...p, [id]: p[id] === 'Present' ? 'Absent' : 'Present' }));
  const allPresent = () => { const m = {}; students.forEach(s => m[s.student_id] = 'Present'); setStatuses(m); };
  const allAbsent = () => { const m = {}; students.forEach(s => m[s.student_id] = 'Absent'); setStatuses(m); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/teacher/mark', { class_: cls, subject, date, time, statuses });
      toast.success(alreadyMarked ? 'Attendance updated!' : 'Attendance saved!');
      navigate('/teacher/select');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const presentCount = Object.values(statuses).filter(s => s === 'Present').length;
  const absentCount = students.length - presentCount;

  if (loading) return <div className="flex justify-center items-center h-64"><div className="w-8 h-8 border-4 border-jspm-blue border-t-transparent rounded-full animate-spin"/></div>;

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/teacher/select')} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={18}/></button>
        <div>
          <h1 className="text-xl font-bold text-jspm-navy">{cls} — {subject}</h1>
          <p className="text-gray-500 text-sm">{date} {time && `· ${time}`}</p>
        </div>
      </div>

      {/* FIX: already marked banner */}
      {alreadyMarked && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0"/>
          <p className="text-sm text-amber-800 font-medium">Attendance already marked for this session. You are editing an existing record.</p>
        </div>
      )}

      {/* Stats + actions */}
      <div className="card p-4 flex items-center justify-between flex-wrap gap-4">
        <div className="flex gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{presentCount}</div>
            <div className="text-xs text-gray-500">Present</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-500">{absentCount}</div>
            <div className="text-xs text-gray-500">Absent</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-jspm-navy">{students.length}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={allPresent} className="text-sm px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium hover:bg-green-200">All Present</button>
          <button onClick={allAbsent} className="text-sm px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200">All Absent</button>
          {/* FIX: save button inline, not fixed floating */}
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            <Save size={16}/> {saving ? 'Saving...' : alreadyMarked ? 'Update' : 'Save Attendance'}
          </button>
        </div>
      </div>

      {/* Student grid */}
      {students.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">No students found for this class.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {students.map(s => {
            const present = statuses[s.student_id] === 'Present';
            return (
              <div
                key={s.student_id}
                onClick={() => toggle(s.student_id)}
                className={`card cursor-pointer p-4 text-center transition-all hover:scale-105 active:scale-95 border-2 ${present ? 'border-green-400 bg-green-50' : 'border-red-300 bg-red-50'}`}
              >
                <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-lg font-bold ${present ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-700'}`}>
                  {s.roll_no?.slice(-2)}
                </div>
                <div className="text-xs font-semibold text-jspm-navy truncate">{s.roll_no}</div>
                <div className="text-xs text-gray-500 truncate">{s.name}</div>
                <span className={`text-xs font-bold mt-1 inline-block ${present ? 'text-green-600' : 'text-red-500'}`}>
                  {present ? 'P' : 'A'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
