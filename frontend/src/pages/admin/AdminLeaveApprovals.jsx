import { useState, useEffect } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { ClipboardList, Clock, CheckCircle, XCircle, Search, Calendar } from 'lucide-react';

export default function AdminLeaveApprovals() {
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('');
  
  // Review Modal
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [reviewStatus, setReviewStatus] = useState(''); // 'approved' or 'rejected'
  const [comment, setComment] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await api.get('/leave/stats');
      setStats(res.data);
    } catch (err) {}
  };

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      if (activeTab === 'pending') {
        const res = await api.get('/leave/pending');
        setPending(res.data);
      } else {
        const res = await api.get('/leave/all');
        setHistory(res.data.leaves || []);
      }
    } catch (err) {
      toast.error('Failed to load leave applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchLeaves();
  }, [activeTab]);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLeave) return;

    setSubmitLoading(true);
    try {
      await api.put(`/leave/${selectedLeave.leave_id}/review`, {
        status: reviewStatus,
        comment: comment.trim() || undefined,
      });
      toast.success(`Leave application ${reviewStatus} successfully!`);
      setSelectedLeave(null);
      setComment('');
      fetchStats();
      fetchLeaves();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to review leave application');
    } finally {
      setSubmitLoading(false);
    }
  };

  const openReviewModal = (leave, status) => {
    setSelectedLeave(leave);
    setReviewStatus(status);
  };

  const filteredLeaves = (activeTab === 'pending' ? pending : history).filter((l) => {
    const matchesSearch = l.applicant_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          l.reason?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter ? l.applicant_role === roleFilter : true;
    const matchesType = leaveTypeFilter ? l.leave_type === leaveTypeFilter : true;
    return matchesSearch && matchesRole && matchesType;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-jspm-navy">College Leave Approvals</h1>
        <p className="text-gray-500 text-sm">Review leave requests from both teachers and managers (HODs)</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <ClipboardList size={20} />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-500">Total Requests</div>
            <div className="text-xl font-bold text-slate-800">{stats.total}</div>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-500">Pending Review</div>
            <div className="text-xl font-bold text-slate-800">{stats.pending}</div>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle size={20} />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-500">Approved</div>
            <div className="text-xl font-bold text-slate-800">{stats.approved}</div>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <XCircle size={20} />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-500">Rejected</div>
            <div className="text-xl font-bold text-slate-800">{stats.rejected}</div>
          </div>
        </div>
      </div>

      {/* Controls and Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'pending'
                ? 'bg-white text-jspm-navy shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Pending Reviews ({pending.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-white text-jspm-navy shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Review History
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search applicant..."
              className="input pl-9 py-2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="input py-2 w-36"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All Roles</option>
            <option value="hod">Manager (HOD)</option>
            <option value="teacher">Teacher</option>
          </select>
          <select
            className="input py-2 w-44"
            value={leaveTypeFilter}
            onChange={(e) => setLeaveTypeFilter(e.target.value)}
          >
            <option value="">All Leave Types</option>
            <option value="Casual Leave">Casual Leave</option>
            <option value="Sick Leave">Sick Leave</option>
            <option value="Personal Leave">Personal Leave</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading leave requests...</div>
        ) : filteredLeaves.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No leave applications match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <th className="pb-3 pr-4">Applicant</th>
                  <th className="pb-3 px-4">Role</th>
                  <th className="pb-3 px-4">Leave Type</th>
                  <th className="pb-3 px-4">Duration</th>
                  <th className="pb-3 px-4">Reason</th>
                  <th className="pb-3 px-4">Status</th>
                  {activeTab === 'history' && <th className="pb-3 px-4">Reviewed By</th>}
                  <th className="pb-3 pl-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-gray-50">
                {filteredLeaves.map((l) => (
                  <tr key={l.leave_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 pr-4">
                      <div className="font-semibold text-slate-800">{l.applicant_name}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {l.applicant_role === 'hod' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-purple-100 text-purple-700">
                          Manager (HOD)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-700">
                          Teacher
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">{l.leave_type}</td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="font-medium flex items-center gap-1">
                        <Calendar size={14} className="text-gray-400" />
                        {l.start_date}
                      </div>
                      <div className="text-xs text-gray-400 pl-5">to {l.end_date}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate" title={l.reason}>
                      {l.reason}
                    </td>
                    <td className="py-3.5 px-4">
                      {l.status === 'pending' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                          Pending
                        </span>
                      )}
                      {l.status === 'approved' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          Approved
                        </span>
                      )}
                      {l.status === 'rejected' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                          Rejected
                        </span>
                      )}
                    </td>
                    {activeTab === 'history' && (
                      <td className="py-3.5 px-4 text-slate-600">
                        {l.reviewed_by_name ? (
                          <div>
                            <div className="font-medium">{l.reviewed_by_name} ({l.reviewed_by_role})</div>
                            {l.review_comment && (
                              <div className="text-xs text-gray-400 italic">"{l.review_comment}"</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    )}
                    <td className="py-3.5 pl-4 text-right">
                      {l.status === 'pending' ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openReviewModal(l, 'approved')}
                            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold transition-all"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => openReviewModal(l, 'rejected')}
                            className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold transition-all"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs italic">Reviewed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Confirmation Modal */}
      {selectedLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-scaleUp">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {reviewStatus === 'approved' ? 'Approve Leave Application' : 'Reject Leave Application'}
            </h3>
            <p className="text-slate-600 text-sm mb-4">
              Reviewing leave for <strong>{selectedLeave.applicant_name}</strong> (
              {selectedLeave.leave_type} from {selectedLeave.start_date} to {selectedLeave.end_date}
              ).
            </p>
            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">
                  Remarks / Comments (Optional)
                </label>
                <textarea
                  rows="3"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="input resize-none"
                  placeholder="Provide comments or reason..."
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setSelectedLeave(null)}
                  className="btn-secondary"
                  disabled={submitLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-white rounded-xl text-sm font-semibold transition-all shadow-sm ${
                    reviewStatus === 'approved'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                  disabled={submitLoading}
                >
                  {submitLoading
                    ? 'Submitting...'
                    : reviewStatus === 'approved'
                    ? 'Approve Request'
                    : 'Reject Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
