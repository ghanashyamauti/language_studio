import { useState } from 'react';
import api from '../../api/client';
import { Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TeacherPassword() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (form.new_password !== form.confirm_password) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      await api.post('/teacher/change-password', form);
      toast.success('Password updated successfully!');
      setForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setLoading(false); }
  };

  const Field = ({ name, label, showKey }) => (
    <div>
      <label className="text-xs font-medium text-gray-600 mb-1 block">{label}</label>
      <div className="relative">
        <input
          type={show[showKey] ? 'text' : 'password'}
          className="input pr-10"
          value={form[name]}
          onChange={e => setForm(p => ({...p, [name]: e.target.value}))}
          required
        />
        <button type="button" onClick={() => setShow(p => ({...p, [showKey]: !p[showKey]}))}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          {show[showKey] ? <EyeOff size={16}/> : <Eye size={16}/>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-jspm-navy">Change Password</h1>
        <p className="text-gray-500 text-sm">Minimum 6 characters required</p>
      </div>
      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field name="current_password" label="Current Password" showKey="current" />
          <Field name="new_password" label="New Password" showKey="new" />
          <Field name="confirm_password" label="Confirm New Password" showKey="confirm" />
          {form.new_password && form.new_password.length < 6 && (
            <p className="text-xs text-red-500 flex items-center gap-1"><Lock size={12}/> Password must be at least 6 characters</p>
          )}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
