import { HistoryPanel } from '../components/HistoryPanel'

type HistoryPageProps = {
  token: string
  onAuthExpired: () => void
  refreshSignal: number
}

export function HistoryPage({
  token,
  onAuthExpired,
  refreshSignal,
}: HistoryPageProps) {
  return (
    <HistoryPanel
      token={token}
      onAuthExpired={onAuthExpired}
      refreshSignal={refreshSignal}
    />
  )
}
