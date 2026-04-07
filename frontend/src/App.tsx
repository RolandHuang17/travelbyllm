import { useEffect, useState } from 'react'
import { fetchHealthStatus, type HealthStatus } from './api/health'

function App() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  )
  const [data, setData] = useState<HealthStatus | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isActive = true

    const loadHealthStatus = async () => {
      try {
        const result = await fetchHealthStatus()

        if (!isActive) {
          return
        }

        setData(result)
        setStatus('success')
      } catch (error) {
        if (!isActive) {
          return
        }

        setErrorMessage(
          error instanceof Error ? error.message : '无法连接到后端服务',
        )
        setStatus('error')
      }
    }

    void loadHealthStatus()

    return () => {
      isActive = false
    }
  }, [])

  const formattedTimestamp = data
    ? new Date(data.timestamp).toLocaleString()
    : ''

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-16 text-slate-900">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-700">
          TravelByLLM
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          System Status
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          这是当前项目的最小联通性验证页，用来确认前端、后端和数据库已经成功连通。
        </p>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          {status === 'loading' ? (
            <div className="space-y-2">
              <p className="text-base font-medium text-slate-900">
                正在检查后端和数据库连接
              </p>
              <p className="text-sm text-slate-600">
                前端正在请求 `/api/health`。
              </p>
            </div>
          ) : null}

          {status === 'success' && data ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                <span className="text-sm text-slate-500">Backend</span>
                <span className="font-medium text-emerald-600">OK</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                <span className="text-sm text-slate-500">Database</span>
                <span className="font-medium text-emerald-600">
                  {data.database.toUpperCase()}
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

          {status === 'error' ? (
            <div className="space-y-2">
              <p className="text-base font-medium text-rose-600">连接失败</p>
              <p className="text-sm text-slate-600">{errorMessage}</p>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}

export default App
