import { useState, useEffect } from 'react';
import { X, Upload, Download, FileText, Table, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import api from '../../api/client';
import toast from 'react-hot-toast';

export default function BulkImportModal({ isOpen, onClose, type, classes = [], departments = [], onSuccess, apiUrlPrefix = '/admin' }) {
  const [importMethod, setImportMethod] = useState('file'); // 'file' or 'paste'
  const [file, setFile] = useState(null);
  const [pasteData, setPasteData] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  // Student specific
  const [deptId, setDeptId] = useState('');
  const [cls, setCls] = useState('');
  const [semester, setSemester] = useState(2);

  useEffect(() => {
    if (!isOpen) {
      setResult(null);
      setFile(null);
      setPasteData('');
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredClasses = deptId 
    ? classes.filter(c => String(c.dept_id) === String(deptId))
    : classes;

  const handleDownloadTemplate = async () => {
    try {
      const endpoint = type === 'student' ? `${apiUrlPrefix}/students/import-template` : `${apiUrlPrefix}/teachers/import-template`;
      const filename = type === 'student' ? 'student_import_template.csv' : 'teacher_import_template.csv';
      const response = await api.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error('Failed to download template');
    }
  };

  const handleSubmit = async () => {
    if (importMethod === 'file' && !file) return toast.error('Please select a file');
    if (importMethod === 'paste' && !pasteData.trim()) return toast.error('Please paste data');
    
    if (type === 'student' && !cls) return toast.error('Please select a class');

    setLoading(true);
    setResult(null);

    try {
      let res;
      if (type === 'student') {
        const targetClass = classes.find(c => c.class_name === cls);
        const targetSemester = targetClass ? targetClass.semester : semester;
        
        if (importMethod === 'paste') {
          res = await api.post(`${apiUrlPrefix}/students/import`, { data: pasteData, class_: cls, semester: targetSemester });
        } else {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('class_', cls);
          formData.append('semester', targetSemester);
          res = await api.post(`${apiUrlPrefix}/students/import-file`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }
      } else {
        // Teacher
        if (importMethod === 'paste') {
          res = await api.post(`${apiUrlPrefix}/teachers/import`, { data: pasteData });
        } else {
          const formData = new FormData();
          formData.append('file', file);
          res = await api.post(`${apiUrlPrefix}/teachers/import-file`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }
      }

      setResult(res.data);
      toast.success('Import completed!');
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-2xl text-jspm-navy">Bulk Import {type === 'student' ? 'Students' : 'Teachers'}</h2>
            <p className="text-sm text-gray-500">Quickly add multiple records via {importMethod === 'file' ? 'file upload' : 'text'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X size={24} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Download Template & Instructions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <h3 className="font-bold text-jspm-blue text-sm mb-1 flex items-center gap-2">
                <Info size={16} /> Instructions
              </h3>
              <p className="text-xs text-blue-700 leading-relaxed">
                {type === 'student' 
                  ? "Paste data in format: RollNo PRN FullName (one per line)." 
                  : "Columns: Name, Phone, Password, Subject, Class. Password is optional."
                }
              </p>
            </div>
            <button 
              onClick={handleDownloadTemplate}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-2xl hover:bg-gray-50 transition-all text-xs font-bold flex items-center justify-center gap-2 h-fit"
            >
              <Download size={14} className="text-jspm-blue" />
              CSV Template
            </button>
          </div>

          {/* Student Specific Filters */}
          {type === 'student' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 block tracking-widest">Department</label>
                <select className="input text-sm" value={deptId} onChange={e => { setDeptId(e.target.value); setCls(''); }}>
                  <option value="">All Departments</option>
                  {departments.map(d => <option key={d.dept_id} value={d.dept_id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 block tracking-widest">Target Class *</label>
                <select className="input text-sm" value={cls} onChange={e => setCls(e.target.value)}>
                  <option value="">— Select Class —</option>
                  {filteredClasses.map(c => <option key={c.class_name} value={c.class_name}>{c.class_name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Method Toggle */}
          <div className="flex bg-gray-100 p-1 rounded-2xl">
            <button 
              onClick={() => setImportMethod('file')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-all ${importMethod === 'file' ? 'bg-white text-jspm-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Table size={18} /> File Upload
            </button>
            <button 
              onClick={() => setImportMethod('paste')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-all ${importMethod === 'paste' ? 'bg-white text-jspm-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <FileText size={18} /> Paste Data
            </button>
          </div>

          {/* Input Area */}
          {importMethod === 'file' ? (
            <div className="border-2 border-dashed border-gray-200 rounded-3xl p-10 text-center hover:border-jspm-blue transition-colors group relative bg-gray-50/50">
              <input 
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                accept=".csv, .xlsx, .xls"
                onChange={e => setFile(e.target.files[0])}
              />
              <div className="space-y-3">
                <div className="w-14 h-14 bg-white text-jspm-blue rounded-2xl flex items-center justify-center mx-auto shadow-sm group-hover:scale-110 transition-transform">
                  <Upload size={28} />
                </div>
                <div>
                  <p className="font-bold text-gray-700">{file ? file.name : 'Choose a file'}</p>
                  <p className="text-xs text-gray-400">CSV, XLSX or XLS formats supported</p>
                </div>
              </div>
            </div>
          ) : (
            <textarea 
              className="input h-48 font-mono text-xs leading-relaxed" 
              value={pasteData}
              onChange={e => setPasteData(e.target.value)}
              placeholder={type === 'student' ? "T23CO001 23CO001 John Doe\nT23CO002 23CO002 Jane Smith" : "Name, Phone, Password, Subject, Class"}
            />
          )}

          {/* Results */}
          {result && (
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-jspm-navy text-sm">Import Results</h3>
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-lg">Added: {result.added}</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-lg">Updated: {result.updated}</span>
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-lg">Errors: {result.errors?.length || 0}</span>
                </div>
              </div>
              {result.errors?.length > 0 && (
                <div className="max-h-32 overflow-y-auto text-[10px] text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 space-y-1">
                  {result.errors.map((err, i) => <div key={i} className="flex gap-2"><span className="opacity-50">•</span> {err}</div>)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 py-3 font-bold">Close</button>
          <button 
            onClick={handleSubmit} 
            disabled={loading} 
            className="btn-primary flex-[2] py-3 font-bold shadow-lg shadow-jspm-blue/20 flex items-center justify-center gap-2"
          >
            {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Upload size={18} />}
            {loading ? 'Processing...' : 'Run Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
