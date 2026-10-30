import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import styles from './ProtectedRoute.module.css'

export default function ProtectedRoute() {
  const { user, authLoading } = useAuth()
  const location = useLocation()
  if (authLoading) return <div className={styles.loading} aria-label="Carregando" />
  return user ? <Outlet /> : <Navigate to="/cadastro" replace state={{ from: location }} />
}
