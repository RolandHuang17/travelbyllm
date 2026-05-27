import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  KeyRound,
  LogIn,
  Mail,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import {
  AuthApiError,
  changePassword,
  confirmEmailBinding,
  deleteAvatar,
  requestEmailBinding,
  updateProfile,
  uploadAvatar,
  type AuthUser,
} from '../api/auth'
import { UserAvatar } from '../components/UserAvatar'
import { getUserDisplayName } from '../utils/avatar'

type ProfilePageProps = {
  token: string
  currentUser: AuthUser
  onAuthExpired: () => void
  onPasswordChanged: () => void
  onUserUpdated: (user: AuthUser) => void
}

const AVATAR_MAX_SIZE = 2 * 1024 * 1024
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}

function isAuthExpiredError(error: unknown) {
  return error instanceof AuthApiError && error.statusCode === 401
}

function getDate(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value: string | null | undefined) {
  const date = getDate(value)

  if (!date) {
    return '暂无记录'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function formatDateTime(value: string | null | undefined) {
  const date = getDate(value)

  if (!date) {
    return '暂无记录'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatRegisterDuration(createdAt: string) {
  const date = getDate(createdAt)

  if (!date) {
    return '暂无记录'
  }

  const days = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)),
  )

  return days === 0 ? '今天加入' : `已加入 ${days} 天`
}

function AccountStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-stone-400">{label}</p>
          <p className="mt-1 truncate text-sm font-semibold text-stone-950">
            {value}
          </p>
        </div>
      </div>
    </div>
  )
}

