import { useEffect, useState } from 'react';
import api from '../../api/client';
import { TrendingUp, CheckCircle, Clock } from 'lucide-react';

export default function TeacherPerformance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/teacher/performance').then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center h-48 items-center"><div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"/></div>;

  const stats = data?.stats || [];
  const maxSessions = Math.max(...stats.map(s => s.sessions_marked || 0), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-jspm-navy">My Performance</h1>
        <p className="text-gray-500 text-sm">Sessions marked in the last {data?.period_days || 30} days · Last marked: {data?.last_marked || 'Never'}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="card">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold text-jspm-navy">{s.subject}</div>
                <div className="text-xs text-gray-500">{s.class_}</div>
              </div>
              <span className="text-2xl font-bold text-jspm-blue">{s.sessions_marked}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${(s.sessions_marked / maxSessions) * 100}%` }} />
            </div>
            <div className="text-xs text-gray-400 mt-1">sessions in 30 days</div>
          </div>
        ))}
        {!stats.length && <div className="card text-center py-12 text-gray-400 col-span-2">No assignment data found.</div>}
      </div>

      <div className="card">
        <div className="flex items-center gap-2 text-green-600 mb-2"><CheckCircle size={16}/><span className="font-semibold text-sm">Tip</span></div>
        <p className="text-sm text-gray-500">Mark attendance regularly for accurate student reports. Each session you mark contributes to the overall tracking record for your class.</p>
      </div>
    </div>
  );
}
