type ExportItineraryToPdfInput = {
  element: HTMLElement
  title: string
  fallbackText: string
}

type JsPdfConstructor = (typeof import('jspdf'))['jsPDF']

type CanvasPage = {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
}

const COLOR_STYLE_PROPERTIES = [
  'background-color',
  'background-image',
  'border-bottom-color',
  'border-left-color',
  'border-right-color',
  'border-top-color',
  'box-shadow',
  'caret-color',
  'color',
  'column-rule-color',
  'fill',
  'outline-color',
  'stroke',
  'text-decoration-color',
  'text-emphasis-color',
  'text-shadow',
]

const MODERN_COLOR_SYNTAX_PATTERN = /\b(?:oklab|oklch|color)\(/i

function sanitizeFilePart(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 48)
}

function getDateStamp() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}${month}${day}`
}

function getFileName(title: string) {
  return `TravelByLLM-${sanitizeFilePart(title) || 'itinerary'}-${getDateStamp()}.pdf`
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function parseCssNumber(value: string) {
  const trimmed = value.trim()

  if (!trimmed || trimmed === 'none') {
    return null
  }

  const parsed = Number.parseFloat(trimmed)

  return Number.isFinite(parsed) ? parsed : null
}

function parseCssUnitInterval(value: string) {
  const parsed = parseCssNumber(value)

  if (parsed === null) {
    return null
  }

  return value.trim().endsWith('%') ? parsed / 100 : parsed
}

function parseCssAlpha(value?: string) {
  if (!value) {
    return 1
  }

  return clamp(parseCssUnitInterval(value) ?? 1)
}

function parseCssHue(value: string) {
  const parsed = parseCssNumber(value)

  if (parsed === null) {
    return null
  }

  const trimmed = value.trim()

  if (trimmed.endsWith('rad')) {
    return (parsed * 180) / Math.PI
  }

  if (trimmed.endsWith('turn')) {
    return parsed * 360
  }

  if (trimmed.endsWith('grad')) {
    return parsed * 0.9
  }

  return parsed
}

function linearRgbToSrgb(value: number) {
  if (value <= 0.0031308) {
    return 12.92 * value
  }

  return 1.055 * value ** (1 / 2.4) - 0.055
}

function formatRgba(red: number, green: number, blue: number, alpha = 1) {
  const rgb = [red, green, blue].map((channel) =>
    Math.round(clamp(channel) * 255),
  )

  if (alpha >= 1) {
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
  }

  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${Number(alpha.toFixed(3))})`
}

function oklabToRgba(lightness: number, a: number, b: number, alpha = 1) {
  const long = lightness + 0.3963377774 * a + 0.2158037573 * b
  const medium = lightness - 0.1055613458 * a - 0.0638541728 * b
  const short = lightness - 0.0894841775 * a - 1.291485548 * b
  const longLinear = long ** 3
  const mediumLinear = medium ** 3
  const shortLinear = short ** 3
  const red =
    4.0767416621 * longLinear -
    3.3077115913 * mediumLinear +
    0.2309699292 * shortLinear
  const green =
    -1.2684380046 * longLinear +
    2.6097574011 * mediumLinear -
    0.3413193965 * shortLinear
  const blue =
    -0.0041960863 * longLinear -
    0.7034186147 * mediumLinear +
    1.707614701 * shortLinear

  return formatRgba(
    linearRgbToSrgb(red),
    linearRgbToSrgb(green),
    linearRgbToSrgb(blue),
    alpha,
  )
}

function splitColorChannels(content: string) {
  const [channels, alpha] = content.split('/').map((part) => part.trim())

  return {
    alpha,
    channels: channels.split(/\s+/).filter(Boolean),
  }
}

function convertOklchColor(content: string) {
  const { alpha, channels } = splitColorChannels(content)
  const lightness = parseCssUnitInterval(channels[0] ?? '')
  const chroma = parseCssNumber(channels[1] ?? '')
  const hue = parseCssHue(channels[2] ?? '')

  if (lightness === null || chroma === null || hue === null) {
    return null
  }

  const hueRadians = (hue * Math.PI) / 180

  return oklabToRgba(
    lightness,
    chroma * Math.cos(hueRadians),
    chroma * Math.sin(hueRadians),
    parseCssAlpha(alpha),
  )
}

function convertOklabColor(content: string) {
  const { alpha, channels } = splitColorChannels(content)
  const lightness = parseCssUnitInterval(channels[0] ?? '')
  const a = parseCssNumber(channels[1] ?? '')
  const b = parseCssNumber(channels[2] ?? '')

  if (lightness === null || a === null || b === null) {
    return null
  }

  return oklabToRgba(lightness, a, b, parseCssAlpha(alpha))
}

function convertSrgbColor(content: string) {
  const { alpha, channels } = splitColorChannels(content)

  if (channels[0] !== 'srgb') {
    return null
  }

  const rgbChannels = channels.slice(1, 4).map((channel) => {
    const parsed = parseCssUnitInterval(channel)

    return parsed === null ? null : clamp(parsed)
  })

  if (rgbChannels.some((channel) => channel === null)) {
    return null
  }

  return formatRgba(
    rgbChannels[0] ?? 0,
    rgbChannels[1] ?? 0,
    rgbChannels[2] ?? 0,
    parseCssAlpha(alpha),
  )
}

