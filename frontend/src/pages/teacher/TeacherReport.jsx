import { useEffect, useState } from 'react';
import api from '../../api/client';
import Pagination from '../../components/Pagination';
import { FileText, Download } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TeacherReport() {
  const [assignments, setAssignments] = useState({ classes: [], class_to_subjects: {} });
  const [cls, setCls] = useState('');
  const [subject, setSubject] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [report, setReport] = useState([]);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('roll_no_asc');
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/teacher/assignments').then(r => {
      setAssignments(r.data);
      if (r.data.classes?.length) setCls(r.data.classes[0]);
    });
  }, []);

  // FIX: Reset subject when class changes
  useEffect(() => {
    const subjects = assignments.class_to_subjects?.[cls] || [];
    setSubject(subjects[0] || '');
  }, [cls, assignments]);

  const subjects = assignments.class_to_subjects?.[cls] || [];

  const load = async (p = 1) => {
    if (!cls || !subject) { toast.error('Select class and subject'); return; }
    setLoading(true);
    try {
      const r = await api.get('/teacher/report', { 
        params: { 
          cls, subject, 
          start: start || undefined, 
          end: end || undefined, 
          page: p, limit: 20,
          sort_by: sortBy
        } 
      });
      setReport(r.data.report || []);
      setTotalPages(r.data.total_pages || 1);
      setPage(p);
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  };

  const downloadCSV = async () => {
    try {
      const response = await api.get('/teacher/export/csv', {
        params: { cls, subject, start: start || undefined, end: end || undefined },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report_${cls}_${subject}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch { toast.error('Failed to export CSV'); }
  };

  const downloadPDF = async () => {
    try {
      const response = await api.get('/teacher/export/pdf', {
        params: { cls, subject, start: start || undefined, end: end || undefined },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report_${cls}_${subject}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch { toast.error('Failed to export PDF'); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-jspm-navy">Attendance Report</h1>
        <p className="text-gray-500 text-sm">Filter and export student attendance</p>
      </div>

      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
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
            <label className="text-xs font-medium text-gray-600 mb-1 block">From</label>
            <input type="date" className="input" value={start} onChange={e => setStart(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">To</label>
            <input type="date" className="input" value={end} onChange={e => setEnd(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Sort By</label>
            <select className="input" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="roll_no_asc">Roll No (A-Z)</option>
              <option value="roll_no_desc">Roll No (Z-A)</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
              <option value="percent_asc">Attendance (Lowest First)</option>
              <option value="percent_desc">Attendance (Highest First)</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => load(1)} disabled={loading} className="btn-primary w-full">
              <FileText size={16}/> {loading ? 'Loading...' : 'Generate'}
            </button>
          </div>
        </div>

        {report.length > 0 && (
          <div className="flex gap-3 mb-4">
            <button onClick={downloadCSV} className="btn-secondary text-sm"><Download size={14}/> CSV</button>
            <button onClick={downloadPDF} className="btn-secondary text-sm"><Download size={14}/> PDF</button>
          </div>
        )}
      </div>

      {report.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-jspm-blue text-white">
              <tr>
                <th className="px-4 py-3 text-left">Roll No</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-center">Attended</th>
                <th className="px-4 py-3 text-center">Total</th>
                <th className="px-4 py-3 text-center">%</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {report.map((r, i) => (
                <tr key={r.roll_no} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'} ${r.percent < 75 ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3 font-mono text-jspm-navy">{r.roll_no}</td>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-center">{r.attended}</td>
                  <td className="px-4 py-3 text-center">{r.total}</td>
                  <td className="px-4 py-3 text-center font-bold" style={{ color: r.percent >= 75 ? '#2e7d32' : '#e25162' }}>{r.percent}%</td>
                  <td className="px-4 py-3 text-center">
                    <span className={r.percent >= 75 ? 'badge-present' : 'badge-absent'}>{r.percent >= 75 ? 'OK' : 'Low'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <Pagination page={page} totalPages={totalPages} onPageChange={p => load(p)} />
          </div>
        </div>
      )}
    </div>
  );
}
