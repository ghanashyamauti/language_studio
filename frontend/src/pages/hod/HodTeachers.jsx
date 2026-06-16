import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Shield, Plus, X, Phone, User, Search, Trash2, Pencil, BookOpen, ChevronDown, Table } from 'lucide-react';
import toast from 'react-hot-toast';
import BulkImportModal from '../../components/admin/BulkImportModal';

export default function HodTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [classList, setClassList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', password: '' });
  const [newAssign, setNewAssign] = useState({ subject: '', class_name: '' });
  const [stagedAssigns, setStagedAssigns] = useState([]);

  const load = async () => {
    try {
      const [dashRes, subRes] = await Promise.all([
        api.get('/hod/dashboard'),
        api.get('/hod/subjects')
      ]);
      setTeachers(dashRes.data.all_teachers || []);
      setClassList(dashRes.data.classes || []);
      setSubjectList(subRes.data || []);
      setLoading(false);
    } catch { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm({ name: '', phone: '', password: 'Teacher@123' });
    setEditId(null);
    setStagedAssigns([]);
    setModal(true);
  };

  const openEdit = (t) => {
    setForm({ name: t.name, phone: t.phone, password: '' });
    setEditId(t.teacher_id);
    setStagedAssigns([]);
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await api.patch(`/hod/teachers/${editId}`, {
          name: form.name,
          phone: form.phone
        });
        toast.success('Teacher profile updated');
      } else {
        await api.post('/hod/teachers', {
          ...form,
          assignments: stagedAssigns
        });
        toast.success('Teacher created with assignments');
      }
      setModal(false);
      setForm({ name: '', phone: '', password: '' });
      setStagedAssigns([]);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save teacher');
    }
  };

  const handleAddAssignment = async () => {
    if (!newAssign.subject || !newAssign.class_name) return toast.error('Select both subject and class');
    
    if (editId) {
      // Direct addition for existing teacher
      try {
        await api.post(`/hod/teachers/${editId}/assignments`, { 
          ...newAssign, 
          teacher_id: editId 
        });
        toast.success('Assignment added');
        setNewAssign({ subject: '', class_name: '' });
        load();
      } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
    } else {
      // Stage for new teacher
      if (stagedAssigns.find(a => a.subject === newAssign.subject && a.class_name === newAssign.class_name)) {
        return toast.error('Duplicate in staged list');
      }
      setStagedAssigns([...stagedAssigns, { ...newAssign }]);
      setNewAssign({ subject: '', class_name: '' });
    }
  };

  const handleRemoveAssignment = async (tid, aid, stagedIdx) => {
    if (editId) {
      try {
        await api.delete(`/hod/teachers/${tid}/assignments/${aid}`);
        toast.success('Assignment removed');
        load();
      } catch { toast.error('Failed to remove assignment'); }
    } else {
      setStagedAssigns(stagedAssigns.filter((_, i) => i !== stagedIdx));
    }
  };

  const handleDeleteTeacher = async (id) => {
    if (!window.confirm('Delete this teacher? This will also remove all their assignments.')) return;
    try {
      await api.delete(`/hod/teachers/${id}`);
      toast.success('Teacher deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete teacher');
    }
  };

  const filtered = teachers.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.phone?.includes(search)
  );

  const currentTeacher = editId ? teachers.find(t => t.teacher_id === editId) : null;
  const assignmentsToDisplay = editId ? (currentTeacher?.assignments || []) : stagedAssigns;

  if (loading) return <div className="flex justify-center h-48 items-center"><div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"/></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-jspm-navy">Manage Teachers</h1>
          <p className="text-gray-500 text-sm">Add and manage assignments for teachers in your department</p>
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
                    <div className="text-[10px] text-gray-400">Manual entry</div>
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

      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
          <input 
            type="text" 
            placeholder="Search by name or phone..." 
            className="input pl-10" 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(t => (
          <div key={t.teacher_id} className="card group hover:shadow-md transition-shadow p-5 border-l-4 border-purple-500 relative">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                <User size={24}/>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-jspm-navy truncate">{t.name}</h3>
                <div className="flex items-center gap-1.5 text-gray-500 text-xs mt-1">
                  <span className="px-1.5 py-0.5 bg-gray-100 rounded-md font-bold uppercase tracking-wider text-[10px]">
                    {t.dept_name || 'General'}
                  </span>
                  <span>{t.phone || 'No phone'}</span>
                </div>
                
                {t.assignments?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-50 flex flex-wrap gap-1">
                    {t.assignments.map((a, i) => (
                      <span key={i} className="text-[10px] font-bold bg-purple-50 text-purple-600 px-2 py-0.5 rounded-md border border-purple-100">
                        {a.subject} · {a.class}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(t)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Pencil size={16}/></button>
                <button onClick={() => handleDeleteTeacher(t.teacher_id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16}/></button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
            No teachers found.
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-xl text-jspm-navy">{editId ? 'Edit Teacher' : 'Add New Teacher'}</h3>
              <button onClick={() => setModal(false)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors"><X size={20} className="text-gray-400"/></button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-500 uppercase flex items-center gap-2"><Shield size={14}/> Profile</h4>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Full Name</label>
                    <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Phone Number</label>
                    <input className="input" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} required />
                  </div>
                  {!editId && (
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Password</label>
                      <input type="text" className="input" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} 
                        placeholder="Teacher@123" required />
                    </div>
                  )}
                  {editId && (
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-[10px] text-blue-600 font-medium leading-relaxed italic">
                        Note: Password management is restricted to Admin only for security purposes.
                      </p>
                    </div>
                  )}
                  <button type="submit" className="btn-primary w-full py-3 shadow-lg shadow-jspm-blue/20">
                    {editId ? 'Save Profile' : 'Create Teacher'}
                  </button>
                </form>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-500 uppercase flex items-center gap-2"><BookOpen size={14}/> {editId ? 'Current Assignments' : 'Assign While Creating'}</h4>
                
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {assignmentsToDisplay.map((a, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="text-[11px]">
                        <div className="font-bold text-jspm-navy">{a.subject}</div>
                        <div className="text-gray-500 font-medium">{a.class || a.class_name}</div>
                      </div>
                      <button onClick={() => handleRemoveAssignment(editId, a.id || a.assignment_id, i)} 
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {assignmentsToDisplay.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-6 bg-gray-50 rounded-xl border border-dashed">No assignments {editId ? 'yet' : 'staged'}.</p>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Add Assignment</p>
                  <div className="space-y-2">
                    <select className="input text-sm" value={newAssign.class_name} onChange={e => setNewAssign(p => ({...p, class_name: e.target.value}))}>
                      <option value="">Select Class</option>
                      {classList.map(c => <option key={c.class_name} value={c.class_name}>{c.class_name}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <select className="input text-sm flex-1" value={newAssign.subject} onChange={e => setNewAssign(p => ({...p, subject: e.target.value}))} disabled={!newAssign.class_name}>
                        <option value="">Select Subject</option>
                        {subjectList.map(s => <option key={s.subject_id} value={s.name}>{s.name}</option>)}
                      </select>
                      <button onClick={handleAddAssignment} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all text-xs disabled:opacity-50" 
                        disabled={!newAssign.subject || !newAssign.class_name}>Add</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Bulk Import Modal */}
      <BulkImportModal 
        isOpen={importModal} 
        onClose={() => setImportModal(false)} 
        type="teacher"
        onSuccess={load}
        apiUrlPrefix="/hod"
      />
    </div>
  );
}
