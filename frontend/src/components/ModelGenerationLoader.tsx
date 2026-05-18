import type { LlmStatus } from '../api/plan'

type ModelGenerationLoaderProps = {
  llmStatus: LlmStatus | null
}

const progressSteps = ['理解偏好', '构思路线', '编排行程', '写入历史']

export function ModelGenerationLoader({
  llmStatus,
}: ModelGenerationLoaderProps) {
  const isLlmEnabled = Boolean(llmStatus?.configured)
  const modelName = llmStatus?.model ?? '模型状态读取中'

  return (
    <div className="relative overflow-hidden rounded-3xl border border-sky-200 bg-slate-950 px-6 py-8 text-white shadow-2xl shadow-sky-950/20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.28),transparent_32%),radial-gradient(circle_at_80%_15%,rgba(14,165,233,0.2),transparent_28%),linear-gradient(135deg,rgba(15,23,42,1),rgba(8,47,73,0.95))]" />
      <div className="model-scanline absolute inset-0 opacity-40" />

      <div className="relative z-10 grid gap-7 lg:grid-cols-[12rem_1fr] lg:items-center">
        <div className="relative mx-auto flex h-44 w-44 items-center justify-center">
          <div className="model-orbit model-orbit-outer absolute inset-0 rounded-full border border-sky-300/40" />
          <div className="model-orbit model-orbit-inner absolute inset-6 rounded-full border border-cyan-200/30" />
          <div className="absolute h-24 w-24 rounded-full bg-sky-400/20 blur-2xl" />
          <div className="model-core relative flex h-24 w-24 items-center justify-center rounded-full border border-white/20 bg-white/10 text-center backdrop-blur">
            <span className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-100">
              LLM
            </span>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200">
            Generating
          </p>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            {isLlmEnabled
              ? `正在由模型 ${modelName} 生成`
              : '正在使用本地 Mock 模板生成'}
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-sky-100/80">
            {isLlmEnabled
              ? '大模型正在根据城市、天数和偏好组合旅行方案，通常需要几十秒。页面没有卡住，它只是在认真写攻略。'
              : '当前后端未配置可用大模型，系统会使用本地模板完成兜底生成。'}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {progressSteps.map((step, index) => (
              <div
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur"
                key={step}
              >
                <div
                  className="model-pulse-dot mb-3 h-2 w-2 rounded-full bg-cyan-200"
                  style={{ animationDelay: `${index * 0.24}s` }}
                />
                <p className="text-sm font-medium text-white">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
