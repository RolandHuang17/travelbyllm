import type { Dispatch, SetStateAction } from 'react'
import { CityPlanPanel } from '../components/CityPlanPanel'
import type { CityPlanPanelState } from '../components/cityPlanPanelState'

type CityPlanPageProps = {
  token: string
  panelState: CityPlanPanelState
  onPanelStateChange: Dispatch<SetStateAction<CityPlanPanelState>>
  onAuthExpired: () => void
  onPlanGenerated: () => void
}

export function CityPlanPage({
  token,
  panelState,
  onPanelStateChange,
  onAuthExpired,
  onPlanGenerated,
}: CityPlanPageProps) {
  return (
    <CityPlanPanel
      token={token}
      state={panelState}
      onStateChange={onPanelStateChange}
      onAuthExpired={onAuthExpired}
      onPlanGenerated={onPlanGenerated}
    />
  )
}
