import { useEffect, useState } from 'react';
import api from '../../api/client';
import { User, Mail, Phone, Building2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function HodSettings() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', department: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/hod/profile').then(r => {
      setForm(r.data);
      setLoading(false);
    }).catch(() => {
      toast.error('Failed to load profile');
      setLoading(false);
    });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/hod/profile', form);
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-jspm-navy">My Settings</h1>
        <p className="text-gray-500 text-sm">Update your personal and professional details</p>
      </div>

      <div className="card">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" required className="input pl-9" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Department</label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" className="input pl-9" value={form.department || ''} onChange={e => setForm({...form, department: e.target.value})} placeholder="e.g. Computer Engineering" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="email" className="input pl-9" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} placeholder="email@college.edu" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Phone Number</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" required className="input pl-9" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary px-8">
              <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        {/* Password section inside Settings card */}
        <div className="mt-8 pt-8 border-t border-gray-100">
          <h2 className="text-lg font-bold text-jspm-navy flex items-center gap-2 mb-4">
            <Lock size={18} /> Change Password
          </h2>
          <HodPasswordForm />
        </div>
      </div>

      <div className="card bg-purple-50 border-purple-100 p-4 flex gap-3">
        <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center flex-shrink-0">
          <Building2 size={20} />
        </div>
        <div>
          <h3 className="font-bold text-purple-900 text-sm">Managing Classes</h3>
          <p className="text-xs text-purple-700 mt-1">
            As a Manager, you can manage student lists, assign teachers to subjects, and view attendance analytics for your assigned department.
          </p>
        </div>
      </div>
    </div>
  );
}

function HodPasswordForm() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password.length < 6) return toast.error('Password must be at least 6 characters');
    if (form.new_password !== form.confirm_password) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      await api.post('/hod/change-password', form);
      toast.success('Password updated successfully');
      setForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Current Password</label>
          <input type="password" required className="input" value={form.current_password} onChange={e => setForm({...form, current_password: e.target.value})} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">New Password</label>
            <input type="password" required className="input" value={form.new_password} onChange={e => setForm({...form, new_password: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Confirm New Password</label>
            <input type="password" required className="input" value={form.confirm_password} onChange={e => setForm({...form, confirm_password: e.target.value})} />
          </div>
        </div>
      </div>
      <div className="pt-2">
        <button type="submit" disabled={loading} className="btn-secondary w-full py-2">
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </div>
    </form>
  );
}

import { Lock } from 'lucide-react';
