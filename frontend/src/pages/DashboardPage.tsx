import { useEffect, useState } from 'react'
import { fetchHealthStatus, type HealthStatus } from '../api/health'

export function DashboardPage() {
  const [healthStatus, setHealthStatus] = useState<
    'loading' | 'success' | 'error'
  >('loading')
  const [healthData, setHealthData] = useState<HealthStatus | null>(null)
  const [healthErrorMessage, setHealthErrorMessage] = useState('')

  useEffect(() => {
    let isActive = true

    const loadHealthStatus = async () => {
      try {
        const result = await fetchHealthStatus()

        if (!isActive) {
          return
        }

        setHealthData(result)
        setHealthStatus('success')
      } catch (error) {
        if (!isActive) {
          return
        }

        setHealthErrorMessage(
          error instanceof Error ? error.message : '无法连接到后端服务',
        )
        setHealthStatus('error')
      }
    }

    void loadHealthStatus()

    return () => {
      isActive = false
    }
  }, [])

  const formattedTimestamp = healthData
    ? new Date(healthData.timestamp).toLocaleString()
    : ''

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
          Health
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">
          系统连通性
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          这里请求 `/api/health`，用于确认 Express 后端和 SQLite 数据库仍然正常。
        </p>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          {healthStatus === 'loading' ? (
            <div className="space-y-2">
              <p className="text-base font-medium text-slate-900">
                正在检查后端和数据库连接
              </p>
              <p className="text-sm text-slate-600">
                前端正在请求 `/api/health`。
              </p>
            </div>
          ) : null}

          {healthStatus === 'success' && healthData ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                <span className="text-sm text-slate-500">Backend</span>
                <span className="font-medium text-emerald-600">OK</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                <span className="text-sm text-slate-500">Database</span>
                <span className="font-medium text-emerald-600">
                  {healthData.database.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                <span className="text-sm text-slate-500">Updated</span>
                <span className="text-sm font-medium text-slate-800">
                  {formattedTimestamp}
                </span>
              </div>
            </div>
          ) : null}

          {healthStatus === 'error' ? (
            <div className="space-y-2">
              <p className="text-base font-medium text-rose-600">连接失败</p>
              <p className="text-sm text-slate-600">{healthErrorMessage}</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
          Roadmap
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">
          当前开发状态
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          项目已经从单页验证页拆成正式路由结构。现在可以通过顶部导航分别进入偏好卡片、单城市规划、自驾路线和历史记录页面。
        </p>

        <div className="mt-8 grid gap-3">
          {[
            '注册 / 登录 / JWT 当前用户识别',
            '偏好卡片增删改查',
            '单城市 AI 规划并自动保存历史',
            '多城市自驾 AI 规划并自动保存历史',
            '历史方案 AI 优化并保存为新记录',
            '历史记录列表、详情、改标题和删除',
          ].map((item) => (
            <div
              className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
              key={item}
            >
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
