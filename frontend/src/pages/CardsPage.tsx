import { PreferenceCardsPanel } from '../components/PreferenceCardsPanel'

type CardsPageProps = {
  token: string
  onAuthExpired: () => void
}

export function CardsPage({ token, onAuthExpired }: CardsPageProps) {
  return <PreferenceCardsPanel token={token} onAuthExpired={onAuthExpired} />
}
