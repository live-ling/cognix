import { Navigate, useLocation } from 'react-router-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Skeleton } from '@/components/ui/skeleton';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSupabaseAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page-container">
        <div className="space-y-4">
          <Skeleton type="title" width="40%" />
          <Skeleton type="text" width="60%" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-4 rounded-lg border border-border">
                <Skeleton type="text" width="60%" className="mb-2" />
                <Skeleton type="title" width="40%" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSupabaseAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page-container">
        <div className="space-y-4">
          <Skeleton type="title" width="40%" />
          <Skeleton type="text" width="60%" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/profile" replace />;
  }

  return <>{children}</>;
}
