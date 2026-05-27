import { useState } from 'react'
import { Link, NavLink, Outlet, useMatch } from 'react-router-dom'
import { Compass, IdCard, Layers3, LogOut } from 'lucide-react'
import type { AuthUser } from '../api/auth'
import { getUserDisplayName } from '../utils/avatar'
import { UserAvatar } from './UserAvatar'

type AppLayoutProps = {
  authStatus: 'checking' | 'guest' | 'authenticated'
  currentUser: AuthUser | null
  onLogout: () => void
}

const navItems = [
  { to: '/', label: '首页' },
  { to: '/plan/city', label: '单城市规划' },
  { to: '/plan/drive', label: '自驾路线' },
  { to: '/map', label: '互动地图' },
  { to: '/weather', label: '天气查询' },
  { to: '/plan/optimize', label: '方案优化' },
  { to: '/history', label: '历史记录' },
]

function getNavLinkClass({ isActive }: { isActive: boolean }) {
  return [
    'shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition',
    isActive
      ? 'bg-stone-950 text-white shadow-sm'
      : 'text-stone-500 hover:bg-stone-100 hover:text-stone-950',
  ].join(' ')
}

export function AppLayout({
  authStatus,
  currentUser,
  onLogout,
}: AppLayoutProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const isMapWorkspace = Boolean(useMatch('/map'))
  const isHome = Boolean(useMatch('/'))

  const handleLogout = () => {
    setIsUserMenuOpen(false)
    onLogout()
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-stone-950">
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-20 items-center justify-between gap-5">
            <Link className="flex items-center gap-3" to="/">
              <span
                className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-stone-950 text-white shadow-sm"
                aria-hidden="true"
              >
                <span className="absolute inset-1 rounded-xl border border-white/10" />
                <Compass className="relative" size={23} strokeWidth={1.8} />
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_0_3px_rgba(110,231,183,0.18)]" />
              </span>
              <span>
                <span className="block text-base font-semibold tracking-tight">
                  TravelByLLM
                </span>
                <span className="block text-xs font-medium text-stone-500">
                  智能旅行规划
                </span>
              </span>
            </Link>

            <nav className="hidden items-center gap-1 lg:flex">
              {navItems.map((item) => (
                <NavLink
                  className={getNavLinkClass}
                  end={item.to === '/'}
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="relative flex items-center justify-end">
              {authStatus === 'checking' ? (
                <div className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-500">
                  正在检查登录状态
                </div>
              ) : null}

              {authStatus === 'guest' ? (
                <NavLink
                  className="rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
                  to="/auth"
                >
                  登录 / 注册
                </NavLink>
              ) : null}

              {authStatus === 'authenticated' && currentUser ? (
                <>
                  <button
                    className="flex items-center gap-3 rounded-full border border-stone-200 bg-white py-1.5 pl-1.5 pr-4 text-left shadow-sm transition hover:border-stone-300 hover:shadow-md"
                    type="button"
                    aria-expanded={isUserMenuOpen}
                    onClick={() =>
                      setIsUserMenuOpen((currentValue) => !currentValue)
                    }
                  >
                    <UserAvatar user={currentUser} size="sm" />
                    <span className="hidden sm:block">
                      <span className="block max-w-32 truncate text-sm font-semibold text-stone-950">
                        {getUserDisplayName(currentUser)}
                      </span>
                      <span className="block text-xs text-stone-500">
                        个人账户
                      </span>
                    </span>
                  </button>

                  {isUserMenuOpen ? (
                    <div className="absolute right-0 top-full mt-3 w-72 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-2xl shadow-stone-950/10">
                      <div className="border-b border-stone-100 px-5 py-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={currentUser} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-stone-950">
                              {getUserDisplayName(currentUser)}
                            </p>
                            <p className="truncate text-xs text-stone-500">
                              @{currentUser.username}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="p-2">
                        <Link
                          className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50 hover:text-stone-950"
                          to="/profile"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <IdCard size={16} />
                          个人设置
                        </Link>
                        <Link
                          className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50 hover:text-stone-950"
                          to="/cards"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <Layers3 size={16} />
                          偏好卡片
                        </Link>
                        <button
                          className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                          type="button"
                          onClick={handleLogout}
                        >
                          <LogOut size={16} />
                          退出登录
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto border-t border-stone-100 py-3 lg:hidden">
            {navItems.map((item) => (
              <NavLink
                className={getNavLinkClass}
                end={item.to === '/'}
                key={item.to}
                to={item.to}
                onClick={() => setIsUserMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <div
        className={
          isMapWorkspace
            ? 'w-full px-4 py-6 sm:px-6 lg:px-8'
            : isHome
              ? 'mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-10 pt-0 sm:px-6 lg:px-8'
            : 'mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8'
        }
      >
        <Outlet />
      </div>
    </main>
  )
}
