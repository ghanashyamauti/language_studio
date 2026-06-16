import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { ArrowRight, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

const DEFAULT_SLOTS = [
  '08:00 AM - 09:00 AM', '09:00 AM - 10:00 AM', '10:00 AM - 11:00 AM',
  '11:00 AM - 12:00 PM', '12:00 PM - 01:00 PM', '01:00 PM - 02:00 PM',
  '02:00 PM - 03:00 PM', '03:00 PM - 04:00 PM', 'Custom',
];

const TIME_PATTERN = /^\d{1,2}:\d{2}\s*(AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(AM|PM)$/i;

export default function TeacherSelect() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState({ classes: [], class_to_subjects: {} });
  const [cls, setCls] = useState('');
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [timeSlot, setTimeSlot] = useState(DEFAULT_SLOTS[0]);
  const [customTime, setCustomTime] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/teacher/assignments').then(r => {
      setAssignments(r.data);
      if (r.data.classes?.length) {
        setCls(r.data.classes[0]);
        const subjects = r.data.class_to_subjects?.[r.data.classes[0]] || [];
        setSubject(subjects[0] || '');
      }
    }).finally(() => setLoading(false));
  }, []);

  // Reset subject when class changes
  useEffect(() => {
    const subjects = assignments.class_to_subjects?.[cls] || [];
    setSubject(subjects[0] || '');
  }, [cls, assignments]);

  const subjects = assignments.class_to_subjects?.[cls] || [];

  const handleGo = () => {
    if (!cls || !subject) { toast.error('Select class and subject'); return; }
    let time = timeSlot === 'Custom' ? customTime.trim() : timeSlot;
    // FIX: validate custom time format
    if (timeSlot === 'Custom') {
      if (!time) { toast.error('Enter a time slot'); return; }
      if (!TIME_PATTERN.test(time)) { toast.error('Format: HH:MM AM/PM - HH:MM AM/PM (e.g. 9:00 AM - 10:00 AM)'); return; }
    }
    navigate(`/teacher/mark?class=${encodeURIComponent(cls)}&subject=${encodeURIComponent(subject)}&date=${date}&time=${encodeURIComponent(time)}`);
  };

  if (loading) return <div className="flex justify-center h-48 items-center"><div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"/></div>;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-jspm-navy">Mark Attendance</h1>
        <p className="text-gray-500 text-sm">Select class, subject, and time slot to begin</p>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Class</label>
          <select className="input" value={cls} onChange={e => setCls(e.target.value)}>
            {assignments.classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Subject</label>
          <select className="input" value={subject} onChange={e => setSubject(e.target.value)}>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Date</label>
          <input type="date" className="input" value={date} max={new Date().toISOString().slice(0, 10)} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block flex items-center gap-1"><Clock size={12}/> Time Slot</label>
          <select className="input" value={timeSlot} onChange={e => setTimeSlot(e.target.value)}>
            {DEFAULT_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {timeSlot === 'Custom' && (
            <div className="mt-2">
              <input
                type="text"
                className="input"
                placeholder="e.g. 9:00 AM - 10:00 AM"
                value={customTime}
                onChange={e => setCustomTime(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">Format: HH:MM AM/PM - HH:MM AM/PM</p>
            </div>
          )}
        </div>
        <button onClick={handleGo} className="btn-primary w-full">
          Proceed to Mark Attendance <ArrowRight size={16}/>
        </button>
      </div>
    </div>
  );
}
