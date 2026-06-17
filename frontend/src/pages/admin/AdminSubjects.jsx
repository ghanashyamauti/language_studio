import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../api/client';
import { Plus, Trash2, Pencil, X, BookOpen, Hash, Building2, GraduationCap, User } from 'lucide-react';
import toast from 'react-hot-toast';

const empty = { name: '', code: '', department: '', dept_id: '', dept_ids: [], classes: [] };

export default function AdminSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [classList, setClassList] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    try {
      const [s, d, c] = await Promise.all([
        api.get('/admin/subjects'),
        api.get('/admin/departments'),
        api.get('/admin/classes')
      ]);
      setSubjects(s.data || []);
      setDepartments(d.data || []);
      setClassList(c.data || []);
    } catch (e) { toast.error('Failed to load data'); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(empty); setEditId(null); setModal('edit'); };
  const openEdit = (s) => {
    setForm({
      name: s.name,
      code: s.code || '',
      department: s.department || '',
      dept_id: s.dept_id || '',
      dept_ids: s.dept_ids || [],
      classes: s.assigned_classes || []
    });
    setEditId(s.subject_id);
    setModal('edit');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name) { toast.error('Subject name required'); return; }
    setLoading(true);

    const payload = { ...form };
    if (!payload.dept_id) payload.dept_id = null;
    if (payload.code === '') payload.code = null;
    if (payload.department === '') payload.department = null;

    try {
      if (editId) {
        await api.patch(`/admin/subjects/${editId}`, payload);
        toast.success('Subject updated');
      } else {
        await api.post('/admin/subjects', payload);
        toast.success('Subject created');
      }
      setModal(null);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/admin/subjects/${deleteTarget}`);
      toast.success('Subject deleted');
      load();
    } catch { toast.error('Failed to delete subject'); }
    setDeleteTarget(null);
  };

  const toggleClass = (className) => {
    setForm(f => ({
      ...f,
      classes: f.classes.includes(className)
        ? f.classes.filter(c => c !== className)
        : [...f.classes, className]
    }));
  };

  const toggleDept = (deptId) => {
    const id = Number(deptId);
    setForm(f => ({
      ...f,
      dept_ids: f.dept_ids.includes(id)
        ? f.dept_ids.filter(d => d !== id)
        : [...f.dept_ids, id]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-jspm-navy">Course Subjects</h1>
          <p className="text-gray-500 text-sm mt-1">
            Centralized catalog · One subject can be taught across multiple classes & departments
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 px-6 py-3">
          <Plus size={20}/> Create Subject
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subjects.map(s => (
          <div key={s.subject_id} className="card group hover:border-jspm-blue transition-all border-l-4 border-l-jspm-blue">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-jspm-blue flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                  <BookOpen size={22} />
                </div>
                <div>
                  <div className="font-bold text-lg text-jspm-navy leading-tight">{s.name}</div>
                  {s.code && <div className="text-[10px] font-mono text-gray-400 mt-1 bg-gray-100 px-1.5 py-0.5 rounded w-fit font-bold">{s.code}</div>}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(s)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Edit"><Pencil size={16}/></button>
                <button onClick={() => setDeleteTarget(s.subject_id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Delete"><Trash2 size={16}/></button>
              </div>
            </div>

            {/* Department badge */}
            <div className="mt-5 pt-4 border-t border-gray-50 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Building2 size={13} className="text-jspm-blue/60 mt-0.5" />
                <div className="flex flex-wrap gap-1">
                  {(s.dept_names?.length > 0 ? s.dept_names : [s.dept_name || s.department || 'No Department']).map(dn => (
                    <span key={dn} className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                      {dn}
                    </span>
                  ))}
                </div>
              </div>
              
              {s.created_by_name && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 bg-gray-100/30 w-fit px-2 py-0.5 rounded-md">
                  <User size={10} /> Creator: {s.created_by_name}
                </div>
              )}

              {/* Assigned classes - dynamically from TeacherAssignments or explicit mapping */}
              {s.assigned_classes?.length > 0 ? (
                <div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <GraduationCap size={10}/> Assigned Classes
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {s.assigned_classes.map(cls => (
                      <span key={cls} className="text-[10px] font-bold bg-purple-50 text-purple-600 px-2 py-0.5 rounded-md border border-purple-100">
                        {cls}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-gray-300 italic">Not assigned to any class yet</p>
              )}
            </div>
          </div>
        ))}
        {!subjects.length && (
          <div className="card col-span-full text-center py-24 border-dashed bg-gray-50/30">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-gray-200 shadow-sm border border-gray-50">
              <BookOpen size={32} />
            </div>
            <p className="text-gray-400 font-medium">No subjects in the catalog yet.</p>
            <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2 mt-4">
              <Plus size={14}/> Add First Subject
            </button>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modal === 'edit' && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="font-bold text-jspm-navy text-2xl">{editId ? 'Edit Subject' : 'New Subject'}</h2>
                <p className="text-gray-400 text-sm mt-1">
                  {editId ? 'Update subject details' : 'Add to the shared subject catalog'}
                </p>
              </div>
              <button onClick={() => setModal(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X size={24} className="text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-2 uppercase tracking-wider">
                  <BookOpen size={14} className="text-jspm-blue" /> Subject Name *
                </label>
                <input type="text" className="input" placeholder="e.g. Data Structures" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} required />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-2 uppercase tracking-wider">
                  <Hash size={14} className="text-jspm-blue" /> Subject Code
                </label>
                <input type="text" className="input" placeholder="e.g. CS302" value={form.code} onChange={e => setForm(p => ({...p, code: e.target.value}))} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-2 uppercase tracking-wider">
                  <Building2 size={14} className="text-jspm-blue" /> Departments <span className="text-gray-400 font-normal lowercase">(at least one)</span>
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto p-2 border border-gray-100 rounded-xl bg-gray-50/50">
                  {departments.map(d => (
                    <label key={d.dept_id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                      <input type="checkbox" checked={form.dept_ids.includes(d.dept_id)} onChange={() => toggleDept(d.dept_id)} className="rounded text-jspm-blue" />
                      <span className="text-xs font-medium text-gray-700 truncate">{d.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-2 uppercase tracking-wider">
                  <GraduationCap size={14} className="text-jspm-blue" /> Assign to Classes <span className="text-gray-400 font-normal lowercase">(optional)</span>
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-gray-100 rounded-xl bg-gray-50/50">
                  {classList.map(c => (
                    <label key={c.class_name} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                      <input type="checkbox" checked={form.classes.includes(c.class_name)} onChange={() => toggleClass(c.class_name)} className="rounded text-jspm-blue" />
                      <span className="text-xs font-medium text-gray-700 truncate">{c.class_name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="submit" className="btn-primary flex-1 py-4 font-bold shadow-lg shadow-jspm-blue/20" disabled={loading}>
                  {editId ? 'Save Changes' : 'Create Subject'}
                </button>
                <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 py-4 font-bold">Cancel</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirm */}
      {deleteTarget && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-red-200">
              <Trash2 size={28} />
            </div>
            <h3 className="font-bold text-2xl text-jspm-navy mb-2">Delete Subject?</h3>
            <p className="text-gray-500 text-sm mb-8">This will remove it from the catalog. Teacher assignments using this subject will remain but the subject won't appear in new dropdowns.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1 py-3 font-bold">Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold transition-colors">Delete</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
