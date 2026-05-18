import { NavLink, Outlet } from 'react-router-dom'
import type { AuthUser } from '../api/auth'

type AppLayoutProps = {
  authStatus: 'checking' | 'guest' | 'authenticated'
  currentUser: AuthUser | null
  onLogout: () => void
}

const navItems = [
  { to: '/', label: '仪表盘' },
  { to: '/cards', label: '偏好卡片' },
  { to: '/plan/city', label: '单城市规划' },
  { to: '/plan/drive', label: '自驾路线' },
  { to: '/plan/optimize', label: '方案优化' },
  { to: '/history', label: '历史记录' },
]

function getNavLinkClass({ isActive }: { isActive: boolean }) {
  return [
    'rounded-xl px-4 py-2 text-sm font-medium transition',
    isActive
      ? 'bg-sky-700 text-white shadow-sm'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ')
}

export function AppLayout({
  authStatus,
  currentUser,
  onLogout,
}: AppLayoutProps) {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-3xl border border-slate-200 bg-white px-8 py-7 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-700">
                TravelByLLM
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                智能旅游规划系统
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                当前已经拆成正式路由结构，便于继续扩展偏好卡片、旅行规划和历史记录等功能页面。
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              {authStatus === 'checking' ? (
                <span className="text-slate-600">正在检查登录状态</span>
              ) : null}
              {authStatus === 'guest' ? (
                <span className="text-slate-600">当前未登录</span>
              ) : null}
              {authStatus === 'authenticated' && currentUser ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <span className="font-medium text-emerald-600">
                    已登录：{currentUser.username}
                  </span>
                  <button
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                    type="button"
                    onClick={onLogout}
                  >
                    退出登录
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <nav className="mt-6 flex flex-wrap gap-2 border-t border-slate-200 pt-5">
            {navItems.map((item) => (
              <NavLink className={getNavLinkClass} key={item.to} to={item.to}>
                {item.label}
              </NavLink>
            ))}
            {authStatus !== 'authenticated' ? (
              <NavLink className={getNavLinkClass} to="/auth">
                注册 / 登录
              </NavLink>
            ) : null}
          </nav>
        </header>

        <Outlet />
      </div>
    </main>
  )
}
