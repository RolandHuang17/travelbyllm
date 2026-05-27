import path from 'path'

export const uploadsRoot = path.resolve(__dirname, '..', '..', 'uploads')
export const avatarUploadsDir = path.join(uploadsRoot, 'avatars')

export function getAvatarUrl(filename: string) {
  return `/uploads/avatars/${filename}`
}

export function getAvatarFilePath(avatarUrl: string) {
  if (!avatarUrl.startsWith('/uploads/avatars/')) {
    return null
  }

  return path.join(avatarUploadsDir, path.basename(avatarUrl))
}
