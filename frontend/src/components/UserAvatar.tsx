import type { AuthUser } from '../api/auth'
import { getAvatarPreset, getUserInitial } from '../utils/avatar'

type UserAvatarProps = {
  user: AuthUser
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'h-9 w-9 text-sm',
  md: 'h-11 w-11 text-base',
  lg: 'h-16 w-16 text-2xl',
}

export function UserAvatar({ user, size = 'md' }: UserAvatarProps) {
  const preset = getAvatarPreset(user.avatarPreset)

  if (user.avatarUrl) {
    return (
      <img
        className={`inline-flex shrink-0 rounded-full object-cover shadow-sm ring-1 ring-white/70 ${sizeClasses[size]}`}
        src={user.avatarUrl}
        alt=""
        aria-hidden="true"
      />
    )
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold shadow-sm ring-1 ring-white/70 ${preset.className} ${sizeClasses[size]}`}
      aria-hidden="true"
    >
      {getUserInitial(user)}
    </span>
  )
}
