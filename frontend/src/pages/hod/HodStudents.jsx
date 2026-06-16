import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Users, Plus, X, Search, GraduationCap, Phone, Hash, Trash2, Lock, ChevronDown, User, Table, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import BulkImportModal from '../../components/admin/BulkImportModal';

export default function HodStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState({ name: '', roll_no: '', prn: '', class_: '', semester: 2, password: '' });

  const load = async () => {
    try {
      const dashRes = await api.get('/hod/dashboard');
      setClasses(dashRes.data.classes || []);
      setLoading(false);
    } catch { setLoading(false); }
  };

  const fetchAllStudents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/hod/students', {
        params: { class_: selectedClass || undefined }
      });
      setStudents(res.data || []);
    } catch { toast.error('Failed to load students'); }
    finally { setLoading(false); }
  };

  useEffect(() => { 
    load(); 
  }, []);

  useEffect(() => {
    fetchAllStudents();
  }, [selectedClass]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editMode && selectedStudent) {
        await api.put(`/hod/students/${selectedStudent.student_id}`, form);
        toast.success('Student updated successfully');
      } else {
        await api.post('/hod/students', form);
        toast.success('Student added successfully');
      }
      setModal(false);
      resetForm();
      fetchAllStudents();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save student');
    }
  };

  const resetForm = () => {
    setForm({ name: '', roll_no: '', prn: '', class_: '', semester: 2, password: '' });
    setEditMode(false);
    setSelectedStudent(null);
  };

  const handleEdit = (s) => {
    setForm({
      name: s.name,
      roll_no: s.roll_no,
      prn: s.prn || '',
      class_: s.class_,
      semester: s.semester,
      password: ''
    });
    setSelectedStudent(s);
    setEditMode(true);
    setModal(true);
  };

  const handleResetPassword = async (student_id) => {
    if (!window.confirm('Reset password to default "Test@123"?')) return;
    try {
      await api.post(`/hod/students/${student_id}/reset-password`);
      toast.success('Password reset to Test@123');
    } catch { toast.error('Failed to reset password'); }
  };

  const handleDelete = async (student_id) => {
    if (!window.confirm('Are you sure you want to delete this student?')) return;
    try {
      await api.delete(`/hod/students/${student_id}`);
      toast.success('Student deleted');
      fetchAllStudents();
    } catch { toast.error('Failed to delete student'); }
  };

  const filtered = students.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.roll_no.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    resetForm();
    setModal(true);
  };

  if (loading && students.length === 0) return <div className="flex justify-center h-48 items-center"><div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"/></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-jspm-navy">Manage Students</h1>
          <p className="text-gray-500 text-sm">Add and view students across your classes</p>
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowChoiceModal(true)} 
            className="btn-primary flex items-center gap-2 px-6 py-3 shadow-lg shadow-jspm-blue/20 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={20}/> Add Student <ChevronDown size={16} className="opacity-50" />
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
                    <div className="text-xs font-bold">Single Student</div>
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

      <div className="card mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
          <input 
            type="text" 
            placeholder="Search by name or roll no..." 
            className="input pl-10" 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full md:w-64">
          <select 
            className="input"
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
          >
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.class_name} value={c.class_name}>{c.class_name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(s => (
          <div key={s.student_id} className="card hover:shadow-md transition-shadow p-5 border-l-4 border-emerald-500 relative group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                <GraduationCap size={24}/>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-jspm-navy truncate">{s.name}</h3>
                <div className="text-xs text-gray-500 mt-1 flex flex-col gap-1">
                  <span className="flex items-center gap-1.5"><Hash size={12}/> {s.roll_no}</span>
                  <span className="flex items-center gap-1.5 font-semibold text-jspm-blue">{s.class_} · Sem {s.semester}</span>
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => handleResetPassword(s.student_id)} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Reset Password">
                <Lock size={16}/>
              </button>
              <button onClick={() => handleEdit(s)} className="p-2 text-jspm-blue hover:bg-blue-50 rounded-lg transition-colors" title="Edit Info">
                <Pencil size={16}/>
              </button>
              <button onClick={() => handleDelete(s.student_id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                <Trash2 size={16}/>
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
            No students found.
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-xl text-jspm-navy">{editMode ? 'Edit Student' : 'Add New Student'}</h3>
              <button onClick={() => setModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400"/></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input 
                  type="text" className="input" required 
                  value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  placeholder="e.g. Rahul Sharma"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Roll Number</label>
                  <input 
                    type="text" className="input" required 
                    value={form.roll_no} onChange={e => setForm({...form, roll_no: e.target.value})}
                    placeholder="e.g. T23CO01"
                  />
                </div>
                <div>
                  <label className="label">PRN (Optional)</label>
                  <input 
                    type="text" className="input" 
                    value={form.prn} onChange={e => setForm({...form, prn: e.target.value})}
                    placeholder="University PRN"
                  />
                </div>
              </div>
              <div>
                <label className="label">Class</label>
                <select 
                  className="input" required
                  value={form.class_} onChange={e => setForm({...form, class_: e.target.value})}
                >
                  <option value="">— Select Class —</option>
                  {classes.map(c => <option key={c.class_name} value={c.class_name}>{c.class_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Semester</label>
                <input 
                  type="number" className="input" required 
                  value={form.semester} onChange={e => setForm({...form, semester: parseInt(e.target.value)})}
                  min="1" max="8"
                />
              </div>

              {editMode && (
                <div>
                  <label className="label">New Password (leave blank to keep current)</label>
                  <input 
                    type="password" className="input" 
                    value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                    placeholder="Min 6 characters"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">{editMode ? 'Update Student' : 'Create Student'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Bulk Import Modal */}
      <BulkImportModal 
        isOpen={importModal} 
        onClose={() => setImportModal(false)} 
        type="student"
        classes={classes}
        onSuccess={fetchAllStudents}
        apiUrlPrefix="/hod"
      />
    </div>
  );
}
