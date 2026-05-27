import type { TravelRecord } from '../api/history'
import type {
  CityPlanResult,
  GenerationMode,
} from '../api/plan'
import {
  getDefaultLocationSelection,
  type LocationSelection,
} from '../utils/location'

export type CityPlanFormState = {
  targetCity: LocationSelection
  departureCity: LocationSelection
  travelDays: string
  startDate: string
  cardId: string
  temporaryPreference: string
  weatherMode: string
}

type CardBackedField = 'travelDays' | 'startDate'

export type CardFieldSources = Partial<Record<CardBackedField, string>>

const initialFormState: CityPlanFormState = {
  targetCity: getDefaultLocationSelection('广东省广州市'),
  departureCity: getDefaultLocationSelection('广东省深圳市'),
  travelDays: '3',
  startDate: '',
  cardId: '',
  temporaryPreference: '',
  weatherMode: '',
}

export type CityPlanPanelState = {
  form: CityPlanFormState
  plan: CityPlanResult | null
  record: TravelRecord | null
  generationMode: GenerationMode | null
  generationModel: string
  message: string
  errorMessage: string
  cardFieldSources: CardFieldSources
  selectedPreferenceCardName: string
  isInputExpanded: boolean
}

function cloneCityPlanFormState(form: CityPlanFormState): CityPlanFormState {
  return {
    ...form,
    targetCity: { ...form.targetCity },
    departureCity: { ...form.departureCity },
  }
}

export function createInitialCityPlanPanelState(): CityPlanPanelState {
  return {
    form: cloneCityPlanFormState(initialFormState),
    plan: null,
    record: null,
    generationMode: null,
    generationModel: '',
    message: '',
    errorMessage: '',
    cardFieldSources: {},
    selectedPreferenceCardName: '',
    isInputExpanded: true,
  }
}
