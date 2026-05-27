import type { GenerationMode } from '../api/plan'

export function getGenerationLabel(generationMode: GenerationMode | null) {
  if (generationMode === 'llm') {
    return 'AI Plan'
  }

  if (generationMode === 'mock-fallback') {
    return 'Local Backup'
  }

  return 'Local Plan'
}

export function getGenerationDescription(
  generationMode: GenerationMode | null,
) {
  if (generationMode === 'llm') {
    return '本次结果由后端配置的大模型生成，并已保存到历史记录。'
  }

  if (generationMode === 'mock-fallback') {
    return '在线模型暂时不可用，系统已使用本地模板生成可预览方案。'
  }

  return '当前未启用在线模型，本次结果由本地模板生成。'
}
