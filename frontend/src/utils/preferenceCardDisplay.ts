import type { PreferenceCard } from '../api/cards'

export function getPreferenceCardTransportLabel(card: PreferenceCard) {
  return card.driveMode
    ? `${card.transportMode} · ${card.driveMode}`
    : card.transportMode
}
