import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../api/client';
import { Plus, Trash2, Pencil, X, Shield, Key, BookOpen, GraduationCap, Building2, User, ChevronDown, Table } from 'lucide-react';
import toast from 'react-hot-toast';
import BulkImportModal from '../../components/admin/BulkImportModal';

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [modal, setModal] = useState(null); 
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', dept_id: '' });
  const [newAssign, setNewAssign] = useState({ subject: '', class_name: '' });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const [t, s, d, c] = await Promise.all([
        api.get('/admin/teachers'),
        api.get('/admin/subjects'),
        api.get('/admin/departments'),
        api.get('/admin/classes')
      ]);
      setTeachers(t.data);
      setSubjectList(s.data);
      setDepartments(d.data);
      setClasses(c.data.map(cl => cl.class_name));
    } catch (e) { toast.error('Failed to load data'); }
  };

  useEffect(() => { load(); }, []);

  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setForm(p => ({ ...p, phone: val }));
  };

  const openCreate = () => {
    setForm({ name: '', phone: '', email: '', password: '', dept_id: '' });
    setEditId(null);
    setModal('edit');
  };

  const openEdit = (t) => {
    setForm({ name: t.name, phone: t.phone, email: t.email || '', password: '', dept_id: t.dept_id || '' });
    setEditId(t.teacher_id);
    setModal('edit');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const cleanedPhone = form.phone.replace(/\D/g, '');
    if (cleanedPhone.length !== 10 || form.phone.length !== 10) {
      toast.error('Phone number must be exactly 10 digits');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      toast.error('Invalid email address');
      return;
    }
    setLoading(true);
    const payload = { ...form, phone: cleanedPhone };
    if (!payload.dept_id) payload.dept_id = null;
    if (editId && !payload.password) delete payload.password;
    try {
      if (editId) {
        await api.patch(`/admin/teachers/${editId}`, payload);
        toast.success('Teacher updated');
      } else {
        await api.post('/admin/teachers', payload);
        toast.success('Teacher account created');
      }
      setModal(null);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this teacher?')) return;
    try {
      await api.delete(`/admin/teachers/${id}`);
      toast.success('Teacher deleted');
      load();
    } catch { toast.error('Failed to delete teacher'); }
  };

  const handleAddAssignment = async () => {
    if (!newAssign.subject || !newAssign.class_name) return toast.error('Select both subject and class');
    try {
      await api.post(`/admin/teachers/${editId}/assignments`, { ...newAssign, teacher_id: editId });
      toast.success('Assignment added');
      setNewAssign({ subject: '', class_name: '' });
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
  };

  const handleRemoveAssignment = async (tid, aid) => {
    try {
      await api.delete(`/admin/teachers/${tid}/assignments/${aid}`);
      toast.success('Assignment removed');
      load();
    } catch { toast.error('Failed to remove assignment'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-jspm-navy">Teacher Management</h1>
          <p className="text-gray-500 mt-1">Manage teacher accounts and departmental assignments</p>
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowChoiceModal(true)} 
            className="btn-primary flex items-center gap-2 px-6 py-3 shadow-lg shadow-jspm-blue/20 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={20}/> Add Teacher <ChevronDown size={16} className="opacity-50" />
          </button>

          {showChoiceModal && (
            <>
              <div className="fixed inset-0 z-[55]" onClick={() => setShowChoiceModal(false)} />
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 z-[60] animate-in fade-in zoom-in duration-200">
                <button 
                  onClick={() => { setShowChoiceModal(false); openCreate(); }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-blue-50 text-jspm-navy rounded-xl transition-colors text-left"
                >
                  <div className="w-8 h-8 bg-blue-100 text-jspm-blue rounded-lg flex items-center justify-center flex-shrink-0">
                    <User size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold">Single Teacher</div>
                    <div className="text-[10px] text-gray-400">Create manually</div>
                  </div>
                </button>
                <button 
                  onClick={() => { setShowChoiceModal(false); setImportModal(true); }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-emerald-50 text-jspm-navy rounded-xl transition-colors text-left"
                >
                  <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Table size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold">Bulk Import</div>
                    <div className="text-[10px] text-gray-400">CSV / Excel file</div>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teachers.map(t => (
          <div key={t.teacher_id} className="card group hover:border-jspm-blue transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform font-black">
                  {t.name[0]}
                </div>
                <div>
                  <h3 className="font-bold text-jspm-navy text-lg leading-tight">{t.name}</h3>
                  <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                    <div>{t.phone || 'No phone'}</div>
                    {t.email && <div className="text-[11px] text-gray-500 font-medium">{t.email}</div>}
                  </div>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(t)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Pencil size={16}/></button>
                <button onClick={() => handleDelete(t.teacher_id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16}/></button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-jspm-blue bg-blue-50 w-fit px-2 py-1 rounded-lg">
                <Building2 size={12} /> {t.dept_name || 'General / Not Assigned'}
              </div>

              {t.created_by_name && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 bg-gray-100/50 w-fit px-2 py-0.5 rounded-md">
                  <User size={10} /> Creator: {t.created_by_name}
                </div>
              )}
              
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-50">
                {t.assignments?.slice(0, 3).map((a, i) => (
                  <span key={i} className="px-2 py-1 bg-gray-50 text-gray-500 rounded text-[10px] font-bold border border-gray-100">
                    {a.subject} · {a.class}
                  </span>
                ))}
                {t.assignments?.length > 3 && <span className="text-[10px] text-gray-400 font-bold">+{t.assignments.length - 3} more</span>}
                {!t.assignments?.length && <span className="text-[10px] text-gray-300 italic">No assignments yet</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal === 'edit' && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-bold text-2xl text-jspm-navy">{editId ? 'Edit Teacher' : 'New Teacher Account'}</h2>
              <button onClick={() => setModal(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X size={24} className="text-gray-400" /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h3 className="text-sm font-bold text-jspm-navy flex items-center gap-2 uppercase tracking-wider"><Shield size={16} /> Profile Details</h3>
                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 mb-1.5 block uppercase">Full Name *</label>
                    <input type="text" className="input" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} required />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 mb-1.5 block uppercase">Phone Number *</label>
                    <input 
                      type="text" 
                      className="input" 
                      value={form.phone} 
                      onChange={handlePhoneChange} 
                      required 
                      placeholder="e.g. 9876543210" 
                      maxLength={10} 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 mb-1.5 block uppercase">Email Address *</label>
                    <input 
                      type="email" 
                      className="input" 
                      value={form.email} 
                      onChange={e => setForm(p => ({...p, email: e.target.value}))} 
                      required 
                      placeholder="e.g. name@domain.com" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 mb-1.5 block uppercase">Primary Department</label>
                    <select className="input" value={form.dept_id} onChange={e => setForm(p => ({...p, dept_id: e.target.value}))}>
                      <option value="">— Select Department —</option>
                      {departments.map(d => <option key={d.dept_id} value={d.dept_id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 mb-1.5 block uppercase">
                      {editId ? 'Change Password (Optional)' : 'Initial Password *'}
                    </label>
                    <input 
                      type="password" 
                      className="input" 
                      value={form.password} 
                      onChange={e => setForm(p => ({...p, password: e.target.value}))} 
                      required={!editId} 
                      placeholder={editId ? "Leave blank to keep current" : ""}
                    />
                  </div>
                  <button type="submit" className="btn-primary w-full py-4 shadow-lg shadow-jspm-blue/20 font-bold" disabled={loading}>
                    {editId ? 'Update Profile' : 'Create Teacher'}
                  </button>
                </form>
              </div>

              {editId && (
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-jspm-navy flex items-center gap-2 uppercase tracking-wider"><BookOpen size={16} /> Course Assignments</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {teachers.find(t => t.teacher_id === editId)?.assignments?.map(a => (
                      <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="text-xs">
                          <div className="font-bold text-jspm-navy">{a.subject}</div>
                          <div className="text-gray-500 font-medium">{a.class}</div>
                        </div>
                        <button onClick={() => handleRemoveAssignment(editId, a.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={14} /></button>
                      </div>
                    ))}
                    {!teachers.find(t => t.teacher_id === editId)?.assignments?.length && <p className="text-xs text-gray-400 text-center py-6 bg-gray-50 rounded-2xl border border-dashed">No assignments configured.</p>}
                  </div>

                  <div className="pt-4 border-t border-gray-100 space-y-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Add Assignment</p>
                    <div className="flex flex-col gap-2">
                      <select className="input text-sm w-full" value={newAssign.class_name} onChange={e => setNewAssign(p => ({...p, class_name: e.target.value, subject: ''}))}>
                        <option value="">1. Select Class</option>
                        {classes.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <select className="input text-sm flex-1" value={newAssign.subject} onChange={e => setNewAssign(p => ({...p, subject: e.target.value}))} disabled={!newAssign.class_name}>
                          <option value="">2. Select Subject</option>
                          {subjectList.map(s => <option key={s.subject_id} value={s.name}>{s.name}</option>)}
                        </select>
                        <button onClick={handleAddAssignment} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all text-xs disabled:opacity-50" disabled={!newAssign.subject || !newAssign.class_name}>Add</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Bulk Import Modal */}
      <BulkImportModal 
        isOpen={importModal} 
        onClose={() => setImportModal(false)} 
        type="teacher"
        onSuccess={load}
      />
    </div>
  );
}
