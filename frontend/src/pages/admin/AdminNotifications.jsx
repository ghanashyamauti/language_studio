import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Bell, Send, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [form, setForm] = useState({ recipient_role: 'all', recipient_id: '', title: '', message: '' });
  const [loading, setLoading] = useState(false);

  const load = () => api.get('/admin/notifications').then(r => setNotifications(r.data));
  useEffect(() => { load(); }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) { toast.error('Title and message required'); return; }
    setLoading(true);
    const payload = { ...form, recipient_id: form.recipient_id ? parseInt(form.recipient_id) : null };
    try {
      await api.post('/admin/notifications', payload);
      toast.success('Notification sent!');
      setForm({ recipient_role: 'all', recipient_id: '', title: '', message: '' });
      load();
    } catch (e) { toast.error('Failed to send'); }
    finally { setLoading(false); }
  };

  const roleColors = { all: 'bg-purple-100 text-purple-700', student: 'bg-blue-100 text-blue-700', teacher: 'bg-green-100 text-green-700', hod: 'bg-amber-100 text-amber-700' };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-jspm-navy">Notifications</h1>
        <p className="text-gray-500 text-sm">Send announcements to students, teachers, Managers or everyone</p>
      </div>

      <div className="card">
        <h2 className="font-semibold text-jspm-navy mb-4 flex items-center gap-2"><Send size={16}/> Send Notification</h2>
        <form onSubmit={handleSend} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Send To</label>
              <select className="input" value={form.recipient_role} onChange={e => setForm(p => ({...p, recipient_role: e.target.value}))}>
                <option value="all">Everyone</option>
                <option value="student">All Students</option>
                <option value="teacher">All Teachers</option>
                <option value="hod">All Managers</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Specific ID (optional)</label>
              <input type="number" className="input" placeholder="Leave blank for broadcast" value={form.recipient_id} onChange={e => setForm(p => ({...p, recipient_id: e.target.value}))} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Title</label>
            <input type="text" className="input" placeholder="Notification title" value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} required />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Message</label>
            <textarea className="input" rows="4" placeholder="Notification message..." value={form.message} onChange={e => setForm(p => ({...p, message: e.target.value}))} required />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}><Send size={16}/> Send Notification</button>
        </form>
      </div>

      <div className="card">
        <h2 className="font-semibold text-jspm-navy mb-4 flex items-center gap-2"><Bell size={16}/> Sent Notifications ({notifications.length})</h2>
        {notifications.length === 0 ? <p className="text-gray-400 text-sm text-center py-8">No notifications sent yet</p> : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {notifications.map(n => (
              <div key={n.notification_id} className="p-4 border border-gray-100 rounded-xl hover:bg-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[n.recipient_role] || 'bg-gray-100 text-gray-600'}`}>→ {n.recipient_role}{n.recipient_id ? ` #${n.recipient_id}` : ''}</span>
                      <span className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="font-semibold text-sm text-jspm-navy">{n.title}</div>
                    <div className="text-sm text-gray-600 mt-1">{n.message}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
