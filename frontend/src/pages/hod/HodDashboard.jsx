import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { BookOpen, Users, Plus, AlertTriangle, TrendingUp, ChevronRight, Shield, FileText, GraduationCap } from 'lucide-react';

export default function HodDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/hod/dashboard').then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center h-48 items-center"><div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"/></div>;

  const hod = data?.hod || {};
  const classes = data?.classes || [];
  const alerts = data?.low_attendance_alerts || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-jspm-navy">Manager Dashboard</h1>
          <p className="text-gray-500 text-sm">Welcome, {hod.name} {hod.department ? `· ${hod.department}` : ''}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate('/hod/analytics')} className="btn-secondary text-sm flex items-center gap-2"><TrendingUp size={14}/> Analytics</button>
          <button onClick={() => navigate('/hod/create-class')} className="btn-primary text-sm flex items-center gap-2"><Plus size={14}/> Create Class</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <button onClick={() => navigate('/hod/teachers')} className="card p-4 hover:border-purple-300 transition-all text-center group">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center mx-auto mb-2 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
            <Shield size={20}/>
          </div>
          <div className="text-sm font-semibold text-jspm-navy">Teachers</div>
        </button>
        <button onClick={() => navigate('/hod/students')} className="card p-4 hover:border-emerald-300 transition-all text-center group">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-2 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            <GraduationCap size={20}/>
          </div>
          <div className="text-sm font-semibold text-jspm-navy">Students</div>
        </button>
        <button onClick={() => navigate('/hod/subjects')} className="card p-4 hover:border-blue-300 transition-all text-center group">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-2 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <BookOpen size={20}/>
          </div>
          <div className="text-sm font-semibold text-jspm-navy">Subjects</div>
        </button>
        <button onClick={() => navigate('/hod/reports')} className="card p-4 hover:border-emerald-300 transition-all text-center group">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-2 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            <FileText size={20}/>
          </div>
          <div className="text-sm font-semibold text-jspm-navy">Reports</div>
        </button>
        <button onClick={() => navigate('/hod/analytics')} className="card p-4 hover:border-orange-300 transition-all text-center group">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mx-auto mb-2 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
            <TrendingUp size={20}/>
          </div>
          <div className="text-sm font-semibold text-jspm-navy">Analytics</div>
        </button>
      </div>

      {/* Classes list */}
      <div>
        <h2 className="font-semibold text-jspm-navy mb-4">My Classes</h2>
        {classes.length === 0 ? (
          <div className="card text-center py-12">
            <BookOpen size={32} className="text-gray-300 mx-auto mb-3"/>
            <p className="text-gray-400">No classes yet</p>
            <button onClick={() => navigate('/hod/create-class')} className="btn-primary mt-4 text-sm"><Plus size={14}/> Create First Class</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {classes.map(c => (
              <button key={c.class_name} onClick={() => navigate(`/hod/classes/${encodeURIComponent(c.class_name)}`)}
                className="card text-left hover:shadow-md hover:border-purple-200 transition-all group">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                    <BookOpen size={18} className="text-purple-600"/>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-purple-500 transition-colors"/>
                </div>
                <div className="font-semibold text-jspm-navy">{c.class_name}</div>
                <div className="text-xs text-gray-500 mt-1">{c.department || 'No dept'} · Sem {c.semester}</div>
                <div className="flex gap-4 mt-3">
                  <div className="text-center">
                    <div className="text-lg font-bold text-jspm-navy">{c.student_count}</div>
                    <div className="text-xs text-gray-400">Students</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-jspm-navy">{c.assignments?.length || 0}</div>
                    <div className="text-xs text-gray-400">Subjects</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
