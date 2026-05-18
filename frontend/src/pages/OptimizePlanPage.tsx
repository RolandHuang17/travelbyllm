import { OptimizePlanPanel } from '../components/OptimizePlanPanel'

type OptimizePlanPageProps = {
  token: string
  onAuthExpired: () => void
  onPlanGenerated: () => void
}

export function OptimizePlanPage({
  token,
  onAuthExpired,
  onPlanGenerated,
}: OptimizePlanPageProps) {
  return (
    <OptimizePlanPanel
      token={token}
      onAuthExpired={onAuthExpired}
      onPlanGenerated={onPlanGenerated}
    />
  )
}
