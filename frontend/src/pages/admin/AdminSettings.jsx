import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Save, Building2, Link as LinkIcon, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminSettings() {
  const [form, setForm] = useState({
    college_name: '',
    college_short_name: '',
    college_address: '',
    logo_url: '',
    attendance_threshold: 75,
    academic_year: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/settings').then(r => {
      setForm({
        college_name: r.data.college_name || '',
        college_short_name: r.data.college_short_name || '',
        college_address: r.data.college_address || '',
        logo_url: r.data.logo_url || '',
        attendance_threshold: r.data.attendance_threshold || 75,
        academic_year: r.data.academic_year || ''
      });
      setLoading(false);
    }).catch(() => {
      toast.error('Failed to load settings');
      setLoading(false);
    });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/admin/settings', form);
      toast.success('Settings updated successfully');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-jspm-blue border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-jspm-navy">System Settings</h1>
        <p className="text-gray-500 text-sm">Configure college branding and global thresholds</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="card space-y-5">
            <div>
              <h2 className="text-lg font-bold text-jspm-navy flex items-center gap-2 mb-4">
                <Building2 size={18} /> College Branding
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Full College Name *</label>
                  <input type="text" required className="input" value={form.college_name} onChange={e => setForm({...form, college_name: e.target.value})} placeholder="e.g. JSPM's Rajarshi Shahu College of Engineering" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Short Name</label>
                    <input type="text" className="input" value={form.college_short_name} onChange={e => setForm({...form, college_short_name: e.target.value})} placeholder="e.g. RSCOE" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Academic Year</label>
                    <input type="text" className="input" value={form.academic_year} onChange={e => setForm({...form, academic_year: e.target.value})} placeholder="e.g. 2024-25" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">College Address</label>
                  <input type="text" className="input" value={form.college_address} onChange={e => setForm({...form, college_address: e.target.value})} placeholder="e.g. Tathawade, Pune" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Logo URL</label>
                  <div className="relative">
                    <LinkIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="url" className="input pl-9" value={form.logo_url} onChange={e => setForm({...form, logo_url: e.target.value})} placeholder="https://example.com/logo.png" />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <h2 className="text-lg font-bold text-jspm-navy flex items-center gap-2 mb-4">
                <Settings size={18} /> Global Rules
              </h2>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Minimum Attendance Threshold (%)</label>
                <div className="flex items-center gap-3">
                  <input type="number" min="1" max="100" required className="input w-24 text-center font-bold" value={form.attendance_threshold} onChange={e => setForm({...form, attendance_threshold: parseInt(e.target.value) || 0})} />
                  <span className="text-sm text-gray-500">Students below this percentage will be marked as defaulters.</span>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button type="submit" disabled={saving} className="btn-primary px-8">
                <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>

          {/* Change Password Section */}
          <div className="card mt-6">
            <h2 className="text-lg font-bold text-jspm-navy flex items-center gap-2 mb-4">
              <Lock size={18} /> Change Admin Password
            </h2>
            <AdminPasswordForm />
          </div>
        </div>

        {/* Live Preview */}
        <div className="space-y-4">
          <div className="card bg-gray-50 border-dashed border-2 text-center h-full flex flex-col items-center justify-center p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-6">Live Preview</p>
            {form.logo_url ? (
              <img src={form.logo_url} alt="College Logo" className="w-24 h-24 object-contain mb-4 rounded-xl shadow-sm bg-white p-2" onError={(e) => { e.target.style.display='none'; }} />
            ) : (
              <div className="w-24 h-24 bg-gray-200 rounded-xl mb-4 flex items-center justify-center text-gray-400">
                <Building2 size={32} />
              </div>
            )}
            <h3 className="font-bold text-lg text-jspm-navy leading-tight">{form.college_name || 'Your College Name'}</h3>
            <p className="text-sm text-gray-500 mt-2">{form.college_address || 'City, Country'}</p>
            {form.academic_year && <p className="text-xs text-gray-400 mt-2 font-mono bg-white px-2 py-1 rounded-md shadow-sm border border-gray-100">AY: {form.academic_year}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminPasswordForm() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password.length < 6) return toast.error('Password must be at least 6 characters');
    if (form.new_password !== form.confirm_password) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      await api.post('/admin/change-password', form);
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
