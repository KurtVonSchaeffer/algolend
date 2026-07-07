import { Navigate, useSearchParams } from 'react-router-dom';

export function PageRedirect() {
  const [searchParams] = useSearchParams();
  const page = searchParams.get('page') || 'dashboard';
  return <Navigate to={`/user-portal/${page}`} replace />;
}
