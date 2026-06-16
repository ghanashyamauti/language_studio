import { useState, useEffect } from 'react';
import api from '../../api/client';
import { Plus, Building2, GraduationCap, X, Edit2, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

function ClassModal({ hods, subjects, departments, onSave, onCancel, editData = null }) {
  const [form, setForm] = useState(editData ? { 
    class_name: editData.class_name, 
    hod_id: hods.find(h => h.name === editData.hod)?.hod_id || '',
    dept_id: editData.dept_id || '',
    dept_ids: editData.dept_ids || [],
    semester: editData.semester || 2,
    department_name: editData.dept_name || '', 
    division: editData.division || '',
    subjects: editData.assigned_subjects || []
  } : { 
    class_name:'', division:'', department_name:'', dept_id:'', dept_ids: [], semester:2, hod_id:'', subjects: [] 
  });
  
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }));

  const autoName = () => {
    if (editData) return;
    const parts = [form.department_name, form.division ? `Div ${form.division}` : ''].filter(Boolean);
    if (parts.length && !form.class_name) set('class_name', parts.join(' '));
  };

  const toggleSubject = (subId) => {
    set('subjects', form.subjects.includes(subId) 
      ? form.subjects.filter(id => id !== subId)
      : [...form.subjects, subId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-xl text-jspm-blue">{editData ? 'Edit Class' : 'Create New Class'}</h2>
          <button type="button" onClick={onCancel} className="p-1 rounded-lg hover:bg-gray-100"><X size={18}/></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 font-bold">Select Departments <span className="text-gray-400 font-normal lowercase">(at least one)</span></label>
              <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto p-2 border border-gray-100 rounded-xl bg-gray-50/50">
                {departments.map(d => (
                  <label key={d.dept_id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                    <input type="checkbox" checked={form.dept_ids.includes(d.dept_id)} onChange={() => {
                      const exists = form.dept_ids.includes(d.dept_id);
                      const newDeptIds = exists 
                        ? form.dept_ids.filter(id => id !== d.dept_id)
                        : [...form.dept_ids, d.dept_id];
                      const firstDept = departments.find(dep => newDeptIds.includes(dep.dept_id));
                      setForm(f => ({ ...f, dept_ids: newDeptIds, dept_id: firstDept?.dept_id || '', department_name: firstDept?.name || '' }));
                    }} className="rounded text-jspm-blue" />
                    <span className="text-xs font-medium text-gray-700 truncate">{d.name}</span>
                  </label>
                ))}
              </div>
            </div>
            {!editData && (
              <div className="grid grid-cols-2 gap-3">
                 <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Division <span className="text-gray-400 font-normal">(opt)</span></label>
                  <input className="input" value={form.division} onChange={e => set('division', e.target.value)}
                    onBlur={autoName} placeholder="A, B, C..."/>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Semester</label>
                  <input type="number" className="input" value={form.semester}
                    onChange={e => set('semester', Number(e.target.value))} min={1} max={8}/>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Class Name</label>
            <input className="input" value={form.class_name} onChange={e => set('class_name', e.target.value)}
              placeholder="e.g. SYMCA Div A" required/>
            {!editData && <p className="text-xs text-gray-400 mt-1">Auto-filled from dept + division, or type manually</p>}
          </div>
          
          <div className="border-t border-gray-100 pt-4 mt-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1 font-bold">Assign to Manager <span className="text-gray-400 font-normal">(optional)</span></label>
            <select className="input" value={form.hod_id} onChange={e => set('hod_id', e.target.value)}>
              <option value="">Select Manager (optional)</option>
              {hods.map(h => <option key={h.hod_id} value={h.hod_id}>{h.name} {h.dept_name ? `· ${h.dept_name}` : ''}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Assign Subjects <span className="text-gray-400 font-normal">(multi-select)</span></label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-gray-100 rounded-xl bg-gray-50/50">
              {subjects.map(s => (
                <label key={s.subject_id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                  <input type="checkbox" checked={form.subjects.includes(s.subject_id)} onChange={() => toggleSubject(s.subject_id)} className="rounded text-jspm-blue" />
                  <span className="text-xs font-medium text-gray-700 truncate">{s.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={() => onSave(form)} className="btn-primary flex-1">{editData ? 'Update Class' : 'Create Class'}</button>
          <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminClasses() {
  const [classes, setClasses] = useState([]);
  const [hods, setHods]       = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [loading, setLoading]  = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/admin/classes'),
      api.get('/admin/hods'),
      api.get('/admin/subjects'),
      api.get('/admin/departments'),
    ]).then(([c, h, s, d]) => {
      setClasses(c.data || []);
      setHods(h.data || []);
      setSubjects(s.data || []);
      setDepartments(d.data || []);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleSave = async (form) => {
    if (!form.class_name.trim()) return toast.error('Class name is required');
    try {
      const payload = {
        class_name: form.class_name.trim(),
        hod_id: form.hod_id ? Number(form.hod_id) : null,
        dept_id: form.dept_id ? Number(form.dept_id) : null,
        dept_ids: form.dept_ids,
        semester: form.semester,
        subjects: form.subjects
      };
      
      if (editingClass) {
        await api.patch(`/admin/classes/${encodeURIComponent(editingClass.class_name)}`, payload);
        toast.success('Class updated!');
      } else {
        await api.post('/admin/classes', payload);
        toast.success(`Class "${form.class_name}" created!`);
      }
      setShowForm(false);
      setEditingClass(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save class');
    }
  };

  const handleDelete = async (className) => {
    if (!window.confirm(`Delete class "${className}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/classes/${encodeURIComponent(className)}`);
      toast.success('Class deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete class');
    }
  };

  return (
    <div>
      {(showForm || editingClass) && (
        <ClassModal 
          hods={hods} 
          subjects={subjects}
          departments={departments}
          onSave={handleSave} 
          onCancel={() => { setShowForm(false); setEditingClass(null); }}
          editData={editingClass}
        />
      )}

      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold text-2xl text-jspm-blue">Classes</h1>
          <p className="text-gray-500 text-sm mt-1">All classes across the institution</p>
        </div>
        <button type="button" onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={15}/> New Class
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-white rounded-2xl animate-pulse"/>)}
        </div>
      ) : classes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map(c => (
            <div key={c.class_name} className="card">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#eef2f9' }}>
                  <Building2 size={18} style={{ color: '#1f4287' }}/>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingClass(c)}
                    className="p-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 text-blue-400 transition-all">
                    <Edit2 size={14}/>
                  </button>
                  <button type="button" onClick={() => handleDelete(c.class_name)}
                    className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-400 transition-all">
                    <X size={14}/>
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-800">{c.class_name}</h3>
              <div className="flex gap-4 mt-3 text-sm text-gray-500 flex-wrap">
                <span className="flex items-center gap-1"><GraduationCap size={14}/>{c.student_count} students</span>
                <div className="flex flex-wrap gap-1">
                  {(c.dept_names?.length > 0 ? c.dept_names : [c.dept_name]).filter(Boolean).map(dn => (
                    <span key={dn} className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[10px] font-bold uppercase">
                      {dn}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-50">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Assigned Subjects</div>
                <div className="flex flex-wrap gap-1">
                  {c.assigned_subjects?.map(subId => {
                    const sub = subjects.find(s => s.subject_id === subId);
                    return sub ? (
                      <span key={subId} className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md border border-indigo-100">
                        {sub.name}
                      </span>
                    ) : null;
                  })}
                  {!c.assigned_subjects?.length && <span className="text-[10px] text-gray-300 italic">None</span>}
                </div>
              </div>

              <p className="text-xs mt-3 font-medium" style={{ color: '#1f4287' }}>
                Manager: {c.hod || <span className="text-gray-400">Unassigned</span>}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12 text-gray-400">
          <Building2 size={32} className="mx-auto mb-2 opacity-40"/>
          <p className="mb-3">No classes yet.</p>
          <button type="button" onClick={() => setShowForm(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus size={14}/> Create First Class
          </button>
        </div>
      )}
    </div>
  );
}