export function ProfilePage({
  token,
  currentUser,
  onAuthExpired,
  onPasswordChanged,
  onUserUpdated,
}: ProfilePageProps) {
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const [nickname, setNickname] = useState(currentUser.nickname ?? '')
  const [profileMessage, setProfileMessage] = useState('')
  const [profileErrorMessage, setProfileErrorMessage] = useState('')
  const [isProfileSubmitting, setIsProfileSubmitting] = useState(false)
  const [avatarMessage, setAvatarMessage] = useState('')
  const [avatarErrorMessage, setAvatarErrorMessage] = useState('')
  const [isAvatarSubmitting, setIsAvatarSubmitting] = useState(false)

  const [emailDraft, setEmailDraft] = useState(currentUser.email ?? '')
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailChallenge, setEmailChallenge] = useState<{
    challengeId: string
    email: string
    expiresAt: string
    retryAfterSeconds: number
  } | null>(null)
  const [emailCooldownSeconds, setEmailCooldownSeconds] = useState(0)
  const [emailMessage, setEmailMessage] = useState('')
  const [emailErrorMessage, setEmailErrorMessage] = useState('')
  const [isEmailRequesting, setIsEmailRequesting] = useState(false)
  const [isEmailConfirming, setIsEmailConfirming] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordErrorMessage, setPasswordErrorMessage] = useState('')
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false)

  useEffect(() => {
    setNickname(currentUser.nickname ?? '')
  }, [currentUser.nickname])

  useEffect(() => {
    if (!emailChallenge) {
      setEmailDraft(currentUser.email ?? '')
    }
  }, [currentUser.email, emailChallenge])

  useEffect(() => {
    if (!emailChallenge) {
      setEmailCooldownSeconds(0)
      return
    }

    setEmailCooldownSeconds(emailChallenge.retryAfterSeconds)

    const intervalId = window.setInterval(() => {
      setEmailCooldownSeconds((currentSeconds) => Math.max(0, currentSeconds - 1))
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [emailChallenge])

  const previewUser = {
    ...currentUser,
    nickname: nickname || null,
  }

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setAvatarMessage('')
    setAvatarErrorMessage('')

    if (!AVATAR_TYPES.includes(file.type)) {
      setAvatarErrorMessage('头像仅支持 JPG、PNG 或 WebP 格式')
      event.target.value = ''
      return
    }

    if (file.size > AVATAR_MAX_SIZE) {
      setAvatarErrorMessage('头像文件不能超过 2MB')
      event.target.value = ''
      return
    }

    setIsAvatarSubmitting(true)

    try {
      const result = await uploadAvatar(token, file)

      onUserUpdated(result.user)
      setAvatarMessage('头像已更新')
    } catch (error) {
      if (isAuthExpiredError(error)) {
        onAuthExpired()
        return
      }

      setAvatarErrorMessage(getErrorMessage(error))
    } finally {
      setIsAvatarSubmitting(false)
      event.target.value = ''
    }
  }

  const handleAvatarDelete = async () => {
    if (!currentUser.avatarUrl) {
      return
    }

    const shouldDelete = window.confirm('确认移除当前头像吗？')

    if (!shouldDelete) {
      return
    }

    setIsAvatarSubmitting(true)
    setAvatarMessage('')
    setAvatarErrorMessage('')

    try {
      const result = await deleteAvatar(token)

      onUserUpdated(result.user)
      setAvatarMessage('头像已移除')
    } catch (error) {
      if (isAuthExpiredError(error)) {
        onAuthExpired()
        return
      }

      setAvatarErrorMessage(getErrorMessage(error))
    } finally {
      setIsAvatarSubmitting(false)
    }
  }

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsProfileSubmitting(true)
    setProfileMessage('')
    setProfileErrorMessage('')

    try {
      const result = await updateProfile(token, {
        nickname,
        avatarPreset: currentUser.avatarPreset,
      })

      onUserUpdated(result.user)
      setProfileMessage('账户资料已保存')
    } catch (error) {
      if (isAuthExpiredError(error)) {
        onAuthExpired()
        return
      }

      setProfileErrorMessage(getErrorMessage(error))
    } finally {
      setIsProfileSubmitting(false)
    }
  }

  const handleEmailRequest = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    setIsEmailRequesting(true)
    setEmailMessage('')
    setEmailErrorMessage('')

    try {
      const requestedEmail = emailDraft.trim()
      const result = await requestEmailBinding(token, {
        email: requestedEmail,
        currentPassword: emailCurrentPassword,
      })

      setEmailChallenge({
        challengeId: result.challengeId,
        email: requestedEmail,
        expiresAt: result.expiresAt,
        retryAfterSeconds: result.retryAfterSeconds,
      })
      setEmailCode('')
      setEmailMessage('验证码已发送，请查收邮箱')
    } catch (error) {
      if (isAuthExpiredError(error)) {
        onAuthExpired()
        return
      }

      setEmailErrorMessage(getErrorMessage(error))
    } finally {
      setIsEmailRequesting(false)
    }
  }

  const handleEmailConfirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsEmailConfirming(true)
    setEmailMessage('')
    setEmailErrorMessage('')

    if (!emailChallenge) {
      setEmailErrorMessage('请先获取验证码')
      setIsEmailConfirming(false)
      return
    }

    try {
      const result = await confirmEmailBinding(token, {
        challengeId: emailChallenge.challengeId,
        code: emailCode,
      })

      onUserUpdated(result.user)
      setEmailChallenge(null)
      setEmailCode('')
      setEmailCurrentPassword('')
      setEmailMessage('邮箱已绑定并验证')
    } catch (error) {
      if (isAuthExpiredError(error)) {
        onAuthExpired()
        return
      }

      setEmailErrorMessage(getErrorMessage(error))
    } finally {
      setIsEmailConfirming(false)
    }
  }

  const handleEmailCancel = () => {
    setEmailChallenge(null)
    setEmailCode('')
    setEmailCurrentPassword('')
    setEmailMessage('')
    setEmailErrorMessage('')
    setEmailDraft(currentUser.email ?? '')
  }

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsPasswordSubmitting(true)
    setPasswordMessage('')
    setPasswordErrorMessage('')

    try {
      await changePassword(token, {
        currentPassword,
        newPassword,
        confirmPassword,
      })

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage('密码已更新，请重新登录')
      onPasswordChanged()
    } catch (error) {
      if (isAuthExpiredError(error)) {
        onAuthExpired()
        return
      }

      setPasswordErrorMessage(getErrorMessage(error))
    } finally {
      setIsPasswordSubmitting(false)
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-stone-400">
            Account Settings
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-stone-950">
            个人设置
          </h1>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            管理账户资料、头像和登录安全。
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <UserAvatar user={previewUser} size="lg" />
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold tracking-tight text-stone-950">
                {getUserDisplayName(previewUser)}
              </h2>
              <p className="mt-1 truncate text-sm text-stone-500">
                @{currentUser.username}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              ref={avatarInputRef}
              className="sr-only"
              accept="image/jpeg,image/png,image/webp"
              type="file"
              onChange={handleAvatarChange}
            />
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-stone-950 px-4 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
              disabled={isAvatarSubmitting}
              type="button"
              onClick={() => avatarInputRef.current?.click()}
            >
              <Upload size={16} />
              {isAvatarSubmitting ? '处理中...' : '上传头像'}
            </button>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-stone-200 px-4 text-sm font-medium text-stone-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:text-stone-300"
              disabled={isAvatarSubmitting || !currentUser.avatarUrl}
              type="button"
              onClick={() => void handleAvatarDelete()}
            >
              <Trash2 size={16} />
              移除头像
            </button>
          </div>
        </div>

        {avatarMessage ? (
          <p className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {avatarMessage}
          </p>
        ) : null}

        {avatarErrorMessage ? (
          <p className="mt-4 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {avatarErrorMessage}
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AccountStat
          icon={<LogIn size={16} />}
          label="登录次数"
          value={`${currentUser.loginCount ?? 0} 次`}
        />
        <AccountStat
          icon={<CalendarDays size={16} />}
          label="注册时间"
          value={formatDate(currentUser.createdAt)}
        />
        <AccountStat
          icon={<Clock3 size={16} />}
          label="注册时长"
          value={formatRegisterDuration(currentUser.createdAt)}
        />
        <AccountStat
          icon={<ShieldCheck size={16} />}
          label="最近登录"
          value={formatDateTime(currentUser.lastLoginAt)}
        />
      </div>

      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
              <Mail size={16} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-stone-950">
                绑定邮箱
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                用于邮箱登录、密码找回和安全通知。
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 self-start rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600">
            {currentUser.emailVerifiedAt ? (
              <CheckCircle2 size={14} className="text-emerald-600" />
            ) : (
              <Mail size={14} className="text-stone-400" />
            )}
            {currentUser.emailVerifiedAt ? '已验证' : '未绑定'}
          </div>
        </div>

        {currentUser.email ? (
          <p className="mt-5 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
            当前邮箱：<span className="font-medium">{currentUser.email}</span>
            {currentUser.emailVerifiedAt
              ? `，验证时间：${formatDateTime(currentUser.emailVerifiedAt)}`
              : ''}
          </p>
        ) : null}

        {!emailChallenge ? (
          <form className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={handleEmailRequest}>
            <label className="block">
              <span className="text-sm font-medium text-stone-700">
                {currentUser.email ? '新邮箱' : '邮箱'}
              </span>
              <input
                className="mt-2 h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-stone-950 focus:ring-4 focus:ring-stone-100"
                required
                type="email"
                value={emailDraft}
                onChange={(event) => setEmailDraft(event.target.value)}
                placeholder={currentUser.email ? '输入新的邮箱' : '输入邮箱'}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-stone-700">
                当前密码
              </span>
              <input
                className="mt-2 h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-stone-950 focus:ring-4 focus:ring-stone-100"
                minLength={6}
                required
                type="password"
                value={emailCurrentPassword}
                onChange={(event) =>
                  setEmailCurrentPassword(event.target.value)
                }
                placeholder="验证当前密码"
              />
            </label>

            <button
              className="mt-0 inline-flex h-11 items-center justify-center gap-2 self-end rounded-lg bg-stone-950 px-4 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300 lg:mt-7"
              disabled={isEmailRequesting}
              type="submit"
            >
              <Mail size={16} />
              {isEmailRequesting ? '发送中...' : '发送验证码'}
            </button>
          </form>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={handleEmailConfirm}>
            <p className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-700">
              验证码已发送至 {emailChallenge.email}，有效期至{' '}
              {formatDateTime(emailChallenge.expiresAt)}。
            </p>

            <div className="grid gap-4 md:grid-cols-[minmax(0,14rem)_auto_auto]">
              <label className="block">
                <span className="text-sm font-medium text-stone-700">
                  邮箱验证码
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-stone-950 focus:ring-4 focus:ring-stone-100"
                  inputMode="numeric"
                  maxLength={6}
                  minLength={6}
                  required
                  type="text"
                  value={emailCode}
                  onChange={(event) => setEmailCode(event.target.value)}
                  placeholder="6 位验证码"
                />
              </label>

              <button
                className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-lg bg-stone-950 px-4 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                disabled={isEmailConfirming}
                type="submit"
              >
                <CheckCircle2 size={16} />
                {isEmailConfirming ? '验证中...' : '确认绑定'}
              </button>

              <button
                className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-lg border border-stone-200 px-4 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300"
                disabled={isEmailRequesting || emailCooldownSeconds > 0}
                type="button"
                onClick={() => void handleEmailRequest()}
              >
                <RefreshCw size={16} />
                {emailCooldownSeconds > 0
                  ? `${emailCooldownSeconds}s 后重发`
                  : isEmailRequesting
                    ? '发送中...'
                    : '重新发送'}
              </button>
            </div>

            <button
              className="text-sm font-medium text-stone-500 transition hover:text-stone-900"
              type="button"
              onClick={handleEmailCancel}
            >
              取消本次绑定
            </button>
          </form>
        )}

        {emailMessage ? (
          <p className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {emailMessage}
          </p>
        ) : null}

        {emailErrorMessage ? (
          <p className="mt-4 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {emailErrorMessage}
          </p>
        ) : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <form
          className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
          onSubmit={handleProfileSubmit}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
              <Save size={16} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-stone-950">
                账户资料
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                昵称会优先显示在导航和账户区域。
              </p>
            </div>
          </div>

          <label className="mt-5 block">
            <span className="text-sm font-medium text-stone-700">昵称</span>
            <input
              className="mt-2 h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-stone-950 focus:ring-4 focus:ring-stone-100"
              maxLength={30}
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="留空则显示用户名"
            />
          </label>

          {profileMessage ? (
            <p className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {profileMessage}
            </p>
          ) : null}

          {profileErrorMessage ? (
            <p className="mt-4 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {profileErrorMessage}
            </p>
          ) : null}

          <button
            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-stone-950 px-4 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
            disabled={isProfileSubmitting}
            type="submit"
          >
            <Save size={16} />
            {isProfileSubmitting ? '保存中...' : '保存账户资料'}
          </button>
        </form>

        <form
          className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
          onSubmit={handlePasswordSubmit}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
              <KeyRound size={16} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-stone-950">
                安全设置
              </h2>
              <p className="mt-1 text-sm text-stone-500">修改登录密码。</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-stone-700">
                当前密码
              </span>
              <input
                className="mt-2 h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-stone-950 focus:ring-4 focus:ring-stone-100"
                minLength={6}
                required
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="请输入当前密码"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-stone-700">新密码</span>
              <input
                className="mt-2 h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-stone-950 focus:ring-4 focus:ring-stone-100"
                minLength={6}
                required
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="至少 6 位"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-stone-700">
                确认新密码
              </span>
              <input
                className="mt-2 h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-stone-950 focus:ring-4 focus:ring-stone-100"
                minLength={6}
                required
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="请再次输入新密码"
              />
            </label>
          </div>

          {passwordMessage ? (
            <p className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {passwordMessage}
            </p>
          ) : null}

          {passwordErrorMessage ? (
            <p className="mt-4 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {passwordErrorMessage}
            </p>
          ) : null}

          <button
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 text-sm font-medium text-stone-800 transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300"
            disabled={isPasswordSubmitting}
            type="submit"
          >
            <KeyRound size={16} />
            {isPasswordSubmitting ? '更新中...' : '更新密码'}
          </button>
        </form>
      </div>
    </section>
  )
}
