import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { Users, BookOpen, Layers, ClipboardList, Shield, Calendar, PenSquare, Building2, GraduationCap, ChevronRight, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('departments'); // departments | classes | teachers
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/admin/overview')
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => { toast.error('Failed to load overview data'); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96">
      <div className="w-12 h-12 border-4 border-jspm-blue border-t-transparent rounded-full animate-spin mb-4"/>
      <p className="text-gray-400 font-medium animate-pulse">Loading Institutional Data...</p>
    </div>
  );

  const s = data?.total_stats || {};

  const statCards = [
    { label: 'Departments', value: s.departments ?? 0, icon: Layers, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Managers', value: s.hods ?? 0, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Teachers', value: s.teachers ?? 0, icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Students', value: s.students ?? 0, icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Classes', value: s.classes ?? 0, icon: BookOpen, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  const quickActions = [
    { label: 'Managers', icon: Users, color: 'bg-jspm-navy', to: '/admin/hods' },
    { label: 'Teachers', icon: Shield, color: 'bg-jspm-blue', to: '/admin/teachers' },
    { label: 'Departments', icon: Layers, color: 'bg-indigo-600', to: '/admin/departments' },
    { label: 'Subjects', icon: BookOpen, color: 'bg-amber-600', to: '/admin/subjects' },
    { label: 'Bulk Correction', icon: PenSquare, color: 'bg-rose-600', to: '/admin/bulk-correction' },
    { label: 'Reports', icon: ClipboardList, color: 'bg-emerald-600', to: '/admin/reports' },
  ];

  // Helper to get unassigned/orphan data
  const departments = data?.departments || [];
  const allHods = data?.hods || [];
  const allTeachers = data?.teachers || [];
  
  // Extract all unique classes from allHods
  const allClasses = Array.from(new Set(allHods.flatMap(h => h.classes))).sort();

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-jspm-navy">Administrative Dashboard</h1>
          <p className="text-gray-500 mt-1 font-medium">System summary and quick navigation</p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs font-bold text-gray-400 bg-white shadow-sm border border-gray-100 px-4 py-2 rounded-full uppercase tracking-widest">
          <Calendar size={14} className="text-jspm-blue" /> {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      {/* Global Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statCards.map(c => (
          <div key={c.label} className="card p-5 group hover:shadow-lg transition-all border-b-4 border-transparent hover:border-jspm-blue cursor-default">
            <div className={`w-12 h-12 rounded-2xl ${c.bg} flex items-center justify-center mb-4 shadow-inner group-hover:scale-110 transition-transform`}>
              <c.icon size={24} className={c.color} />
            </div>
            <div className="text-3xl font-black text-jspm-navy tracking-tight">{c.value.toLocaleString()}</div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Interactive Data Viewer */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-0 overflow-hidden border border-gray-100 shadow-sm">
            <div className="flex border-b border-gray-100 bg-gray-50/50">
              {['departments', 'classes', 'teachers'].map(t => (
                <button 
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === t ? 'border-jspm-blue text-jspm-blue bg-white' : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            
            <div className="p-6 max-h-[500px] overflow-y-auto custom-scrollbar">
              
              {/* DEPARTMENTS TAB */}
              {activeTab === 'departments' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {departments.length === 0 && <p className="text-gray-400 text-sm col-span-2 text-center py-10">No departments configured.</p>}
                  {departments.map(d => (
                    <div key={d.dept_id} className="border border-gray-100 rounded-2xl p-4 hover:border-jspm-blue/30 transition-colors group">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-jspm-navy text-lg group-hover:text-jspm-blue transition-colors">{d.name}</h3>
                        <span className="text-xs font-black text-jspm-blue bg-blue-50 px-2 py-1 rounded-lg">{d.student_count} <span className="font-medium opacity-70">Stds</span></span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 py-2 border-t border-gray-50 mt-1">
                        <div className="text-center"><p className="text-sm font-bold text-gray-700">{d.hod_count}</p><p className="text-[8px] font-bold text-gray-400 uppercase">Managers</p></div>
                        <div className="text-center border-x border-gray-50"><p className="text-sm font-bold text-gray-700">{d.class_count}</p><p className="text-[8px] font-bold text-gray-400 uppercase">Classes</p></div>
                        <div className="text-center"><p className="text-sm font-bold text-gray-700">{d.subject_count}</p><p className="text-[8px] font-bold text-gray-400 uppercase">Subjects</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* CLASSES TAB */}
              {activeTab === 'classes' && (
                <div className="space-y-3">
                  {allClasses.length === 0 && <p className="text-gray-400 text-sm text-center py-10">No classes configured under any Manager.</p>}
                  {allClasses.map(cls => {
                    const hod = allHods.find(h => h.classes.includes(cls));
                    return (
                      <div key={cls} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:shadow-md transition-shadow bg-white">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center"><BookOpen size={18}/></div>
                          <div>
                            <p className="font-bold text-jspm-navy text-md">{cls}</p>
                            <p className="text-xs text-gray-500 font-medium">Manager: <span className="text-jspm-blue">{hod?.name || 'Unassigned'}</span></p>
                          </div>
                        </div>
                        <div className="text-[10px] font-bold uppercase text-gray-400 tracking-widest bg-gray-50 px-3 py-1.5 rounded-full">
                          {hod?.dept_name || 'General Dept'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TEACHERS TAB */}
              {activeTab === 'teachers' && (
                <div className="space-y-3">
                  {allTeachers.length === 0 && <p className="text-gray-400 text-sm text-center py-10">No teachers found.</p>}
                  {allTeachers.map(t => (
                    <div key={t.teacher_id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-gray-100 hover:shadow-md transition-shadow bg-white gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-lg">{t.name[0]}</div>
                        <div>
                          <p className="font-bold text-jspm-navy text-md">{t.name}</p>
                          <p className="text-xs text-gray-500">{t.phone || 'No phone'}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 justify-start sm:justify-end">
                        {t.assignments?.slice(0, 3).map((a, i) => (
                          <span key={i} className="px-2 py-1 bg-gray-50 text-gray-600 rounded-md text-[10px] font-bold border border-gray-100">
                            {a.subject} <span className="text-gray-400 font-normal">({a.class})</span>
                          </span>
                        ))}
                        {t.assignments?.length > 3 && <span className="text-[10px] text-jspm-blue font-bold px-2 py-1 bg-blue-50 rounded-md">+{t.assignments.length - 3} more</span>}
                        {!t.assignments?.length && <span className="text-[10px] text-gray-400 italic">No assignments</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Right Column: Quick Actions & Managers */}
        <div className="space-y-6">
          <div className="card bg-jspm-navy text-white overflow-hidden relative shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
            <h2 className="text-lg font-bold mb-5 relative z-10 flex items-center gap-2">
              <PenSquare size={18} className="text-blue-400" /> Command Center
            </h2>
            <div className="grid grid-cols-2 gap-3 relative z-10">
              {quickActions.map(a => (
                <button 
                  key={a.to} 
                  onClick={() => navigate(a.to)}
                  className="flex flex-col items-center justify-center py-4 px-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
                >
                  <a.icon size={20} className="mb-2 text-blue-300 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-center">{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wider">
                <Users className="text-purple-500" size={16} /> Active Managers
              </h2>
              <button onClick={() => navigate('/admin/hods')} className="text-[10px] font-bold text-jspm-blue uppercase hover:underline">View All</button>
            </div>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
               {allHods.length === 0 && <p className="text-xs text-gray-400 italic">No Managers configured</p>}
               {allHods.map(h => (
                 <div key={h.hod_id} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-black text-xs uppercase">{h.name[0]}</div>
                      <div>
                        <p className="text-sm font-bold text-jspm-navy leading-tight">{h.name}</p>
                        <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5 tracking-wider">{h.dept_name || 'General'}</p>
                      </div>
                    </div>
                    <div className="text-[10px] font-black text-purple-600 bg-purple-50 px-2 py-1 rounded-md border border-purple-100">
                      {h.classes?.length || 0} CLS
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
