import { chinaLocations, type LocationAreaNode } from '../data/chinaLocations'

export type LocationSelection = {
  provinceCode: string
  cityCode: string
  countyCode: string | null
}

const directAdminProvinceNames = new Set(['北京市', '天津市', '上海市', '重庆市'])

function findNode(nodes: LocationAreaNode[], code: string) {
  return nodes.find((node) => node.code === code) ?? null
}

function findNodeDeep(nodes: LocationAreaNode[], code: string): LocationAreaNode | null {
  for (const node of nodes) {
    if (node.code === code) {
      return node
    }

    const matchedChild = node.children ? findNodeDeep(node.children, code) : null

    if (matchedChild) {
      return matchedChild
    }
  }

  return null
}

function normalizeLocationText(text: string) {
  return text.trim().replace(/\s+/g, '')
}

function stripCommonSuffix(text: string) {
  return text.replace(/(省|市|县|区|自治州|地区|盟|特别行政区)$/u, '')
}

function namesMatch(nodeName: string, text: string) {
  const normalizedNodeName = normalizeLocationText(nodeName)
  const normalizedText = normalizeLocationText(text)
  const strippedNodeName = stripCommonSuffix(normalizedNodeName)
  const strippedText = stripCommonSuffix(normalizedText)

  return (
    normalizedText === normalizedNodeName ||
    normalizedText === strippedNodeName ||
    strippedText === normalizedNodeName ||
    strippedText === strippedNodeName
  )
}

export function getProvinces() {
  return chinaLocations
}

export function getCities(provinceCode: string) {
  return findNode(chinaLocations, provinceCode)?.children ?? []
}

export function getCounties(provinceCode: string, cityCode: string) {
  return findNode(getCities(provinceCode), cityCode)?.children ?? []
}

export function getLocationNodeName(code: string) {
  return findNodeDeep(chinaLocations, code)?.name ?? ''
}

export function getDefaultLocationSelection(
  fallbackText = '广东省广州市',
): LocationSelection {
  return (
    parseLocationText(fallbackText) ?? {
      provinceCode: '440000',
      cityCode: '440100',
      countyCode: null,
    }
  )
}

export function formatLocationSelection(selection: LocationSelection) {
  const province = findNode(chinaLocations, selection.provinceCode)
  const city = province ? findNode(province.children ?? [], selection.cityCode) : null
  const county =
    city && selection.countyCode
      ? findNode(city.children ?? [], selection.countyCode)
      : null

  if (!province || !city) {
    return ''
  }

  const parts = [province.name]

  if (
    !(
      directAdminProvinceNames.has(province.name) &&
      (city.name === province.name || city.name === '市辖区')
    )
  ) {
    parts.push(city.name)
  }

  if (county && county.name !== '市辖区') {
    parts.push(county.name)
  }

  return parts.join('')
}

export function parseLocationText(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const text = normalizeLocationText(value)

  if (!text) {
    return null
  }

  for (const province of chinaLocations) {
    for (const city of province.children ?? []) {
      const cityMatches = text.includes(city.name) || namesMatch(city.name, text)
      const counties = city.children ?? []
      const matchedCounty =
        counties.find(
          (county) => county.name !== '市辖区' && text.includes(county.name),
        ) ??
        counties.find(
          (county) => county.name !== '市辖区' && namesMatch(county.name, text),
        )

      if (!cityMatches && !matchedCounty) {
        continue
      }

      return {
        provinceCode: province.code,
        cityCode: city.code,
        countyCode: matchedCounty?.code ?? null,
      }
    }
  }

  return null
}
