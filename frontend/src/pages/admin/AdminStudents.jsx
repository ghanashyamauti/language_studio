import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../api/client';
import { Users, Plus, X, Search, GraduationCap, Hash, Trash2, Pencil, Lock, Building2, Layers, User, Table, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import BulkImportModal from '../../components/admin/BulkImportModal';

const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads/')) {
    const base = api.defaults.baseURL || '';
    return `${base}${url}`;
  }
  return url;
};

function StudentAvatar({ src, name }) {
  const [hasError, setHasError] = useState(false);
  if (src && !hasError) {
    return (
      <img 
        src={getImageUrl(src)} 
        alt={name} 
        className="w-12 h-12 rounded-2xl object-cover shadow-inner group-hover:scale-110 transition-transform flex-shrink-0"
        onError={() => setHasError(true)} 
      />
    );
  }
  return (
    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform flex-shrink-0">
      <GraduationCap size={24}/>
    </div>
  );
}

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  
  const [filters, setFilters] = useState({
    dept_id: '',
    class_name: '',
    search: ''
  });

  const [form, setForm] = useState({
    name: '',
    roll_no: '',
    prn: '',
    class_: '',
    semester: 2,
    password: '',
    subjects: []
  });

  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const fetchClassSubjects = async (className) => {
    if (!className) {
      setAvailableSubjects([]);
      return;
    }
    setLoadingSubjects(true);
    try {
      const res = await api.get(`/admin/classes/${className}/subjects`);
      setAvailableSubjects(res.data || []);
    } catch {
      toast.error('Failed to load class subjects');
    } finally {
      setLoadingSubjects(false);
    }
  };

  const handleClassChange = (className) => {
    setForm(prev => ({ ...prev, class_: className, subjects: [] }));
    fetchClassSubjects(className);
  };

  const loadMetadata = async () => {
    try {
      const [deptRes, classRes] = await Promise.all([
        api.get('/admin/departments'),
        api.get('/admin/classes')
      ]);
      setDepartments(deptRes.data || []);
      setClasses(classRes.data || []);
    } catch (e) {
      toast.error('Failed to load metadata');
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/students', {
        params: {
          dept_id: filters.dept_id || undefined,
          class_name: filters.class_name || undefined,
          search: filters.search || undefined
        }
      });
      setStudents(res.data || []);
    } catch {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [filters.dept_id, filters.class_name]);

  const handleSearch = (e) => {
    if (e.key === 'Enter') fetchStudents();
  };

  const resetForm = () => {
    setForm({ name: '', roll_no: '', prn: '', class_: '', semester: 2, password: '', subjects: [] });
    setAvailableSubjects([]);
    setEditMode(false);
    setSelectedStudent(null);
  };

  const openCreate = () => {
    resetForm();
    setModal(true);
  };

  const openEdit = (s) => {
    setForm({
      name: s.name,
      roll_no: s.roll_no,
      prn: s.prn || '',
      class_: s.class_,
      semester: s.semester,
      password: '',
      subjects: s.subjects || []
    });
    setSelectedStudent(s);
    setEditMode(true);
    setModal(true);
    if (s.class_) {
      fetchClassSubjects(s.class_);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subjects || form.subjects.length === 0) {
      toast.error('Please select at least one subject');
      return;
    }
    try {
      if (editMode && selectedStudent) {
        await api.patch(`/admin/students/${selectedStudent.student_id}`, form);
        toast.success('Student updated');
      } else {
        await api.post('/admin/students', form);
        toast.success('Student created');
      }
      setModal(false);
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save student');
    }
  };

  const handleResetPassword = async (student_id) => {
    if (!window.confirm('Reset password to default "Test@123"?')) return;
    try {
      await api.post(`/admin/students/${student_id}/reset-password`);
      toast.success('Password reset to Test@123');
    } catch {
      toast.error('Failed to reset password');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this student?')) return;
    try {
      await api.delete(`/admin/students/${id}`);
      toast.success('Student deleted');
      fetchStudents();
    } catch {
      toast.error('Failed to delete student');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-jspm-navy">Student Management</h1>
          <p className="text-gray-500 mt-1">View and manage all students in the university</p>
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

      {/* Filters */}
      <div className="card grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 block">Department</label>
          <select 
            className="input text-sm"
            value={filters.dept_id}
            onChange={e => setFilters({...filters, dept_id: e.target.value, class_name: ''})}
          >
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.dept_id} value={d.dept_id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 block">Class</label>
          <select 
            className="input text-sm"
            value={filters.class_name}
            onChange={e => setFilters({...filters, class_name: e.target.value})}
          >
            <option value="">All Classes</option>
            {classes
              .filter(c => !filters.dept_id || c.dept_id === parseInt(filters.dept_id))
              .map(c => <option key={c.class_name} value={c.class_name}>{c.class_name}</option>)
            }
          </select>
        </div>
        <div className="md:col-span-2 relative">
          <label className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 block">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
            <input 
              type="text" 
              placeholder="Search name or roll number... (Press Enter)" 
              className="input pl-10" 
              value={filters.search}
              onChange={e => setFilters({...filters, search: e.target.value})}
              onKeyDown={handleSearch}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-jspm-blue border-t-transparent rounded-full animate-spin"/></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {students.map(s => (
            <div key={s.student_id} className="card group hover:border-jspm-blue transition-all border-l-4 border-emerald-500 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-4">
                  <StudentAvatar src={s.profile_photo} name={s.name} />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-jspm-navy text-lg truncate leading-tight" title={s.name}>{s.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold text-gray-400 flex items-center gap-1"><Hash size={12}/> {s.roll_no}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <div className="px-2.5 py-1 bg-blue-50 text-jspm-blue rounded-lg text-[10px] font-bold flex items-center gap-1.5">
                    <Building2 size={12}/> {s.class_}
                  </div>
                  <div className="px-2.5 py-1 bg-purple-50 text-purple-600 rounded-lg text-[10px] font-bold">
                    Semester {s.semester}
                  </div>
                  {s.created_by_name && (
                    <div className="px-2.5 py-1 bg-gray-50 text-gray-400 rounded-lg text-[10px] font-bold border border-gray-100 italic">
                      By: {s.created_by_name}
                    </div>
                  )}
                </div>

                {s.subjects && s.subjects.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1 border-t border-gray-100 pt-3">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block w-full mb-0.5">Enrolled Subjects:</span>
                    {s.subjects.map(subName => (
                      <span key={subName} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-medium border border-slate-200">
                        {subName}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleResetPassword(s.student_id)} className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all" title="Reset Password"><Lock size={16}/></button>
                <button onClick={() => openEdit(s)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Edit Info"><Pencil size={16}/></button>
                <button onClick={() => handleDelete(s.student_id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Delete"><Trash2 size={16}/></button>
              </div>
            </div>
          ))}
          {students.length === 0 && (
            <div className="col-span-full py-20 text-center card bg-white border-dashed">
              <div className="text-gray-400 font-medium">No students found with current filters.</div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-2xl text-jspm-navy">{editMode ? 'Edit Student' : 'Add Student'}</h2>
              <button onClick={() => setModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X size={24} className="text-gray-400" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-500 mb-1.5 block uppercase">Full Name *</label>
                <input 
                  type="text" className="input" required 
                  value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  placeholder="e.g. Rahul Sharma"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 mb-1.5 block uppercase">Roll Number *</label>
                  <input 
                    type="text" className="input" required 
                    value={form.roll_no} onChange={e => setForm({...form, roll_no: e.target.value})}
                    placeholder="e.g. T23CO01"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 mb-1.5 block uppercase">PRN (Optional)</label>
                  <input 
                    type="text" className="input" 
                    value={form.prn} onChange={e => setForm({...form, prn: e.target.value})}
                    placeholder="University PRN"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 mb-1.5 block uppercase">Class *</label>
                <select 
                  className="input" required
                  value={form.class_} onChange={e => handleClassChange(e.target.value)}
                >
                  <option value="">— Select Class —</option>
                  {classes.map(c => <option key={c.class_name} value={c.class_name}>{c.class_name}</option>)}
                </select>
              </div>

              {form.class_ && (
                <div>
                  <label className="text-[10px] font-bold text-gray-500 mb-1.5 block uppercase">Subjects (Select Multiple) *</label>
                  {loadingSubjects ? (
                    <div className="text-xs text-gray-400">Loading subjects...</div>
                  ) : availableSubjects.length === 0 ? (
                    <div className="text-xs text-red-500 font-medium">No subjects assigned to this class yet. Please add subjects to the class first.</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border border-gray-100 rounded-xl bg-gray-50/50">
                      {availableSubjects.map(subName => {
                        const checked = form.subjects.includes(subName);
                        return (
                          <label key={subName} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:bg-gray-100/50 p-1 rounded transition-colors">
                            <input 
                              type="checkbox" 
                              checked={checked}
                              onChange={() => {
                                const nextSubjects = checked 
                                  ? form.subjects.filter(s => s !== subName)
                                  : [...form.subjects, subName];
                                setForm(p => ({ ...p, subjects: nextSubjects }));
                              }}
                              className="rounded border-gray-300 text-jspm-blue focus:ring-jspm-blue"
                            />
                            <span className="truncate">{subName}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="text-[10px] font-bold text-gray-500 mb-1.5 block uppercase">Semester *</label>
                <input 
                  type="number" className="input" required 
                  value={form.semester} onChange={e => setForm({...form, semester: parseInt(e.target.value)})}
                  min="1" max="8"
                />
              </div>

              {editMode && (
                <div>
                  <label className="text-[10px] font-bold text-gray-500 mb-1.5 block uppercase text-jspm-blue">Change Password (Optional)</label>
                  <input 
                    type="password" className="input border-jspm-blue/30" 
                    value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                    placeholder="Leave blank to keep current"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1 py-3">Cancel</button>
                <button type="submit" className="btn-primary flex-1 py-3 shadow-lg shadow-jspm-blue/20">{editMode ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {/* Bulk Import Modal */}
      <BulkImportModal 
        isOpen={importModal} 
        onClose={() => setImportModal(false)} 
        type="student"
        classes={classes}
        departments={departments}
        onSuccess={fetchStudents}
      />
    </div>
  );
}
