// frontend/src/components/SuperAdminRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isSuperAdmin, loading } = useAuth();

  console.log('SuperAdminRoute - isAuthenticated:', isAuthenticated, 'isSuperAdmin:', isSuperAdmin, 'loading:', loading);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('SuperAdminRoute - Not authenticated, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  if (!isSuperAdmin) {
    console.log('SuperAdminRoute - Not super admin, redirecting to /main');
    return <Navigate to="/main" replace />;
  }

  console.log('SuperAdminRoute - Super admin, rendering children');
  return <>{children}</>;
}