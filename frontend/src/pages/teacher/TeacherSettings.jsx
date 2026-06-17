import { useState } from 'react';
import api from '../../api/client';
import { Lock, Eye, EyeOff, Upload, User, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import ImageCropperModal from '../../components/ImageCropperModal';

const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads/')) {
    const base = api.defaults.baseURL || '';
    return `${base}${url}`;
  }
  return url;
};

export default function TeacherSettings() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setIsCropperOpen(true);
    }
  };

  const handleCroppedSave = async (croppedFile) => {
    setIsCropperOpen(false);
    const formData = new FormData();
    formData.append('file', croppedFile);

    const loadToast = toast.loading('Uploading profile photo...');
    try {
      const res = await api.post('/teacher/upload-profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const newPhoto = res.data.profile_photo;
      
      // Update session user to update sidebar immediately
      const newUser = {
        ...user,
        extra: {
          ...user.extra,
          profile_photo: newPhoto
        }
      };
      localStorage.setItem('user', JSON.stringify(newUser));
      setUser(newUser);
      
      toast.success('Profile photo updated!', { id: loadToast });
    } catch (err) {
      toast.error('Failed to upload profile photo', { id: loadToast });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (form.new_password !== form.confirm_password) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      await api.post('/teacher/change-password', form);
      toast.success('Password updated successfully!');
      setForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (e) { 
      toast.error(e.response?.data?.detail || 'Failed to update password'); 
    } finally { 
      setLoading(false); 
    }
  };

  const Field = ({ name, label, showKey }) => (
    <div>
      <label className="text-xs font-semibold text-gray-600 mb-1 block">{label}</label>
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
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-jspm-navy">My Settings</h1>
        <p className="text-gray-500 text-sm">Manage profile photo and account settings</p>
      </div>

      <div className="card space-y-6">
        {/* Profile photo block */}
        <div className="flex flex-col items-center sm:flex-row gap-5 pb-5 border-b border-gray-100 animate-fadeIn">
          <div className="relative group">
            {user?.extra?.profile_photo ? (
              <img 
                src={getImageUrl(user.extra.profile_photo)} 
                alt="Profile" 
                className="w-24 h-24 rounded-full object-cover border-2 border-emerald-500/20 shadow-md animate-scaleUp" 
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-3xl font-bold border-2 border-emerald-500/20 shadow-inner select-none animate-scaleUp">
                {user?.name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <label className="absolute inset-0 rounded-full bg-black/40 text-white flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[10px] font-semibold">
              <Upload size={16} />
              Upload Photo
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} onClick={(e) => { e.target.value = null; }} />
            </label>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">{user?.name || 'Teacher Name'}</h3>
            <p className="text-xs text-slate-500 capitalize">Teacher Portal</p>
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-2 border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer text-xs font-semibold text-slate-600 shadow-sm transition-all">
              <Upload size={12} /> Change Photo
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} onClick={(e) => { e.target.value = null; }} />
            </label>
          </div>
        </div>

        {/* Change password form */}
        <div className="space-y-4 max-w-md pt-2">
          <h2 className="text-lg font-bold text-jspm-navy flex items-center gap-2 mb-4">
            <Lock size={18} /> Change Password
          </h2>
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

      <ImageCropperModal
        isOpen={isCropperOpen}
        onClose={() => setIsCropperOpen(false)}
        imageFile={selectedFile}
        cropWidth={200}
        cropHeight={200}
        isRound={true}
        onSave={handleCroppedSave}
      />
    </div>
  );
}
