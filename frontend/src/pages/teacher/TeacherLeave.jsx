import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { Calendar, AlertCircle, Plus, Trash2, Clock, CheckCircle, XCircle } from 'lucide-react';

export default function TeacherLeave() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [form, setForm] = useState({
    leave_type: 'Casual Leave',
    start_date: '',
    end_date: '',
    reason: '',
  });

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await api.get('/leave/my-leaves');
      setLeaves(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to fetch leave records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleApply = async (e) => {
    e.preventDefault();
    if (!form.start_date || !form.end_date || !form.reason.trim()) {
      toast.error('All fields are required');
      return;
    }

    setSubmitLoading(true);
    try {
      await api.post('/leave/apply', form);
      toast.success('Leave application submitted successfully!');
      setShowApplyModal(false);
      setForm({
        leave_type: 'Casual Leave',
        start_date: '',
        end_date: '',
        reason: '',
      });
      fetchLeaves();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit leave application');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancel = async (leaveId) => {
    if (!window.confirm('Are you sure you want to cancel this leave application?')) return;

    try {
      await api.delete(`/leave/cancel/${leaveId}`);
      toast.success('Leave application cancelled');
      fetchLeaves();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to cancel leave application');
    }
  };

  // Stats computation
  const stats = {
    pending: leaves.filter((l) => l.status === 'pending').length,
    approved: leaves.filter((l) => l.status === 'approved').length,
    rejected: leaves.filter((l) => l.status === 'rejected').length,
    total: leaves.length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-jspm-navy">Leave Applications</h1>
          <p className="text-gray-500 text-sm">Apply for leave and track your status</p>
        </div>
        <button
          onClick={() => setShowApplyModal(true)}
          className="btn-primary"
        >
          <Plus size={18} /> Apply for Leave
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Calendar size={20} />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-500">Total</div>
            <div className="text-xl font-bold text-slate-800">{stats.total}</div>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-500">Pending</div>
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

      {/* History table */}
      <div className="card">
        <h3 className="font-bold text-slate-800 text-lg mb-4">Application History</h3>
        
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading leave applications...</div>
        ) : leaves.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-150 rounded-2xl flex flex-col items-center justify-center gap-2">
            <AlertCircle className="text-gray-300" size={36} />
            <div className="font-semibold text-gray-400">No leave applications found</div>
            <p className="text-xs text-gray-400">Apply for your first leave by clicking the button above</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 px-4">Dates</th>
                  <th className="pb-3 px-4">Reason</th>
                  <th className="pb-3 px-4">Status</th>
                  <th className="pb-3 px-4">Reviewer Note</th>
                  <th className="pb-3 pl-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-gray-50">
                {leaves.map((l) => (
                  <tr key={l.leave_id} className="hover:bg-slate-50/55 transition-colors">
                    <td className="py-3.5 pr-4 font-semibold text-slate-800">{l.leave_type}</td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="font-medium">{l.start_date}</div>
                      <div className="text-xs text-gray-400">to {l.end_date}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate" title={l.reason}>
                      {l.reason}
                    </td>
                    <td className="py-3.5 px-4">
                      {l.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                          Pending
                        </span>
                      )}
                      {l.status === 'approved' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          Approved
                        </span>
                      )}
                      {l.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                          Rejected
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs">
                      {l.reviewed_by_name ? (
                        <div>
                          <div className="text-xs font-semibold text-slate-700">Reviewed by {l.reviewed_by_name}</div>
                          {l.review_comment && <div className="text-xs text-gray-400 italic">"{l.review_comment}"</div>}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs italic">—</span>
                      )}
                    </td>
                    <td className="py-3.5 pl-4 text-right">
                      {l.status === 'pending' && (
                        <button
                          onClick={() => handleCancel(l.leave_id)}
                          className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 active:scale-95 transition-all"
                          title="Cancel Application"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Apply Modal */}
      {showApplyModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-scaleUp">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Apply for Leave</h3>
            <form onSubmit={handleApply} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Leave Type</label>
                <select
                  value={form.leave_type}
                  onChange={(e) => setForm((p) => ({ ...p, leave_type: e.target.value }))}
                  className="input"
                >
                  <option value="Casual Leave">Casual Leave</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Personal Leave">Personal Leave</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Start Date</label>
                  <input
                    type="date"
                    required
                    value={form.start_date}
                    onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">End Date</label>
                  <input
                    type="date"
                    required
                    value={form.end_date}
                    onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Reason</label>
                <textarea
                  required
                  rows="3"
                  value={form.reason}
                  onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                  className="input resize-none"
                  placeholder="Explain the reason for leave..."
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="btn-secondary"
                  disabled={submitLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitLoading}
                >
                  {submitLoading ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
