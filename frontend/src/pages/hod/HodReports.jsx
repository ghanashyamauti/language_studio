import { useEffect, useState } from 'react';
import api from '../../api/client';
import { ClipboardList, Download, Calendar, Search, User, BookOpen, Clock, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function HodReports() {
  const [activeTab, setActiveTab] = useState('students'); // 'students' or 'teachers'
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [studentReport, setStudentReport] = useState([]);
  const [teacherReport, setTeacherReport] = useState([]);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const classRes = await api.get('/hod/dashboard');
      setClasses(classRes.data.classes || []);
      if (classRes.data.classes?.length > 0 && !selectedClass) {
        setSelectedClass(classRes.data.classes[0].class_name);
      }
      
      // Load teacher report
      const teachRes = await api.get('/hod/reports/teachers', {
        params: { start: dateRange.start, end: dateRange.end }
      });
      setTeacherReport(teachRes.data.report || []);
      
      setLoading(false);
    } catch { setLoading(false); }
  };

  const loadStudentReport = async () => {
    if (!selectedClass) return;
    try {
      const res = await api.get('/hod/report', {
        params: { 
          class_: selectedClass, 
          start: dateRange.start, 
          end: dateRange.end,
          limit: 100
        }
      });
      setStudentReport(res.data.report || []);
    } catch { toast.error('Failed to load student report'); }
  };

  useEffect(() => { loadData(); }, [dateRange]);
  useEffect(() => { if (selectedClass) loadStudentReport(); }, [selectedClass, dateRange]);

  const downloadPDF = async () => {
    if (activeTab === 'students' && !selectedClass) return;
    try {
      const response = await api.get('/hod/export/pdf', {
        params: { 
          class_: selectedClass,
          start: dateRange.start,
          end: dateRange.end
        },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report_${selectedClass}_${dateRange.start}_${dateRange.end}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch { toast.error('Failed to export PDF'); }
  };

  if (loading) return <div className="flex justify-center h-48 items-center"><div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"/></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-jspm-navy font-display">Academic Reports</h1>
          <p className="text-gray-500 text-sm">Monitor attendance and teaching performance</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 px-3 border-r border-gray-100">
            <Calendar size={14} className="text-gray-400" />
            <input 
              type="date" className="text-xs font-medium border-none p-0 outline-none w-28"
              value={dateRange.start} onChange={e => setDateRange(p => ({...p, start: e.target.value}))}
            />
          </div>
          <div className="flex items-center gap-2 px-3">
            <input 
              type="date" className="text-xs font-medium border-none p-0 outline-none w-28"
              value={dateRange.end} onChange={e => setDateRange(p => ({...p, end: e.target.value}))}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-white rounded-2xl border border-gray-100 w-fit">
        <button 
          onClick={() => setActiveTab('students')}
          className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'students' ? 'bg-jspm-blue text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          Student Attendance
        </button>
        <button 
          onClick={() => setActiveTab('teachers')}
          className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'teachers' ? 'bg-jspm-blue text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          Teacher Sessions
        </button>
      </div>

      {activeTab === 'students' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <select 
                className="input" 
                value={selectedClass} 
                onChange={e => setSelectedClass(e.target.value)}
              >
                <option value="">— Select Class —</option>
                {classes.map(c => <option key={c.class_name} value={c.class_name}>{c.class_name}</option>)}
              </select>
            </div>
            <button onClick={downloadPDF} className="btn-secondary text-sm flex items-center gap-2">
              <Download size={14}/> Export PDF
            </button>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Roll No</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Student Name</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Present</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Percent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {studentReport.map(s => (
                    <tr key={s.student_id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-jspm-navy font-semibold">{s.roll_no}</td>
                      <td className="px-6 py-4 font-medium text-gray-900">{s.name}</td>
                      <td className="px-6 py-4 text-center text-gray-500">{s.total}</td>
                      <td className="px-6 py-4 text-center text-emerald-600 font-semibold">{s.attended}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${s.percent >= 75 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {s.percent}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {studentReport.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center text-gray-400">
                        <div className="flex flex-col items-center gap-2">
                          <ClipboardList size={40} className="text-gray-200" />
                          <p>No attendance data found for this class and period.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {teacherReport.map((t, idx) => (
              <div key={idx} className="card p-5 flex items-center justify-between hover:border-jspm-blue transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-jspm-bg flex items-center justify-center text-jspm-blue group-hover:bg-jspm-blue group-hover:text-white transition-colors">
                    <User size={24}/>
                  </div>
                  <div>
                    <h3 className="font-bold text-jspm-navy">{t.name}</h3>
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                      <span className="flex items-center gap-1"><BookOpen size={12}/> {t.subject}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-jspm-navy leading-none">{t.sessions_count}</div>
                  <div className="text-[10px] uppercase font-bold text-gray-400 mt-1">Sessions</div>
                </div>
              </div>
            ))}
            {teacherReport.length === 0 && (
              <div className="col-span-full py-20 text-center text-gray-400 card border-dashed">
                <div className="flex flex-col items-center gap-2">
                  <Clock size={40} className="text-gray-200" />
                  <p>No teaching sessions recorded in this period.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
