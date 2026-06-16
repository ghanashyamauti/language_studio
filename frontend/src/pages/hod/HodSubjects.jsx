import { useEffect, useState } from 'react';
import api from '../../api/client';
import { BookOpen, Plus, X, Search, Code, Trash2, GraduationCap, Pencil, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

const emptyForm = { name: '', code: '', classes: [], dept_ids: [] };

export default function HodSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [search, setSearch] = useState('');
  const [classes, setClasses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    try {
      const [subRes, dashRes, deptRes] = await Promise.all([
        api.get('/hod/subjects'),
        api.get('/hod/dashboard'),
        api.get('/admin/departments') // HODs can usually read departments
      ]);
      setSubjects(subRes.data || []);
      setClasses(dashRes.data.classes || []);
      setDepartments(deptRes.data || []);
      setLoading(false);
    } catch { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setEditId(null);
    setModal(true);
  };

  const openEdit = (s) => {
    setForm({
      name: s.name,
      code: s.code || '',
      classes: s.assigned_classes || [],
      dept_ids: s.dept_ids || []
    });
    setEditId(s.subject_id);
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form };
    if (payload.code === '') payload.code = null;

    try {
      if (editId) {
        await api.patch(`/hod/subjects/${editId}`, payload);
        toast.success('Subject updated successfully');
      } else {
        await api.post('/hod/subjects', payload);
        toast.success('Subject created successfully');
      }
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save subject');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/hod/subjects/${deleteTarget}`);
      toast.success('Subject deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete subject');
    }
    setDeleteTarget(null);
  };

  const toggleClass = (className) => {
    setForm(prev => {
      const exists = prev.classes.includes(className);
      if (exists) return { ...prev, classes: prev.classes.filter(c => c !== className) };
      return { ...prev, classes: [...prev.classes, className] };
    });
  };

  const toggleDept = (deptId) => {
    const id = Number(deptId);
    setForm(prev => {
      const exists = prev.dept_ids.includes(id);
      if (exists) return { ...prev, dept_ids: prev.dept_ids.filter(d => d !== id) };
      return { ...prev, dept_ids: [...prev.dept_ids, id] };
    });
  };

  const filtered = subjects.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.code?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center h-48 items-center"><div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"/></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-jspm-navy">Manage Subjects</h1>
          <p className="text-gray-500 text-sm">Add and view subjects for your department</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 px-4 py-2">
          <Plus size={18}/> Add Subject
        </button>
      </div>

      <div className="card mb-6 shadow-sm border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
          <input 
            type="text" 
            placeholder="Search by subject name or code..." 
            className="input pl-10 bg-gray-50 border-transparent focus:bg-white" 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(s => (
          <div key={s.subject_id} className="card group hover:shadow-md transition-all p-5 border-l-4 border-l-blue-500 relative">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner group-hover:scale-105 transition-transform">
                <BookOpen size={24}/>
              </div>
              <div className="flex-1 min-w-0 pr-12">
                <h3 className="font-bold text-jspm-navy truncate text-lg leading-tight">{s.name}</h3>
                <div className="flex items-center gap-1.5 text-gray-500 text-xs mt-1.5 font-medium">
                  <Code size={12}/>
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">{s.code || 'No code'}</span>
                </div>
                
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(s.dept_names?.length > 0 ? s.dept_names : [s.dept_name || s.department]).map(dn => (
                    <span key={dn} className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100/50 uppercase tracking-tighter">
                      {dn}
                    </span>
                  ))}
                </div>

                {s.assigned_classes?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {s.assigned_classes.map(cls => (
                      <span key={cls} className="text-[9px] font-bold bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded border border-purple-100">
                        {cls}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="absolute top-4 right-4 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => openEdit(s)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Pencil size={14}/></button>
              <button onClick={() => setDeleteTarget(s.subject_id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={14}/></button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-16 text-center text-gray-400 bg-white rounded-3xl border-2 border-dashed border-gray-100">
            <BookOpen size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">No subjects found matching your search.</p>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-2xl text-jspm-navy">{editId ? 'Edit Subject' : 'Add New Subject'}</h3>
              <button onClick={() => setModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X size={20} className="text-gray-400"/></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Subject Name *</label>
                <input 
                  type="text" className="input" required 
                  value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  placeholder="e.g. Data Structures"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Subject Code</label>
                <input 
                  type="text" className="input" 
                  value={form.code} onChange={e => setForm({...form, code: e.target.value})}
                  placeholder="e.g. CS101"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Relevant Departments</label>
                <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto p-2 border border-gray-100 rounded-2xl bg-gray-50/50">
                  {departments.map(d => (
                    <label key={d.dept_id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-white cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                      <input type="checkbox" checked={form.dept_ids.includes(d.dept_id)} onChange={() => toggleDept(d.dept_id)} className="rounded text-blue-600 focus:ring-blue-500" />
                      <span className="text-xs font-semibold text-gray-700 truncate">{d.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Map to Classes <span className="font-normal lowercase">(optional)</span></label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border border-gray-100 rounded-2xl bg-gray-50/50">
                  {classes.map(c => (
                    <button 
                      key={c.class_name} 
                      type="button"
                      onClick={() => toggleClass(c.class_name)}
                      className={`text-[10px] px-3 py-2 rounded-xl border font-bold transition-all text-left flex items-center gap-2 ${form.classes.includes(c.class_name) ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' : 'bg-white text-gray-500 border-gray-100 hover:border-blue-200'}`}
                    >
                      <GraduationCap size={12}/>
                      <span className="truncate">{c.class_name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="submit" className="btn-primary flex-1 py-4 font-bold shadow-lg shadow-blue-200">{editId ? 'Save Changes' : 'Create Subject'}</button>
                <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1 py-4 font-bold text-gray-400">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-red-100">
              <Trash2 size={28} />
            </div>
            <h3 className="font-bold text-2xl text-jspm-navy mb-2">Delete Subject?</h3>
            <p className="text-gray-500 text-sm mb-8">This will remove it from your catalog. It will not affect existing attendance records.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1 py-3 font-bold text-gray-400">Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold transition-colors shadow-lg shadow-red-200">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
