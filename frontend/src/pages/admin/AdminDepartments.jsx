import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Plus, Trash2, Pencil, X, Building2, Users, GraduationCap, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

const empty = { name: '', code: '', description: '' };

export default function AdminDepartments() {
  const [departments, setDepartments] = useState([]);
  const [modal, setModal] = useState(null); 
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [stats, setStats] = useState([]);

  const load = async () => {
    try {
      const [depts, overview] = await Promise.all([
        api.get('/admin/departments'),
        api.get('/admin/overview')
      ]);
      setDepartments(depts.data);
      setStats(overview.data.departments || []);
    } catch (e) { toast.error('Failed to load data'); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(empty); setEditId(null); setModal('edit'); };
  const openEdit = (d) => {
    setForm({ name: d.name, code: d.code || '', description: d.description || '' });
    setEditId(d.dept_id);
    setModal('edit');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name) { toast.error('Name required'); return; }
    setLoading(true);
    try {
      if (editId) {
        await api.patch(`/admin/departments/${editId}`, form);
        toast.success('Department updated');
      } else {
        await api.post('/admin/departments', form);
        toast.success('Department created');
      }
      setModal(null);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/admin/departments/${deleteTarget}`);
      toast.success('Department deleted');
      load();
    } catch { toast.error('Failed to delete department'); }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-jspm-navy">Departments</h1>
          <p className="text-gray-500 mt-1">Manage institutional hierarchy and departmental resources</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 px-6 py-3">
          <Plus size={20}/> Create Department
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {departments.map(d => {
          const s = stats.find(stat => stat.dept_id === d.dept_id) || {};
          return (
            <div key={d.dept_id} className="card group hover:shadow-2xl transition-all border-t-4 border-jspm-blue">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-jspm-blue flex items-center justify-center shadow-inner group-hover:bg-jspm-blue group-hover:text-white transition-colors duration-300">
                  <Building2 size={28} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(d)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Pencil size={18}/></button>
                  <button onClick={() => setDeleteTarget(d.dept_id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-bold text-xl text-jspm-navy group-hover:text-jspm-blue transition-colors">{d.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{d.code || 'NO-CODE'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 py-4 border-t border-gray-50">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Users size={10} /> HODs
                  </div>
                  <div className="text-lg font-bold text-jspm-navy">{s.hod_count || 0}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <GraduationCap size={10} /> Classes
                  </div>
                  <div className="text-lg font-bold text-jspm-navy">{s.class_count || 0}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <BookOpen size={10} /> Subjects
                  </div>
                  <div className="text-lg font-bold text-jspm-navy">{s.subject_count || 0}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Users size={10} /> Students
                  </div>
                  <div className="text-lg font-bold text-jspm-navy">{s.student_count || 0}</div>
                </div>
              </div>
            </div>
          );
        })}
        
        {!departments.length && (
          <div className="card col-span-full py-24 text-center border-dashed">
            <Building2 size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="text-gray-400">No departments found. Start by creating one.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal === 'edit' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-bold text-2xl text-jspm-navy">{editId ? 'Edit Department' : 'New Department'}</h2>
              <button onClick={() => setModal(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X size={24} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">Department Name *</label>
                <input type="text" className="input" placeholder="e.g. Computer Engineering" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} required />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">Department Code</label>
                <input type="text" className="input" placeholder="e.g. COMP" value={form.code} onChange={e => setForm(p => ({...p, code: e.target.value}))} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 mb-2 block uppercase">Description</label>
                <textarea className="input min-h-[100px]" placeholder="Brief description..." value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} />
              </div>
              <div className="flex gap-4">
                <button type="submit" className="btn-primary flex-1 py-4 font-bold" disabled={loading}>{editId ? 'Save Changes' : 'Create Department'}</button>
                <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 py-4 font-bold">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6"><Trash2 size={28} /></div>
            <h3 className="font-bold text-2xl text-jspm-navy mb-2">Delete Department?</h3>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">This will dissociate all HODs, classes, and subjects from this department. This action cannot be undone.</p>
            <div className="flex gap-4">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1 font-bold">Cancel</button>
              <button onClick={handleDelete} className="btn-danger flex-1 font-bold">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
