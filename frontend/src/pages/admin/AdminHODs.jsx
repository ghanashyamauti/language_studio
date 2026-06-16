import { useState, useEffect } from 'react';
import api from '../../api/client';
import { Plus, Trash2, Pencil, Users, X, Key, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

function HODForm({ initial, departments, onSave, onCancel }) {
  const [form, setForm] = useState(
    initial
      ? { ...initial, class_names: initial.classes || [], password: '' }
      : { name:'', phone:'', email:'', department:'', dept_id: '', password:'', class_names:[] }
  );
  const [classInput, setClassInput] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addClass = () => {
    const c = classInput.trim();
    if (c && !form.class_names.includes(c)) {
      set('class_names', [...form.class_names, c]);
      setClassInput('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addClass(); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-bold text-2xl text-jspm-navy">{initial ? 'Edit Manager' : 'Create Manager'}</h2>
            <p className="text-sm text-gray-500">Configure access for Managers</p>
          </div>
          <button type="button" onClick={onCancel} className="p-2 rounded-xl hover:bg-gray-100 transition-colors"><X size={20} className="text-gray-400"/></button>
        </div>
        <div className="space-y-5">
          {[
            ['name',       'Full Name',                    'text'],
            ['phone',      'Phone Number',                 'text'],
            ['email',      'Email Address (optional)',      'email'],
          ].map(([k, label, type]) => (
            <div key={k}>
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">{label}</label>
              <input type={type} className="input" value={form[k] || ''}
                onChange={e => set(k, e.target.value)} placeholder={label}/>
            </div>
          ))}

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Department Assignment</label>
            <select className="input" value={form.dept_id || ''} onChange={e => set('dept_id', e.target.value)}>
              <option value="">— Select Department —</option>
              {departments.map(d => <option key={d.dept_id} value={d.dept_id}>{d.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">{initial ? 'Reset Password (optional)' : 'Initial Password'}</label>
            <input type="password" className="input" value={form.password || ''}
                onChange={e => set('password', e.target.value)} placeholder={initial ? 'Leave blank to keep current' : 'Minimum 6 characters'}/>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <label className="block text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Managed Classes</label>
            <div className="flex gap-2 mb-3">
              <input className="input flex-1" value={classInput}
                onChange={e => setClassInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. SYMCA Div A"/>
              <button type="button" onClick={addClass} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all text-sm">Add</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.class_names.map(c => (
                <span key={c} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-jspm-blue border border-blue-100">
                  {c}
                  <button type="button" onClick={() => set('class_names', form.class_names.filter(x => x !== c))}
                    className="hover:text-red-500 transition-colors">×</button>
                </span>
              ))}
              {!form.class_names.length && <p className="text-xs text-gray-400 italic">No classes assigned yet.</p>}
            </div>
          </div>
        </div>

        <div className="flex gap-4 mt-10">
          <button type="button" onClick={() => onSave(form)} className="btn-primary flex-1 py-4 font-bold shadow-lg shadow-jspm-blue/20">
            {initial ? 'Save Profile' : 'Create Account'}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-4 font-bold">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminHODs() {
  const [hods, setHods]       = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]  = useState(null);
  const [loading, setLoading]  = useState(true);
  const [resetPassword, setResetPassword] = useState(null); 
  const [newPassword, setNewPassword] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [h, d] = await Promise.all([
        api.get('/admin/hods'),
        api.get('/admin/departments')
      ]);
      setHods(h.data);
      setDepartments(d.data);
    } catch (e) { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (form) => {
    const payload = { ...form };
    if (!payload.dept_id) payload.dept_id = null;
    if (editing && !payload.password) delete payload.password;
    try {
      if (editing) {
        await api.patch(`/admin/hods/${editing.hod_id}`, payload);
        toast.success('Manager updated successfully');
      } else {
        await api.post('/admin/hods', payload);
        toast.success('Manager created successfully');
      }
      setShowForm(false); setEditing(null); load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save Manager');
    }
  };

  const handleDelete = async (hod) => {
    if (!window.confirm(`Delete Manager "${hod.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/hods/${hod.hod_id}`);
      toast.success('Manager deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error('Password must be at least 6 characters');
    try {
      await api.post(`/admin/hods/${resetPassword.hod_id}/reset-password`, { new_password: newPassword });
      toast.success(`Password updated for ${resetPassword.name}`);
      setResetPassword(null);
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update password');
    }
  };

  return (
    <div className="space-y-6">
      {(showForm || editing) && (
        <HODForm
          initial={editing}
          departments={departments}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}
      
      {resetPassword && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6"><Key size={28}/></div>
            <h2 className="font-bold text-2xl text-jspm-navy mb-2">Reset Password</h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">Setting new password for <span className="font-bold text-jspm-navy">{resetPassword.name}</span></p>
            <form onSubmit={handleResetPassword} className="space-y-5 text-left">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">New Security Password</label>
                <input type="text" className="input" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter at least 6 characters" required minLength={6}/>
              </div>
              <div className="flex gap-4 mt-8">
                <button type="submit" className="btn-primary flex-1 py-3 font-bold">Update Now</button>
                <button type="button" onClick={() => setResetPassword(null)} className="btn-secondary flex-1 py-3 font-bold">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold text-3xl text-jspm-navy">Managers</h1>
          <p className="text-gray-500 text-sm mt-1">Manage managers and their class access</p>
        </div>
        <button type="button" onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 px-6 py-3">
          <Plus size={20}/> New Manager
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{[1,2,3,4].map(i => <div key={i} className="h-40 bg-white rounded-3xl animate-pulse shadow-sm"/>)}</div>
      ) : hods.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {hods.map(h => (
            <div key={h.hod_id} className="card group hover:border-jspm-blue transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                    <Users size={22} />
                  </div>
                  <div>
                    <p className="font-bold text-lg text-jspm-navy leading-tight">{h.name}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <span>{h.phone}</span>
                      {h.email && <span>· {h.email}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => { setResetPassword(h); setNewPassword(''); }}
                    className="p-2 rounded-xl text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all" title="Change Password">
                    <Key size={16}/>
                  </button>
                  <button type="button" onClick={() => setEditing(h)}
                    className="p-2 rounded-xl text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all" title="Edit Profile">
                    <Pencil size={16}/>
                  </button>
                  <button type="button" onClick={() => handleDelete(h)}
                    className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all" title="Delete">
                    <Trash2 size={16}/>
                  </button>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-50">
                <div className="flex items-center gap-2 text-jspm-blue">
                  <Building2 size={14} />
                  <span className="text-xs font-bold uppercase tracking-wide">{h.dept_name || h.department || 'General'}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {h.classes?.length > 0 ? h.classes.slice(0, 2).map(c => (
                    <span key={c} className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-gray-50 text-gray-500 border border-gray-100">{c}</span>
                  )) : <span className="text-[10px] text-gray-300 italic">No classes</span>}
                  {h.classes?.length > 2 && <span className="text-[10px] text-gray-300">+{h.classes.length - 2} more</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-20 border-dashed">
          <div className="w-16 h-16 bg-gray-50 text-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={32} />
          </div>
          <p className="text-gray-400 mb-6">No Managers configured in the system.</p>
          <button type="button" onClick={() => setShowForm(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus size={18}/> Create First Manager
          </button>
        </div>
      )}
    </div>
  );
}
