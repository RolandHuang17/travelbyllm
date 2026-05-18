import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

type RequireAuthProps = {
  authStatus: 'checking' | 'guest' | 'authenticated'
  children: ReactNode
}

export function RequireAuth({ authStatus, children }: RequireAuthProps) {
  const location = useLocation()

  if (authStatus === 'checking') {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-base font-medium text-slate-900">
          正在检查登录状态
        </p>
        <p className="mt-2 text-sm text-slate-600">
          如果本地保存了 token，系统会自动请求 `/api/auth/me` 恢复当前用户。
        </p>
      </section>
    )
  }

  if (authStatus === 'guest') {
    return <Navigate replace state={{ from: location }} to="/auth" />
  }

  return children
}
