import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function HodCreateClass() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ class_name: '', division: '', department: '', semester: 2 });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // FIX: only auto-fill class_name if it's currently empty (don't overwrite manual edits)
  const autoName = () => {
    const parts = [form.department?.trim(), form.division?.trim()].filter(Boolean);
    if (parts.length && !form.class_name.trim()) {
      set('class_name', parts.join('-'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.class_name.trim()) { toast.error('Class name is required'); return; }
    setLoading(true);
    try {
      await api.post('/hod/classes', form);
      toast.success(`Class "${form.class_name}" created`);
      navigate('/hod/dashboard');
    } catch (e) { toast.error(e.response?.data?.detail || 'Error creating class'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-jspm-navy">Create New Class</h1>
        <p className="text-gray-500 text-sm">Add a new class under your management</p>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Department</label>
            <input type="text" className="input" placeholder="e.g. Computer Engineering" value={form.department}
              onChange={e => set('department', e.target.value)}
              onBlur={autoName} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Division</label>
            <input type="text" className="input" placeholder="e.g. A, B, CO-A" value={form.division}
              onChange={e => set('division', e.target.value)}
              onBlur={autoName} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Class Name <span className="text-red-500">*</span></label>
            <input type="text" className="input" placeholder="e.g. Computer Engineering-A" value={form.class_name}
              onChange={e => set('class_name', e.target.value)} required />
            <p className="text-xs text-gray-400 mt-1">Auto-filled from department + division (only if empty)</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Semester</label>
            <select className="input" value={form.semester} onChange={e => set('semester', parseInt(e.target.value))}>
              {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => navigate('/hod/dashboard')} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              <Plus size={16}/> {loading ? 'Creating...' : 'Create Class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