function normalizeModernColorSyntax(value: string) {
  if (!MODERN_COLOR_SYNTAX_PATTERN.test(value)) {
    return value
  }

  return value
    .replace(/oklch\(([^()]*)\)/gi, (match, content: string) => {
      return convertOklchColor(content) ?? match
    })
    .replace(/oklab\(([^()]*)\)/gi, (match, content: string) => {
      return convertOklabColor(content) ?? match
    })
    .replace(/color\(([^()]*)\)/gi, (match, content: string) => {
      return convertSrgbColor(content) ?? match
    })
}

function prepareCloneForCanvas(clonedElement: HTMLElement) {
  const clonedWindow = clonedElement.ownerDocument.defaultView

  if (!clonedWindow) {
    return
  }

  const nodes = [
    clonedElement,
    ...Array.from(clonedElement.querySelectorAll<HTMLElement | SVGElement>('*')),
  ]

  for (const node of nodes) {
    const computedStyle = clonedWindow.getComputedStyle(node)

    for (const property of COLOR_STYLE_PROPERTIES) {
      const value = computedStyle.getPropertyValue(property)
      const normalizedValue = normalizeModernColorSyntax(value)

      if (normalizedValue !== value) {
        node.style.setProperty(property, normalizedValue, 'important')
      }
    }
  }
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const lines: string[] = []
  let line = ''

  for (const character of Array.from(text)) {
    const candidate = line + character

    if (!line || context.measureText(candidate).width <= maxWidth) {
      line = candidate
      continue
    }

    lines.push(line.trimEnd())
    line = character.trimStart()
  }

  if (line) {
    lines.push(line.trimEnd())
  }

  return lines.length ? lines : ['']
}

function createCanvasPage(
  width: number,
  height: number,
  scale: number,
): CanvasPage {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('浏览器不支持 Canvas，无法生成 PDF。')
  }

  canvas.width = Math.ceil(width * scale)
  canvas.height = Math.ceil(height * scale)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  context.scale(scale, scale)
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)

  return { canvas, context }
}

function renderFallbackTextPdf({
  fallbackText,
  fileName,
  jsPDF,
  title,
}: {
  fallbackText: string
  fileName: string
  jsPDF: JsPdfConstructor
  title: string
}) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 44
  const maxTextWidth = pageWidth - margin * 2
  const pageBottom = pageHeight - margin
  const scale = Math.max(2, Math.ceil(window.devicePixelRatio || 1))
  const bodyText = fallbackText.trim() || '暂无可导出的行程内容。'
  const pages: CanvasPage[] = []
  let currentPage = createCanvasPage(pageWidth, pageHeight, scale)
  let y = margin

  const addPage = () => {
    pages.push(currentPage)
    currentPage = createCanvasPage(pageWidth, pageHeight, scale)
    y = margin
  }

  currentPage.context.fillStyle = '#0f172a'
  currentPage.context.font =
    '600 18px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

  for (const line of wrapCanvasText(
    currentPage.context,
    title || 'TravelByLLM 行程',
    maxTextWidth,
  )) {
    currentPage.context.fillText(line, margin, y)
    y += 24
  }

  y += 12
  currentPage.context.font =
    '400 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

  for (const paragraph of bodyText.split('\n')) {
    if (!paragraph.trim()) {
      y += 12
      continue
    }

    const lines = wrapCanvasText(currentPage.context, paragraph, maxTextWidth)

    for (const line of lines) {
      if (y > pageBottom) {
        addPage()
        currentPage.context.font =
          '400 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      }

      currentPage.context.fillStyle = '#334155'
      currentPage.context.fillText(line, margin, y)
      y += 18
    }

    y += 6
  }

  pages.push(currentPage)

  pages.forEach((page, index) => {
    page.context.fillStyle = '#94a3b8'
    page.context.font =
      '400 10px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    page.context.textAlign = 'right'
    page.context.fillText(
      `${index + 1} / ${pages.length}`,
      pageWidth - margin,
      pageHeight - 22,
    )

    if (index > 0) {
      pdf.addPage()
    }

    pdf.addImage(
      page.canvas.toDataURL('image/png'),
      'PNG',
      0,
      0,
      pageWidth,
      pageHeight,
    )
  })

  pdf.save(fileName)
}

export async function exportItineraryToPdf({
  element,
  title,
  fallbackText,
}: ExportItineraryToPdfInput) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])
  const fileName = getFileName(title)

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      allowTaint: true,
      onclone: (_document, clonedElement) => {
        prepareCloneForCanvas(clonedElement)
      },
    })
    const imageData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
    })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imageWidth = pageWidth
    const imageHeight = (canvas.height * imageWidth) / canvas.width
    let remainingHeight = imageHeight
    let imageY = 0

    pdf.addImage(imageData, 'PNG', 0, imageY, imageWidth, imageHeight)
    remainingHeight -= pageHeight

    while (remainingHeight > 0) {
      imageY = remainingHeight - imageHeight
      pdf.addPage()
      pdf.addImage(imageData, 'PNG', 0, imageY, imageWidth, imageHeight)
      remainingHeight -= pageHeight
    }

    pdf.save(fileName)
  } catch {
    renderFallbackTextPdf({ fallbackText, fileName, jsPDF, title })
  }
}
