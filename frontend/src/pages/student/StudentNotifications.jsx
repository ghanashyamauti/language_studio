import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Bell, CheckCheck } from 'lucide-react';

export default function StudentNotifications() {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => api.get('/student/notifications').then(r => { setNotifs(r.data); setLoading(false); });
  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    await api.post(`/student/notifications/${id}/read`);
    setNotifs(prev => prev.map(n => n.notification_id === id ? {...n, is_read: true} : n));
  };

  const markAllRead = async () => {
    const unread = notifs.filter(n => !n.is_read);
    await Promise.all(unread.map(n => api.post(`/student/notifications/${n.notification_id}/read`)));
    setNotifs(prev => prev.map(n => ({...n, is_read: true})));
  };

  const unreadCount = notifs.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-jspm-navy">Notifications</h1>
          <p className="text-gray-500 text-sm">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-secondary text-sm flex items-center gap-2">
            <CheckCheck size={14}/> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center h-48 items-center"><div className="w-8 h-8 border-4 border-jspm-blue border-t-transparent rounded-full animate-spin"/></div>
      ) : notifs.length === 0 ? (
        <div className="card text-center py-16">
          <Bell size={32} className="text-gray-300 mx-auto mb-3"/>
          <p className="text-gray-400">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifs.map(n => (
            <div
              key={n.notification_id}
              onClick={() => !n.is_read && markRead(n.notification_id)}
              className={`card cursor-pointer transition-all hover:shadow-md border-l-4 ${n.is_read ? 'border-l-gray-200 opacity-75' : 'border-l-jspm-blue'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-jspm-blue flex-shrink-0"/>}
                    <span className="font-semibold text-jspm-navy text-sm">{n.title}</span>
                  </div>
                  <p className="text-sm text-gray-600">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-2">{new Date(n.created_at).toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
