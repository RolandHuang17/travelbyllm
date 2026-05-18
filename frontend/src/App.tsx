import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import {
  AUTH_TOKEN_STORAGE_KEY,
  fetchCurrentUser,
  type AuthUser,
} from './api/auth'
import { AppLayout } from './components/AppLayout'
import { RequireAuth } from './components/RequireAuth'
import { AuthPage } from './pages/AuthPage'
import { CardsPage } from './pages/CardsPage'
import { CityPlanPage } from './pages/CityPlanPage'
import { DashboardPage } from './pages/DashboardPage'
import { DrivePlanPage } from './pages/DrivePlanPage'
import { HistoryPage } from './pages/HistoryPage'
import { OptimizePlanPage } from './pages/OptimizePlanPage'

const initialAuthToken =
  typeof window === 'undefined'
    ? null
    : localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)

function App() {
  const navigate = useNavigate()
  const [authStatus, setAuthStatus] = useState<
    'checking' | 'guest' | 'authenticated'
  >(initialAuthToken ? 'checking' : 'guest')
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(initialAuthToken)
  const [historyRefreshSignal, setHistoryRefreshSignal] = useState(0)

  const handleAuthExpired = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    setCurrentUser(null)
    setAuthToken(null)
    setAuthStatus('guest')
    navigate('/auth', { replace: true })
  }, [navigate])

  useEffect(() => {
    const token = initialAuthToken

    if (!token) {
      return
    }

    let isActive = true

    const restoreCurrentUser = async () => {
      try {
        const result = await fetchCurrentUser(token)

        if (!isActive) {
          return
        }

        setCurrentUser(result.user)
        setAuthToken(token)
        setAuthStatus('authenticated')
      } catch {
        if (!isActive) {
          return
        }

        handleAuthExpired()
      }
    }

    void restoreCurrentUser()

    return () => {
      isActive = false
    }
  }, [handleAuthExpired])

  const handleLoginSuccess = (user: AuthUser, token: string) => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
    setCurrentUser(user)
    setAuthToken(token)
    setAuthStatus('authenticated')
  }

  const handleLogout = () => {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    setCurrentUser(null)
    setAuthToken(null)
    setAuthStatus('guest')
    navigate('/auth', { replace: true })
  }

  const handlePlanGenerated = () => {
    setHistoryRefreshSignal((currentSignal) => currentSignal + 1)
  }

  const protectedRoute = (children: ReactNode) => (
    <RequireAuth authStatus={authStatus}>{children}</RequireAuth>
  )

  return (
    <Routes>
      <Route
        element={
          <AppLayout
            authStatus={authStatus}
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        }
      >
        <Route index element={<DashboardPage />} />
        <Route
          element={
            <AuthPage
              authStatus={authStatus}
              currentUser={currentUser}
              onLoginSuccess={handleLoginSuccess}
            />
          }
          path="auth"
        />
        <Route
          element={protectedRoute(
            authToken ? (
              <CardsPage token={authToken} onAuthExpired={handleAuthExpired} />
            ) : null,
          )}
          path="cards"
        />
        <Route
          element={protectedRoute(
            authToken ? (
              <CityPlanPage
                token={authToken}
                onAuthExpired={handleAuthExpired}
                onPlanGenerated={handlePlanGenerated}
              />
            ) : null,
          )}
          path="plan/city"
        />
        <Route
          element={protectedRoute(
            authToken ? (
              <DrivePlanPage
                token={authToken}
                onAuthExpired={handleAuthExpired}
                onPlanGenerated={handlePlanGenerated}
              />
            ) : null,
          )}
          path="plan/drive"
        />
        <Route
          element={protectedRoute(
            authToken ? (
              <OptimizePlanPage
                token={authToken}
                onAuthExpired={handleAuthExpired}
                onPlanGenerated={handlePlanGenerated}
              />
            ) : null,
          )}
          path="plan/optimize"
        />
        <Route
          element={protectedRoute(
            authToken ? (
              <HistoryPage
                token={authToken}
                onAuthExpired={handleAuthExpired}
                refreshSignal={historyRefreshSignal}
              />
            ) : null,
          )}
          path="history"
        />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Route>
    </Routes>
  )
}

export default App
