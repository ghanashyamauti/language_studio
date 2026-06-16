import { useState, useEffect } from 'react';
import api from '../../api/client';
import Pagination from '../../components/Pagination';
import { Activity, Search } from 'lucide-react';

const ACTION_COLORS = {
  LOGIN: 'bg-blue-100 text-blue-700',
  CREATE_HOD: 'bg-green-100 text-green-700',
  UPDATE_HOD: 'bg-yellow-100 text-yellow-700',
  DELETE_HOD: 'bg-red-100 text-red-700',
  CREATE_TEACHER: 'bg-green-100 text-green-700',
  DELETE_TEACHER: 'bg-red-100 text-red-700',
  CREATE_CLASS: 'bg-purple-100 text-purple-700',
  IMPORT_STUDENTS: 'bg-indigo-100 text-indigo-700',
  IMPORT_TEACHERS: 'bg-indigo-100 text-indigo-700',
  MARK_ATTENDANCE: 'bg-teal-100 text-teal-700',
  REMOVE_STUDENT: 'bg-red-100 text-red-700',
  REMOVE_TEACHER: 'bg-red-100 text-red-700',
  ASSIGN_TEACHER: 'bg-orange-100 text-orange-700',
  ASSIGN_CLASS_TO_HOD: 'bg-orange-100 text-orange-700',
};

const ROLE_COLORS = {
  admin: 'bg-jspm-blue text-white',
  hod: 'bg-jspm-gold text-white',
  teacher: 'bg-green-500 text-white',
  student: 'bg-gray-400 text-white',
};

function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

export default function AdminActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({ actor_role:'', action:'', search:'' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/admin/activity-logs', { params: { ...filters, page, limit: 30 } })
      .then(r => { setLogs(r.data.logs); setTotal(r.data.total); setTotalPages(r.data.total_pages); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters, page]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-jspm-blue font-bold flex items-center gap-2">
          <Activity size={22}/> Activity Logs
        </h1>
        <p className="text-gray-500 text-sm mt-1">{total} total actions recorded</p>
      </div>

      {/* Filters */}
      <div className="card mb-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
            <select className="input text-sm" value={filters.actor_role}
              onChange={e=>setFilters(f=>({...f,actor_role:e.target.value}))}>
              <option value="">All Roles</option>
              {['admin','hod','teacher','student'].map(r=><option key={r} value={r} className="capitalize">{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
            <select className="input text-sm" value={filters.action}
              onChange={e=>setFilters(f=>({...f,action:e.target.value}))}>
              <option value="">All Actions</option>
              {Object.keys(ACTION_COLORS).map(a=><option key={a} value={a}>{a.replace(/_/g,' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input className="input pl-8 text-sm" placeholder="Name or target..." value={filters.search}
                onChange={e=>setFilters(f=>({...f,search:e.target.value}))}/>
            </div>
          </div>
        </div>
      </div>

      {/* Log table */}
      <div className="card">
        {loading ? (
          <div className="space-y-2">{[...Array(8)].map((_,i)=><div key={i} className="h-12 bg-gray-100 rounded animate-pulse"/>)}</div>
        ) : logs.length > 0 ? (
          <>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-head">When</th>
                    <th className="table-head">Role</th>
                    <th className="table-head">Actor</th>
                    <th className="table-head">Action</th>
                    <th className="table-head">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.log_id} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell text-xs text-gray-400 whitespace-nowrap">{fmt(l.created_at)}</td>
                      <td className="table-cell">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${ROLE_COLORS[l.actor_role]||'bg-gray-200'}`}>
                          {l.actor_role}
                        </span>
                      </td>
                      <td className="table-cell font-medium text-sm">{l.actor_name}</td>
                      <td className="table-cell">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[l.action]||'bg-gray-100 text-gray-600'}`}>
                          {l.action.replace(/_/g,' ')}
                        </span>
                      </td>
                      <td className="table-cell text-xs text-gray-500 max-w-xs truncate">{l.target || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage}/>
          </>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <Activity size={32} className="mx-auto mb-2 opacity-40"/>
            <p className="text-sm">No activity logs found</p>
          </div>
        )}
      </div>
    </div>
  );
}
