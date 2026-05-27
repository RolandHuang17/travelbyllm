import {
  formatLocationSelection,
  getCities,
  getCounties,
  getProvinces,
  getLocationNodeName,
  type LocationSelection,
} from '../utils/location'

type LocationSelectProps = {
  label: string
  value: LocationSelection
  onChange: (value: LocationSelection) => void
  required?: boolean
  helperText?: string
  accent?: 'sky' | 'orange'
}

function getSelectShellClass(accent: 'sky' | 'orange') {
  const focusClass =
    accent === 'orange'
      ? 'focus-within:border-amber-500 focus-within:ring-amber-100'
      : 'focus-within:border-emerald-500 focus-within:ring-emerald-100'

  return [
    'relative mt-2 flex min-h-11 w-full items-center justify-center rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm transition focus-within:ring-4',
    focusClass,
  ].join(' ')
}

function getSelectClass() {
  return 'absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-xl bg-transparent opacity-0'
}

function NativeSelectOverlay({
  value,
  onChange,
  required,
  children,
}: {
  value: string
  onChange: (value: string) => void
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <select
      className={getSelectClass()}
      required={required}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {children}
    </select>
  )
}

export function LocationSelect({
  label,
  value,
  onChange,
  required = false,
  helperText,
  accent = 'sky',
}: LocationSelectProps) {
  const provinces = getProvinces()
  const cities = getCities(value.provinceCode)
  const counties = getCounties(value.provinceCode, value.cityCode)
  const selectShellClass = getSelectShellClass(accent)
  const formattedLocation = formatLocationSelection(value)
  const provinceName = getLocationNodeName(value.provinceCode)
  const cityName = getLocationNodeName(value.cityCode)
  const countyName = value.countyCode
    ? getLocationNodeName(value.countyCode)
    : '不选择县级区划'

  const handleProvinceChange = (provinceCode: string) => {
    const nextCities = getCities(provinceCode)
    const nextCityCode = nextCities[0]?.code ?? ''

    onChange({
      provinceCode,
      cityCode: nextCityCode,
      countyCode: null,
    })
  }

  const handleCityChange = (cityCode: string) => {
    onChange({
      ...value,
      cityCode,
      countyCode: null,
    })
  }

  const handleCountyChange = (countyCode: string) => {
    onChange({
      ...value,
      countyCode: countyCode || null,
    })
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium text-stone-700">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </legend>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-2">
        <label className="block">
          <span className="sr-only">省份</span>
          <div className={selectShellClass}>
            <span className="w-full break-words px-3 pr-6 text-center font-medium leading-5 text-stone-950">
              {provinceName}
            </span>
            <span className="pointer-events-none absolute right-3 text-stone-500">
              ⌄
            </span>
            <NativeSelectOverlay
              required={required}
              value={value.provinceCode}
              onChange={handleProvinceChange}
            >
              {provinces.map((province) => (
                <option key={province.code} value={province.code}>
                  {province.name}
                </option>
              ))}
            </NativeSelectOverlay>
          </div>
        </label>

        <label className="block">
          <span className="sr-only">地级市</span>
          <div className={selectShellClass}>
            <span className="w-full break-words px-3 pr-6 text-center font-medium leading-5 text-stone-950">
              {cityName}
            </span>
            <span className="pointer-events-none absolute right-3 text-stone-500">
              ⌄
            </span>
            <NativeSelectOverlay
              required={required}
              value={value.cityCode}
              onChange={handleCityChange}
            >
              {cities.map((city) => (
                <option key={city.code} value={city.code}>
                  {city.name}
                </option>
              ))}
            </NativeSelectOverlay>
          </div>
        </label>

        <label className="block">
          <span className="sr-only">县级区划</span>
          <div className={selectShellClass}>
            <span className="w-full break-words px-3 pr-6 text-center font-medium leading-5 text-stone-950">
              {countyName}
            </span>
            <span className="pointer-events-none absolute right-3 text-stone-500">
              ⌄
            </span>
            <NativeSelectOverlay
              value={value.countyCode ?? ''}
              onChange={handleCountyChange}
            >
              <option value="">不选择县级区划</option>
              {counties
                .filter((county) => county.name !== '市辖区')
                .map((county) => (
                  <option key={county.code} value={county.code}>
                    {county.name}
                  </option>
                ))}
            </NativeSelectOverlay>
          </div>
        </label>
      </div>

      <p className="mt-1.5 text-xs leading-5 text-stone-500">
        {helperText ??
          `当前：${formattedLocation || '请选择省份和地级市'}。县级可选。`}
      </p>
    </fieldset>
  )
}
