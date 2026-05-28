import { useSearchParams } from 'react-router-dom'
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
  const [searchParams] = useSearchParams()
  const recordId = searchParams.get('recordId') ?? ''

  return (
    <OptimizePlanPanel
      key={recordId}
      token={token}
      onAuthExpired={onAuthExpired}
      onPlanGenerated={onPlanGenerated}
    />
  )
}
