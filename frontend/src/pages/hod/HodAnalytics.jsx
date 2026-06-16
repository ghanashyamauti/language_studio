import { useEffect, useState } from 'react';
import api from '../../api/client';
import { TrendingUp } from 'lucide-react';

export default function HodAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/hod/analytics').then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center h-48 items-center"><div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"/></div>;

  const trend = data?.trend || [];
  const maxTotal = Math.max(...trend.map(t => t.total || 0), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-jspm-navy">Manager Analytics</h1>
        <p className="text-gray-500 text-sm">Last 30 days for classes: {data?.class_names?.join(', ')}</p>
      </div>

      <div className="card">
        <h2 className="font-semibold text-jspm-navy mb-4">Daily Attendance Trend</h2>
        <div className="flex items-end gap-1 h-40 overflow-x-auto pb-2">
          {trend.map((d, i) => {
            const h = d.total > 0 ? Math.max((d.total / maxTotal) * 100, 4) : 2;
            const color = d.percent >= 75 ? '#7c3aed' : d.percent >= 50 ? '#f1c40f' : '#e25162';
            return (
              <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ width: '28px' }}>
                <div className="text-xs text-gray-400" style={{ fontSize: '9px' }}>{d.percent > 0 ? `${d.percent}%` : ''}</div>
                <div title={`${d.date}: ${d.present}/${d.total}`}
                  style={{ height: `${h}%`, background: color, minHeight: '4px' }}
                  className="w-full rounded-t-sm transition-all hover:opacity-80"/>
                <div className="text-xs text-gray-300" style={{ fontSize: '8px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxHeight: '32px' }}>
                  {d.date.slice(5)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-jspm-navy mb-4 flex items-center gap-2"><TrendingUp size={16}/>Teacher Performance (Last 30 Days)</h2>
        <div className="space-y-3">
          {(data?.teacher_performance || []).map((t, i) => (
            <div key={t.teacher_id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
              <span className="w-6 text-xs font-bold text-gray-400 text-center">#{i+1}</span>
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-jspm-navy">{t.name}</span>
                  <span className="font-bold text-purple-600">{t.sessions_last_30d} sessions</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-purple-500" style={{ width: `${Math.min((t.sessions_last_30d / 30) * 100, 100)}%` }}/>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">Last marked: {t.last_marked || 'Never'}</div>
              </div>
              {t.sessions_last_30d === 0 && <span className="badge-absent text-xs">Inactive</span>}
            </div>
          ))}
          {!data?.teacher_performance?.length && <p className="text-gray-400 text-sm text-center py-4">No teacher data found</p>}
        </div>
      </div>
    </div>
  );
}
