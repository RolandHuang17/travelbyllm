import type { GenerationMode } from '../api/plan'

export function getGenerationLabel(generationMode: GenerationMode | null) {
  if (generationMode === 'llm') {
    return 'AI Plan'
  }

  if (generationMode === 'mock-fallback') {
    return 'Mock Fallback'
  }

  return 'Mock Plan'
}

export function getGenerationDescription(
  generationMode: GenerationMode | null,
) {
  if (generationMode === 'llm') {
    return '本次结果由后端配置的大模型生成，并已保存到历史记录。'
  }

  if (generationMode === 'mock-fallback') {
    return '本次调用大模型失败，系统已自动使用本地模板兜底生成。'
  }

  return '当前后端未配置可用大模型，本次结果由本地模板生成。'
}
