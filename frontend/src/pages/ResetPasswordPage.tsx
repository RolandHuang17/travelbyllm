import { ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../api/auth'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const challengeId = useMemo(
    () => searchParams.get('challengeId')?.trim() ?? '',
    [searchParams],
  )
  const token = useMemo(
    () => searchParams.get('token')?.trim() ?? '',
    [searchParams],
  )
  const hasValidLink = Boolean(challengeId && token)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      await resetPassword({
        challengeId,
        token,
        newPassword,
        confirmPassword,
      })
      setNewPassword('')
      setConfirmPassword('')
      setMessage('密码已重置，请使用新密码重新登录')
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '密码重置失败，请稍后重试',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <Link
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        to="/auth"
      >
        <ArrowLeft size={16} />
        返回登录
      </Link>

      <div className="mt-8">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
          {message ? <CheckCircle2 size={18} /> : <KeyRound size={18} />}
        </span>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
          重置密码
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          设置新密码后，所有已登录设备都会失效，需要重新登录。
        </p>
      </div>

      {!hasValidLink ? (
        <p className="mt-6 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          重置链接缺少必要信息，请重新申请密码找回邮件。
        </p>
      ) : message ? (
        <div className="mt-6 space-y-4">
          <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </p>
          <Link
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-sky-700 px-4 text-sm font-medium text-white transition hover:bg-sky-600"
            to="/auth"
          >
            去登录
          </Link>
        </div>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">新密码</span>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              minLength={6}
              required
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="请输入至少 6 位新密码"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              确认新密码
            </span>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              minLength={6}
              required
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="请再次输入新密码"
            />
          </label>

          {errorMessage ? (
            <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </p>
          ) : null}

          <button
            className="w-full rounded-xl bg-sky-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? '重置中...' : '重置密码'}
          </button>
        </form>
      )}
    </section>
  )
}
