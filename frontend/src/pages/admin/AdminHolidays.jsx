import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Calendar, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminHolidays() {
  const [holidays, setHolidays] = useState([]);
  const [form, setForm] = useState({ date: '', name: '' });
  const [loading, setLoading] = useState(false);

  const load = () => api.get('/admin/holidays').then(r => setHolidays(r.data));
  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.date || !form.name.trim()) { toast.error('Date and name required'); return; }
    setLoading(true);
    try {
      await api.post('/admin/holidays', form);
      toast.success('Holiday added');
      setForm({ date: '', name: '' });
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this holiday?')) return;
    await api.delete(`/admin/holidays/${id}`);
    toast.success('Removed');
    load();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-jspm-navy">Holiday Calendar</h1>
        <p className="text-gray-500 text-sm">Manage institutional holidays — these appear in student attendance calendar</p>
      </div>

      <div className="card">
        <h2 className="font-semibold text-jspm-navy mb-4 flex items-center gap-2"><Plus size={16}/>Add Holiday</h2>
        <form onSubmit={handleAdd} className="flex gap-3 flex-wrap">
          <input type="date" className="input w-44" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))} required />
          <input type="text" className="input flex-1 min-w-48" placeholder="Holiday name (e.g. Diwali)" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} required />
          <button type="submit" className="btn-primary" disabled={loading}><Plus size={16}/> Add</button>
        </form>
      </div>

      <div className="card">
        <h2 className="font-semibold text-jspm-navy mb-4 flex items-center gap-2"><Calendar size={16}/> Holidays ({holidays.length})</h2>
        {holidays.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No holidays configured yet</p>
        ) : (
          <div className="space-y-2">
            {holidays.map(h => (
              <div key={h.holiday_id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎉</span>
                  <div>
                    <div className="font-medium text-jspm-navy">{h.name}</div>
                    <div className="text-xs text-gray-500">{new Date(h.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  </div>
                </div>
                <button onClick={() => handleDelete(h.holiday_id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
