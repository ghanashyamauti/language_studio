import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import ForcePasswordChange from './ForcePasswordChange';

export default function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" replace />;
  
  const showForcePassword = (user.role === 'student' || user.role === 'teacher') && user.extra?.must_change_password;

  return (
    <>
      {showForcePassword && <ForcePasswordChange />}
      {children}
    </>
  );
}
