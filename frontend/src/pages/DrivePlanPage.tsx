import { DrivePlanPanel } from '../components/DrivePlanPanel'

type DrivePlanPageProps = {
  token: string
  onAuthExpired: () => void
  onPlanGenerated: () => void
}

export function DrivePlanPage({
  token,
  onAuthExpired,
  onPlanGenerated,
}: DrivePlanPageProps) {
  return (
    <DrivePlanPanel
      token={token}
      onAuthExpired={onAuthExpired}
      onPlanGenerated={onPlanGenerated}
    />
  )
}
