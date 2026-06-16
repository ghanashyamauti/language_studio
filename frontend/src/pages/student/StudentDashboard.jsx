import { useEffect, useState, useRef } from 'react';
import api from '../../api/client';
import Pagination from '../../components/Pagination';
import { AlertTriangle, Download, TrendingUp, BookOpen } from 'lucide-react';

const PERIODS = ['daily', 'weekly', 'monthly'];

export default function StudentDashboard() {
  const [period, setPeriod] = useState('weekly');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const pendingPage = useRef(1);

  // FIX: use ref to avoid stale page state when period changes
  const load = (p, per) => {
    setLoading(true);
    api.get('/student/dashboard', { params: { period: per, page: p, limit: 20 } })
      .then(r => { setData(r.data); setPage(p); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // FIX: always reset to page 1 when period changes
    load(1, period);
  }, [period]);

  const handlePeriodChange = (p) => {
    setPeriod(p);
    // load will be triggered by effect above with page=1
  };

  const handlePageChange = (p) => {
    load(p, period);
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

  const percents = data?.percents || []; // backend already filters out subjects with 0 records
  const below = data?.below || [];
  const records = data?.records || [];

  const overallPct = percents.length > 0
    ? Math.round(percents.reduce((s, p) => s + p.percent, 0) / percents.length)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-jspm-navy">My Attendance</h1>
          <p className="text-gray-500 text-sm">{data?.start} — {data?.end}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period switcher */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {PERIODS.map(p => (
              <button key={p} onClick={() => handlePeriodChange(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${period === p ? 'bg-white text-jspm-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {p}
              </button>
            ))}
          </div>
          <button onClick={downloadReport} className="btn-secondary text-sm"><Download size={14}/> PDF</button>
        </div>
      </div>

      {/* Low attendance alert */}
      {below.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5"/>
          <div>
            <p className="font-semibold text-red-700 text-sm">Low Attendance Alert</p>
            <p className="text-red-600 text-sm">You are below 75% in: {below.map(b => `${b.subject} (${b.percent}%)`).join(', ')}</p>
          </div>
        </div>
      )}

      {/* Holidays */}
      {data?.holidays?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.holidays.map(h => (
            <span key={h.date} className="text-xs px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full font-medium">🎉 {h.date} — {h.name}</span>
          ))}
        </div>
      )}

      {/* Overall + subject breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Overall */}
        <div className="card text-center flex flex-col items-center justify-center py-6">
          <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1"><TrendingUp size={12}/> Overall Attendance</div>
          {overallPct !== null ? (
            <>
              <div className={`text-5xl font-bold ${overallPct >= 75 ? 'text-green-600' : 'text-jspm-red'}`}>{overallPct}%</div>
              <div className={`text-xs mt-2 font-medium ${overallPct >= 75 ? 'text-green-500' : 'text-red-500'}`}>
                {overallPct >= 75 ? '✓ Above minimum' : '⚠ Below 75% requirement'}
              </div>
            </>
          ) : (
            <p className="text-gray-400 text-sm">No data for this period</p>
          )}
        </div>

        {/* Subject breakdown */}
        <div className="card col-span-2">
          <h2 className="font-semibold text-jspm-navy mb-3 flex items-center gap-2"><BookOpen size={15}/> Subject Breakdown</h2>
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-jspm-blue border-t-transparent rounded-full animate-spin"/></div>
          ) : percents.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No attendance data for this period.</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {percents.map(p => (
                <div key={p.subject}>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-sm font-medium text-jspm-navy">{p.subject}</span>
                      {p.code && <span className="text-xs text-gray-400 ml-2">({p.code})</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{p.attended}/{p.total}</span>
                      <span className={`text-sm font-bold ${p.percent >= 75 ? 'text-green-600' : 'text-jspm-red'}`}>{p.percent}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${p.percent}%`, background: p.percent >= 75 ? '#1f4287' : '#e25162' }}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Attendance records table */}
      <div className="card">
        <h2 className="font-semibold text-jspm-navy mb-4">Attendance Records</h2>
        {records.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No records in this period.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100">
                  <tr>
                    <th className="pb-2 text-left text-xs font-medium text-gray-500">Date</th>
                    <th className="pb-2 text-left text-xs font-medium text-gray-500">Subject</th>
                    <th className="pb-2 text-center text-xs font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {records.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="py-2.5 pr-4 text-gray-600 font-mono text-xs">{r.date}</td>
                      <td className="py-2.5 pr-4 font-medium text-jspm-navy">{r.subject}</td>
                      <td className="py-2.5 text-center">
                        <span className={r.status === 'Present' ? 'badge-present' : 'badge-absent'}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={data?.total_pages || 1} onPageChange={handlePageChange} />
          </>
        )}
      </div>
    </div>
  );
}
