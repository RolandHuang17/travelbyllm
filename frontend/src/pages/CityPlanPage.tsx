import { CityPlanPanel } from '../components/CityPlanPanel'

type CityPlanPageProps = {
  token: string
  onAuthExpired: () => void
  onPlanGenerated: () => void
}

export function CityPlanPage({
  token,
  onAuthExpired,
  onPlanGenerated,
}: CityPlanPageProps) {
  return (
    <CityPlanPanel
      token={token}
      onAuthExpired={onAuthExpired}
      onPlanGenerated={onPlanGenerated}
    />
  )
}
