import type { AuthUser } from '../api/auth'

export const AVATAR_PRESETS = [
  {
    id: 'sky',
    label: '晴空蓝',
    className: 'bg-gradient-to-br from-sky-500 to-cyan-300 text-white',
  },
  {
    id: 'forest',
    label: '山林绿',
    className: 'bg-gradient-to-br from-emerald-600 to-lime-300 text-white',
  },
  {
    id: 'sunset',
    label: '落日橙',
    className: 'bg-gradient-to-br from-orange-500 to-amber-300 text-white',
  },
  {
    id: 'ocean',
    label: '深海蓝',
    className: 'bg-gradient-to-br from-blue-800 to-indigo-400 text-white',
  },
  {
    id: 'stone',
    label: '岩石灰',
    className: 'bg-gradient-to-br from-slate-700 to-slate-400 text-white',
  },
  {
    id: 'rose',
    label: '玫瑰红',
    className: 'bg-gradient-to-br from-rose-500 to-pink-300 text-white',
  },
] as const

export type AvatarPresetId = (typeof AVATAR_PRESETS)[number]['id']

export function getAvatarPreset(avatarPreset: string | null | undefined) {
  return (
    AVATAR_PRESETS.find((preset) => preset.id === avatarPreset) ??
    AVATAR_PRESETS[0]
  )
}

export function getUserDisplayName(user: AuthUser) {
  return user.nickname?.trim() || user.username
}

export function getUserInitial(user: AuthUser) {
  return getUserDisplayName(user).trim().slice(0, 1).toUpperCase() || 'U'
}
