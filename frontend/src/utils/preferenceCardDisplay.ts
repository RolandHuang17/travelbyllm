import type { PreferenceCard } from '../api/cards'

export function getPreferenceCardEmoji(card: PreferenceCard) {
  if (card.transportMode === '自驾') {
    return '🚗'
  }

  if (card.scenicPreference === '自然风光') {
    return '🏞️'
  }

  if (card.scenicPreference === '城市漫游') {
    return '🏙️'
  }

  if (card.scenicPreference === '休闲躺平') {
    return '🌴'
  }

  if (card.scenicPreference === '人文历史') {
    return '🏛️'
  }

  if (card.travelStyle === '特种兵旅游') {
    return '⚡'
  }

  if (card.travelStyle === '佛系慢游') {
    return '🍃'
  }

  return '🧭'
}

export function getPreferenceCardTransportLabel(card: PreferenceCard) {
  return card.driveMode
    ? `${card.transportMode} · ${card.driveMode}`
    : card.transportMode
}
