import { useEffect, useState } from 'react';
import api from '../../api/client';
import { TrendingUp, TrendingDown, Users, BookOpen, AlertTriangle } from 'lucide-react';

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/analytics').then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center h-64 items-center"><div className="w-8 h-8 border-4 border-jspm-blue border-t-transparent rounded-full animate-spin"/></div>;

  const trend = data?.trend || [];
  const maxTotal = Math.max(...trend.map(t => t.total || 0), 1);
  const classStats = data?.class_stats || [];
  const teacherPerf = data?.teacher_performance || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-jspm-navy">Analytics Dashboard</h1>
        <p className="text-gray-500 text-sm">Last 30 days · {data?.period?.start} to {data?.period?.end}</p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Defaulters (<75%)', value: data?.defaulter_count ?? 0, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Active Classes', value: classStats.length, icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Top Teacher Sessions', value: teacherPerf[0]?.sessions_last_30d ?? 0, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Days Tracked', value: trend.filter(t => t.total > 0).length, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(c => (
          <div key={c.label} className="card p-4">
            <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center mb-3`}><c.icon size={20} className={c.color} /></div>
            <div className="text-2xl font-bold text-jspm-navy">{c.value}</div>
            <div className="text-xs text-gray-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Attendance Trend Chart */}
      <div className="card">
        <h2 className="font-semibold text-jspm-navy mb-4">Daily Attendance Trend (Last 30 Days)</h2>
        <div className="flex items-end gap-1 h-40 overflow-x-auto pb-2">
          {trend.map((d, i) => {
            const h = d.total > 0 ? Math.max((d.total / maxTotal) * 100, 4) : 2;
            const pct = d.percent;
            const color = pct >= 75 ? '#1f4287' : pct >= 50 ? '#f1c40f' : '#e25162';
            return (
              <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ width: '28px' }}>
                <div className="text-xs text-gray-400" style={{ fontSize: '9px' }}>{pct > 0 ? `${pct}%` : ''}</div>
                <div
                  title={`${d.date}: ${d.present}/${d.total} (${pct}%)`}
                  style={{ height: `${h}%`, background: color, minHeight: '4px' }}
                  className="w-full rounded-t-sm transition-all hover:opacity-80 cursor-pointer"
                />
                <div className="text-xs text-gray-300" style={{ fontSize: '8px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxHeight: '32px' }}>
                  {d.date.slice(5)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-2 text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-jspm-blue inline-block"/>&nbsp;≥75%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-jspm-gold inline-block"/>&nbsp;50–74%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-jspm-red inline-block"/>&nbsp;&lt;50%</span>
        </div>
      </div>

      {/* Class stats + Teacher performance side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-jspm-navy mb-4">Class Attendance Overview</h2>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {classStats.sort((a, b) => a.attendance_percent - b.attendance_percent).map(c => (
              <div key={c.class_name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-jspm-navy">{c.class_name}</span>
                  <span className={c.attendance_percent < 75 ? 'text-red-500 font-semibold' : 'text-green-600'}>
                    {c.attendance_percent}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${c.attendance_percent}%`, background: c.attendance_percent >= 75 ? '#1f4287' : c.attendance_percent >= 50 ? '#f1c40f' : '#e25162' }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{c.students} students</div>
              </div>
            ))}
            {!classStats.length && <p className="text-gray-400 text-sm text-center py-8">No data available</p>}
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-jspm-navy mb-4">Teacher Performance (Sessions/30d)</h2>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {teacherPerf.map((t, i) => (
              <div key={t.teacher_id} className="flex items-center gap-3">
                <span className="w-6 text-center text-xs font-bold text-gray-400">#{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-jspm-navy">{t.name}</span>
                    <span className="font-semibold text-jspm-blue">{t.sessions_last_30d} sessions</span>
                  </div>
                  <div className="text-xs text-gray-400">Last marked: {t.last_marked || 'Never'}</div>
                </div>
                {t.sessions_last_30d === 0 && (
                  <span className="badge-absent text-xs">Inactive</span>
                )}
              </div>
            ))}
            {!teacherPerf.length && <p className="text-gray-400 text-sm text-center py-8">No teachers found</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
