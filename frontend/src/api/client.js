import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 
    (import.meta.env.DEV ? 'http://localhost:8000' : 'https://ghanashyam0810-language-studio-api.hf.space'),
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let sessionExpiredShown = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.includes('/auth/login')) {
      if (!sessionExpiredShown) {
        sessionExpiredShown = true;
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        toast.error('Your session has expired. Please sign in again.', { duration: 4000 });
        setTimeout(() => {
          sessionExpiredShown = false;
          window.location.href = '/login';
        }, 1500);
      }
    }
    return Promise.reject(error);
  }
);

export default api;