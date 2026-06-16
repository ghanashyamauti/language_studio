import { useEffect, useState } from 'react';
import api from '../../api/client';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function StudentCalendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get('/student/calendar', { params: { year, month } }).then(r => { setData(r.data); setSelected(null); });
  }, [year, month]);

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); };

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const days = data?.days || {};
  const holidays = data?.holidays || {};

  const getCellStyle = (day) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const d = days[dateStr];
    if (holidays[dateStr]) return 'bg-amber-100 border-amber-300 text-amber-800';
    if (!d) return 'bg-white hover:bg-gray-50';
    const pct = d.present / d.total * 100;
    if (pct === 100) return 'bg-green-100 border-green-300 cursor-pointer hover:bg-green-200';
    if (pct >= 75) return 'bg-blue-50 border-blue-200 cursor-pointer hover:bg-blue-100';
    if (pct > 0) return 'bg-amber-50 border-amber-200 cursor-pointer hover:bg-amber-100';
    return 'bg-red-50 border-red-200 cursor-pointer hover:bg-red-100';
  };

  const handleDayClick = (day) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (days[dateStr]) setSelected(dateStr === selected ? null : dateStr);
  };

  const downloadReport = async () => {
    try {
      const response = await api.get('/student/export/pdf', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_report_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch { 
      import('react-hot-toast').then(toast => toast.default.error('Failed to export PDF'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-jspm-navy">Attendance Calendar</h1>
          <p className="text-gray-500 text-sm">Click a day to see subject details</p>
        </div>
        <button onClick={downloadReport} className="btn-secondary text-sm"><Download size={14}/> Download My Report</button>
      </div>

      <div className="card">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 transition"><ChevronLeft size={18}/></button>
          <h2 className="font-bold text-jspm-navy text-lg">{MONTHS[month - 1]} {year}</h2>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 transition"><ChevronRight size={18}/></button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS_SHORT.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const d = days[dateStr];
            const holiday = holidays[dateStr];
            const isToday = dateStr === today.toISOString().slice(0, 10);
            return (
              <div
                key={day}
                onClick={() => handleDayClick(day)}
                className={`border rounded-xl p-1.5 min-h-[52px] transition-all ${getCellStyle(day)} ${isToday ? 'ring-2 ring-jspm-blue' : ''} ${dateStr === selected ? 'ring-2 ring-jspm-red' : ''}`}
              >
                <div className={`text-xs font-semibold mb-0.5 ${isToday ? 'text-jspm-blue' : 'text-gray-700'}`}>{day}</div>
                {holiday ? (
                  <div className="text-xs text-amber-700 leading-tight" style={{ fontSize: '9px' }}>🎉 {holiday.slice(0, 10)}</div>
                ) : d ? (
                  <>
                    <div className="text-xs font-bold text-jspm-navy" style={{ fontSize: '10px' }}>{d.present}/{d.total}</div>
                    <div className="w-full bg-white/60 rounded-full h-1 mt-0.5">
                      <div className="h-1 rounded-full" style={{ width: `${(d.present/d.total*100)}%`, background: d.present/d.total >= 0.75 ? '#1f4287' : '#e25162' }}/>
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100 text-xs text-gray-600">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 border border-green-300"/>&nbsp;All Present</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-200"/>&nbsp;≥75%</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-200"/>&nbsp;50–74%</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-50 border border-red-200"/>&nbsp;&lt;50%</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300"/>&nbsp;Holiday</span>
        </div>
      </div>

      {/* Day detail panel */}
      {selected && days[selected] && (
        <div className="card">
          <h3 className="font-semibold text-jspm-navy mb-3">
            {new Date(selected + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          <div className="space-y-2">
            {days[selected].subjects.map((s, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 bg-gray-50 rounded-xl">
                <span className="text-sm font-medium text-jspm-navy">{s.subject}</span>
                <span className={s.status === 'Present' ? 'badge-present' : 'badge-absent'}>{s.status}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-sm text-gray-500">
            Total: {days[selected].present} present / {days[selected].total} lectures
          </div>
        </div>
      )}
    </div>
  );
}
