import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import {
  AUTH_TOKEN_STORAGE_KEY,
  fetchCurrentUser,
  type AuthUser,
} from './api/auth'
import { AppLayout } from './components/AppLayout'
import {
  createInitialCityPlanPanelState,
  type CityPlanPanelState,
} from './components/cityPlanPanelState'
import { RequireAuth } from './components/RequireAuth'
import { AuthPage } from './pages/AuthPage'
import { CardsPage } from './pages/CardsPage'
import { CityPlanPage } from './pages/CityPlanPage'
import { DashboardPage } from './pages/DashboardPage'
import { DrivePlanPage } from './pages/DrivePlanPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { HistoryPage } from './pages/HistoryPage'
import { InteractiveMapPage } from './pages/InteractiveMapPage'
import { OptimizePlanPage } from './pages/OptimizePlanPage'
import { PreferenceCardFormPage } from './pages/PreferenceCardFormPage'
import { ProfilePage } from './pages/ProfilePage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { WeatherPage } from './pages/WeatherPage'

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
  const [cityPlanPanelState, setCityPlanPanelState] =
    useState<CityPlanPanelState>(() => createInitialCityPlanPanelState())

  const handleAuthExpired = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    setCurrentUser(null)
    setAuthToken(null)
    setAuthStatus('guest')
    setCityPlanPanelState(createInitialCityPlanPanelState())
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
    setCityPlanPanelState(createInitialCityPlanPanelState())
  }

  const handleLogout = () => {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    setCurrentUser(null)
    setAuthToken(null)
    setAuthStatus('guest')
    setCityPlanPanelState(createInitialCityPlanPanelState())
    navigate('/auth', { replace: true })
  }

  const handlePasswordChanged = () => {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    setCurrentUser(null)
    setAuthToken(null)
    setAuthStatus('guest')
    setCityPlanPanelState(createInitialCityPlanPanelState())
    navigate('/auth', {
      replace: true,
      state: {
        notice: '密码已更新，请使用新密码重新登录',
      },
    })
  }

  const handlePlanGenerated = () => {
    setHistoryRefreshSignal((currentSignal) => currentSignal + 1)
  }

  const handleUserUpdated = (user: AuthUser) => {
    setCurrentUser(user)
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
        <Route element={<ForgotPasswordPage />} path="auth/forgot-password" />
        <Route element={<ResetPasswordPage />} path="auth/reset-password" />
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
              <PreferenceCardFormPage
                token={authToken}
                onAuthExpired={handleAuthExpired}
              />
            ) : null,
          )}
          path="cards/new"
        />
        <Route
          element={protectedRoute(
            authToken ? (
              <PreferenceCardFormPage
                token={authToken}
                onAuthExpired={handleAuthExpired}
              />
            ) : null,
          )}
          path="cards/:cardId/edit"
        />
        <Route
          element={protectedRoute(
            authToken && currentUser ? (
              <ProfilePage
                token={authToken}
                currentUser={currentUser}
                onAuthExpired={handleAuthExpired}
                onPasswordChanged={handlePasswordChanged}
                onUserUpdated={handleUserUpdated}
              />
            ) : null,
          )}
          path="profile"
        />
        <Route
          element={protectedRoute(
            authToken ? (
              <CityPlanPage
                token={authToken}
                panelState={cityPlanPanelState}
                onPanelStateChange={setCityPlanPanelState}
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
              <InteractiveMapPage
                token={authToken}
                onAuthExpired={handleAuthExpired}
              />
            ) : null,
          )}
          path="map"
        />
        <Route
          element={protectedRoute(
            authToken ? (
              <WeatherPage
                token={authToken}
                onAuthExpired={handleAuthExpired}
              />
            ) : null,
          )}
          path="weather"
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
