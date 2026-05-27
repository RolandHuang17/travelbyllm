import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { login, register, type AuthUser } from '../api/auth'

type AuthPageProps = {
  authStatus: 'checking' | 'guest' | 'authenticated'
  currentUser: AuthUser | null
  onLoginSuccess: (user: AuthUser, token: string) => void
}

type LocationState = {
  from?: {
    pathname?: string
  }
  notice?: string
}

export function AuthPage({
  authStatus,
  currentUser,
  onLoginSuccess,
}: AuthPageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [authMessage, setAuthMessage] = useState(
    () => (location.state as LocationState | null)?.notice ?? '',
  )
  const [authErrorMessage, setAuthErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isRegisterMode = authMode === 'register'
  const locationState = location.state as LocationState | null
  const redirectTo = locationState?.from?.pathname ?? '/'

  if (authStatus === 'authenticated' && currentUser) {
    return <Navigate replace to="/" />
  }

  const handleAuthModeChange = (nextMode: 'login' | 'register') => {
    setAuthMode(nextMode)
    setAuthMessage('')
    setAuthErrorMessage('')
    setPassword('')
    setConfirmPassword('')
  }

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setAuthMessage('')
    setAuthErrorMessage('')

    try {
      if (isRegisterMode) {
        const result = await register({
          username,
          password,
          confirmPassword,
        })

        setAuthMode('login')
        setUsername(result.user.username)
        setPassword('')
        setConfirmPassword('')
        setAuthMessage('注册成功，请继续登录')
        return
      }

      const result = await login({
        identifier: username,
        password,
      })

      onLoginSuccess(result.user, result.token)
      setPassword('')
      setConfirmPassword('')
      navigate(redirectTo, { replace: true })
    } catch (error) {
      setAuthErrorMessage(
        error instanceof Error ? error.message : '操作失败，请稍后重试',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            Auth
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            注册 / 登录
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            登录后即可管理账户资料、绑定邮箱和历史旅行方案。
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {authStatus === 'checking' ? '正在检查登录状态' : '当前未登录'}
        </div>
      </div>

      <div className="mt-8">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
          <button
            className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
              !isRegisterMode
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            type="button"
            onClick={() => handleAuthModeChange('login')}
          >
            登录
          </button>
          <button
            className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
              isRegisterMode
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            type="button"
            onClick={() => handleAuthModeChange('register')}
          >
            注册
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleAuthSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              {isRegisterMode ? '用户名' : '用户名或邮箱'}
            </span>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              maxLength={30}
              minLength={3}
              required
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder={
                isRegisterMode
                  ? '请输入 3 到 30 位用户名'
                  : '请输入用户名或已绑定邮箱'
              }
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">密码</span>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              minLength={6}
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入至少 6 位密码"
            />
          </label>

          {isRegisterMode ? (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                确认密码
              </span>
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                minLength={6}
                required
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="请再次输入密码"
              />
            </label>
          ) : null}

          {!isRegisterMode ? (
            <div className="flex justify-end">
              <Link
                className="text-sm font-medium text-sky-700 transition hover:text-sky-600"
                to="/auth/forgot-password"
              >
                忘记密码？
              </Link>
            </div>
          ) : null}

          {authMessage ? (
            <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {authMessage}
            </p>
          ) : null}

          {authErrorMessage ? (
            <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {authErrorMessage}
            </p>
          ) : null}

          <button
            className="w-full rounded-xl bg-sky-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting
              ? '处理中...'
              : isRegisterMode
                ? '创建账号'
                : '登录'}
          </button>
        </form>
      </div>
    </section>
  )
}
