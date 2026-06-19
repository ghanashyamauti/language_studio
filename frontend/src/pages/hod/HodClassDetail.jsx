import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { ArrowLeft, Users, BookOpen, Trash2, UserPlus, Upload, X, Download, KeyRound, Table, FileText, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import Pagination from '../../components/Pagination';

export default function HodClassDetail() {
  const { className } = useParams();
  const navigate = useNavigate();
  const [classData, setClassData] = useState(null);
  const [allTeachers, setAllTeachers] = useState([]);
  const [subjectCatalog, setSubjectCatalog] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [tab, setTab] = useState('students');
  const [assignForm, setAssignForm] = useState({ subject: '', teacher_id: '' });
  const [importText, setImportText] = useState('');
  const [importModal, setImportModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteStudent, setDeleteStudent] = useState(null);
  const [resetPassword, setResetPassword] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [createStudentModal, setCreateStudentModal] = useState(false);
  const [studentForm, setStudentForm] = useState({ roll_no: '', prn: '', name: '', password: '', subjects: [] });

  const load = async () => {
    const [classesRes, dashRes, subjectsRes] = await Promise.all([
      api.get('/hod/classes'),
      api.get('/hod/dashboard'),
      api.get('/hod/subjects'),
    ]);
    const found = (classesRes.data || []).find(c => c.class_name === className);
    setClassData(found || null);
    setAllTeachers(dashRes.data.all_teachers || []);
    setSubjectCatalog(subjectsRes.data || []);
    setAlerts((dashRes.data.low_attendance_alerts || []).filter(a => a.class_ === className));
    setLoading(false);
  };
  useEffect(() => { load(); }, [className]);

  // FIX: use student_id (integer PK) not roll_no string
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error('Password must be at least 6 characters');
    try {
      await api.post(`/hod/students/${resetPassword.student_id}/reset-password`, { new_password: newPassword });
      toast.success(`Password updated for ${resetPassword.name}`);
      setResetPassword(null);
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset password');
    }
  };

  const handleRemoveStudent = async () => {
    if (!deleteStudent) return;
    try {
      await api.post('/hod/students/remove', { student_id: deleteStudent.student_id });
      toast.success(`${deleteStudent.name} removed`);
      setDeleteStudent(null);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Error removing student'); }
  };

  // FIX: use teacher_id directly
  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assignForm.subject || !assignForm.teacher_id) { toast.error('Select teacher and enter subject'); return; }
    try {
      await api.post('/hod/assign-teacher', {
        class_name: className,
        subject: assignForm.subject,
        teacher_id: parseInt(assignForm.teacher_id),
      });
      toast.success('Teacher assigned');
      setAssignForm({ subject: '', teacher_id: '' });
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
  };

  const handleUnassign = async (assignmentId) => {
    if (!confirm('Unassign this teacher?')) return;
    try {
      await api.delete('/hod/assign-teacher', { params: { assignment_id: assignmentId } });
      toast.success('Unassigned');
      load();
    } catch { toast.error('Error unassigning'); }
  };

  const [importMethod, setImportMethod] = useState('paste');
  const [file, setFile] = useState(null);

  const handleImport = async () => {
    if (importMethod === 'paste' && !importText.trim()) { toast.error('Paste student data first'); return; }
    if (importMethod === 'file' && !file) { toast.error('Please select a file'); return; }
    
    try {
      let r;
      if (importMethod === 'paste') {
        r = await api.post('/hod/students/import', { class_: className, semester: classData?.semester || 2, data: importText });
      } else {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('class_', className);
        formData.append('semester', classData?.semester || 2);
        r = await api.post('/hod/students/import-file', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      
      toast.success(`Added ${r.data.added}, Updated ${r.data.updated}`);
      if (r.data.errors?.length) toast.error(`${r.data.errors.length} lines had errors`);
      setImportModal(false); setImportText(''); setFile(null);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Import failed'); }
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    if (!studentForm.subjects || studentForm.subjects.length === 0) {
      toast.error('Please select at least one subject');
      return;
    }
    try {
      await api.post('/hod/students', {
        ...studentForm,
        class_: className,
        semester: classData?.semester || 2
      });
      toast.success('Student created');
      setCreateStudentModal(false);
      setStudentForm({ roll_no: '', prn: '', name: '', password: '', subjects: [] });
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
  };

  const downloadReport = async () => {
    try {
      const response = await api.get('/hod/export/pdf', {
        params: { class_: className },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report_${className}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch { toast.error('Failed to export PDF'); }
  };

  const downloadCSVReport = async () => {
    try {
      const response = await api.get('/hod/export/csv', {
        params: { class_: className },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report_${className}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch { toast.error('Failed to export CSV'); }
  };

  if (loading) return <div className="flex justify-center h-48 items-center"><div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"/></div>;
  if (!classData) return <div className="card text-center py-16 text-gray-400">Class not found or not under your management.</div>;

  const teachers = allTeachers;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/hod/dashboard')} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={18}/></button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-jspm-navy">{className}</h1>
          <p className="text-gray-500 text-sm">{classData.department || ''} · Semester {classData.semester}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadCSVReport} className="btn-secondary text-sm" title="Download Excel"><Download size={14}/> CSV</button>
          <button onClick={downloadReport} className="btn-secondary text-sm"><Download size={14}/> PDF</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {[{key:'students',label:`Students (${classData.students?.length || 0})`,icon:Users},{key:'teachers',label:`Teachers (${classData.assignments?.length || 0})`,icon:BookOpen}].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${tab === t.key ? 'border-jspm-blue text-jspm-blue' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={14}/>{t.label}
          </button>
        ))}
      </div>

      {tab === 'students' && (
        <div className="space-y-4">
          {/* Low attendance alerts */}
          {alerts.length > 0 && (
            <div className="card border border-red-100 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-red-700 flex items-center gap-2"><AlertTriangle size={15} /> Students Below 75% Attendance (Last 30 Days)</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Sort:</span>
                  <select 
                    className="text-xs border border-red-100 rounded bg-white px-1 py-0.5 outline-none text-red-700"
                    onChange={(e) => {
                      const val = e.target.value;
                      const sorted = [...alerts];
                      if (val === 'percent_asc') sorted.sort((a,b) => a.percent - b.percent);
                      else if (val === 'percent_desc') sorted.sort((a,b) => b.percent - a.percent);
                      else if (val === 'name_asc') sorted.sort((a,b) => a.name.localeCompare(b.name));
                      else if (val === 'roll_asc') sorted.sort((a,b) => a.roll_no.localeCompare(b.roll_no));
                      setAlerts(sorted);
                    }}
                  >
                    <option value="percent_asc">Lowest %</option>
                    <option value="percent_desc">Highest %</option>
                    <option value="name_asc">Name</option>
                    <option value="roll_asc">Roll No</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b">
                      <th className="pb-2 text-left pr-4">Roll No</th>
                      <th className="pb-2 text-left pr-4">Name</th>
                      <th className="pb-2 text-right">Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((a, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-red-50">
                        <td className="py-2 pr-4 font-mono text-jspm-navy">{a.roll_no}</td>
                        <td className="py-2 pr-4 font-medium">{a.name}</td>
                        <td className="py-2 text-right font-bold text-jspm-red">{a.percent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={() => setCreateStudentModal(true)} className="btn-secondary text-sm"><UserPlus size={14}/> Add Student</button>
            <button onClick={() => setImportModal(true)} className="btn-primary text-sm"><Upload size={14}/> Import Students</button>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Roll No</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">PRN</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(classData.students || []).map(s => (
                  <tr key={s.student_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-jspm-navy">{s.roll_no}</td>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{s.prn || '—'}</td>
                    <td className="px-4 py-3 text-center flex items-center justify-center gap-2">
                      <button onClick={() => { setResetPassword(s); setNewPassword(''); }} className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Change Password">
                        <KeyRound size={14}/>
                      </button>
                      <button onClick={() => setDeleteStudent(s)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Remove Student">
                        <Trash2 size={14}/>
                      </button>
                    </td>
                  </tr>
                ))}
                {!classData.students?.length && (
                  <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">No students yet. Import them above.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'teachers' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-jspm-navy mb-4 flex items-center gap-2"><UserPlus size={15}/> Assign Teacher</h3>
            <form onSubmit={handleAssign} className="flex gap-3 flex-wrap">
              <select className="input flex-1 min-w-40" value={assignForm.subject} onChange={e => setAssignForm(p => ({...p, subject: e.target.value}))} required>
                <option value="">— Select Subject —</option>
                {subjectCatalog.map(s => <option key={s.subject_id} value={s.name}>{s.name}{s.code ? ` (${s.code})` : ''}</option>)}
              </select>
              <select className="input flex-1 min-w-48" value={assignForm.teacher_id} onChange={e => setAssignForm(p => ({...p, teacher_id: e.target.value}))} required>
                <option value="">— Select Teacher —</option>
                {teachers.map(t => <option key={t.teacher_id} value={t.teacher_id}>{t.name} {t.phone ? `(${t.phone})` : ''}</option>)}
              </select>
              <button type="submit" className="btn-primary"><UserPlus size={14}/> Assign</button>
            </form>
          </div>
          <div className="space-y-3">
            {(classData.assignments || []).map(a => {
              const teacher = teachers.find(t => t.teacher_id === a.teacher_id);
              return (
                <div key={a.assignment_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <div className="font-semibold text-jspm-navy">{a.subject}</div>
                    <div className="text-sm text-gray-500">{teacher ? teacher.name : `Teacher #${a.teacher_id}`}</div>
                  </div>
                  <button onClick={() => handleUnassign(a.assignment_id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <X size={15}/>
                  </button>
                </div>
              );
            })}
            {!classData.assignments?.length && <div className="card text-center py-8 text-gray-400">No teachers assigned yet.</div>}
          </div>
        </div>
      )}

      {/* Delete student confirm */}
      {deleteStudent && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3"><Trash2 size={20} className="text-red-500"/></div>
            <h3 className="font-bold text-jspm-navy mb-1">Remove Student?</h3>
            <p className="text-gray-600 text-sm mb-1"><strong>{deleteStudent.name}</strong></p>
            <p className="text-gray-400 text-xs mb-4">Roll: {deleteStudent.roll_no} · This will also delete all their attendance records.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteStudent(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleRemoveStudent} className="btn-danger flex-1">Remove</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Import Modal */}
      {importModal && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-jspm-navy">Import Students for {className}</h3>
              <button onClick={() => setImportModal(false)}><X size={20} className="text-gray-400 hover:text-gray-600"/></button>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
              <button 
                onClick={() => setImportMethod('file')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${importMethod === 'file' ? 'bg-white text-jspm-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Table size={16} /> File
              </button>
              <button 
                onClick={() => setImportMethod('paste')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${importMethod === 'paste' ? 'bg-white text-jspm-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <FileText size={16} /> Paste
              </button>
            </div>

            {importMethod === 'file' ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-jspm-blue transition-colors group mb-4">
                <input 
                  type="file" 
                  id="modal-student-file" 
                  className="hidden" 
                  accept=".csv, .xlsx, .xls"
                  onChange={e => setFile(e.target.files[0])}
                />
                <label htmlFor="modal-student-file" className="cursor-pointer block space-y-2">
                  <Upload size={24} className="mx-auto text-jspm-blue group-hover:scale-110 transition-transform" />
                  <div className="text-sm font-medium text-gray-700">
                    {file ? file.name : 'Click to upload student file'}
                  </div>
                  <div className="text-xs text-gray-400">CSV or Excel supported</div>
                </label>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-3">One student per line in CSV format: <code className="bg-gray-100 px-1 rounded">roll_no,prn,name,"subjects"</code> (e.g. roll, prn, name, and comma-separated subjects inside double quotes). Subjects are mandatory.</p>
                <textarea className="input font-mono text-xs mb-4" rows="10" placeholder="T23CO001,23CO001,John Doe,&quot;Maths, Science&quot;&#10;T23CO002,23CO002,Jane Smith,&quot;Maths&quot;"
                  value={importText} onChange={e => setImportText(e.target.value)} />
              </>
            )}

            <div className="flex gap-3">
              <button onClick={() => setImportModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleImport} className="btn-primary flex-1"><Upload size={14}/> Import</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Reset Password Modal */}
      {resetPassword && createPortal(
        <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-xl text-jspm-blue">Change Student Password</h2>
              <button type="button" onClick={() => setResetPassword(null)} className="p-1 rounded-lg hover:bg-gray-100"><X size={18}/></button>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <p className="text-sm text-gray-600 mb-2">Set a new password for <strong>{resetPassword.name}</strong> ({resetPassword.roll_no}).</p>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">New Password</label>
                <input type="text" className="input" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password" required minLength={6}/>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="submit" className="btn-primary flex-1">Update Password</button>
                <button type="button" onClick={() => setResetPassword(null)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {/* Create Student Modal */}
      {createStudentModal && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-jspm-navy">Add Individual Student</h3>
              <button onClick={() => setCreateStudentModal(false)}><X size={20} className="text-gray-400 hover:text-gray-600"/></button>
            </div>
            <form onSubmit={handleCreateStudent} className="space-y-4">
              <div>
                <label className="label">Roll Number</label>
                <input type="text" className="input" required value={studentForm.roll_no} onChange={e => setStudentForm(p => ({...p, roll_no: e.target.value}))} placeholder="e.g. T23CO001" />
              </div>
              <div>
                <label className="label">PRN</label>
                <input type="text" className="input" value={studentForm.prn} onChange={e => setStudentForm(p => ({...p, prn: e.target.value}))} placeholder="e.g. 72312345B" />
              </div>
              <div>
                <label className="label">Full Name</label>
                <input type="text" className="input" required value={studentForm.name} onChange={e => setStudentForm(p => ({...p, name: e.target.value}))} placeholder="e.g. John Doe" />
              </div>
              <div>
                <label className="label">Subjects (Select Multiple) *</label>
                {!classData?.subjects || classData.subjects.length === 0 ? (
                  <div className="text-xs text-red-500 font-medium">No subjects assigned to this class yet. Please add subjects to the class first.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border border-gray-100 rounded-xl bg-gray-50/50">
                    {classData.subjects.map(subName => {
                      const checked = studentForm.subjects?.includes(subName);
                      return (
                        <label key={subName} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:bg-gray-100/50 p-1 rounded transition-colors">
                          <input 
                            type="checkbox" 
                            checked={checked}
                            onChange={() => {
                              const nextSubjects = checked 
                                ? studentForm.subjects.filter(s => s !== subName)
                                : [...(studentForm.subjects || []), subName];
                              setStudentForm(p => ({ ...p, subjects: nextSubjects }));
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
              <div>
                <label className="label">Initial Password (Optional)</label>
                <input type="text" className="input" value={studentForm.password} onChange={e => setStudentForm(p => ({...p, password: e.target.value}))} placeholder="Default: Test@123" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setCreateStudentModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Add Student</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
