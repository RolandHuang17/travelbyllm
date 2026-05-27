import type { LlmStatus } from '../api/plan'
import {
  CalendarCheck,
  CheckCircle2,
  Clock3,
  MapPinned,
  Route,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

type ModelGenerationLoaderProps = {
  llmStatus: LlmStatus | null
  variant: 'city' | 'drive' | 'optimize'
  contextItems?: {
    label: string
    value: string
  }[]
}

const progressSteps = [
  '确认需求',
  '整理动线',
  '补充天气与交通',
  '保存结果',
]

type LoaderVariantConfig = {
  accent: string
  background: string
  border: string
  glow: string
  icon: LucideIcon
  iconBackground: string
  iconText: string
  eyebrow: string
  title: string
  description: string
}

const variantConfig: Record<ModelGenerationLoaderProps['variant'], LoaderVariantConfig> =
  {
    city: {
      accent: 'text-emerald-700',
      background: 'bg-emerald-50/45',
      border: 'border-emerald-100',
      glow: 'bg-emerald-200/45',
      icon: MapPinned,
      iconBackground: 'bg-emerald-100',
      iconText: 'text-emerald-700',
      eyebrow: '请求已接收',
      title: '正在整理城市行程',
      description:
        '系统正在把城市、天数和偏好整理成可执行攻略，通常需要几十秒。完成后会自动展示并写入历史记录。',
    },
    drive: {
      accent: 'text-amber-700',
      background: 'bg-amber-50/50',
      border: 'border-amber-100',
      glow: 'bg-amber-200/45',
      icon: Route,
      iconBackground: 'bg-amber-100',
      iconText: 'text-amber-700',
      eyebrow: '路线已提交',
      title: '正在整理自驾路线',
      description:
        '系统正在核对城市顺序、停留节奏和沿途建议，通常需要几十秒。完成后会自动展示并写入历史记录。',
    },
    optimize: {
      accent: 'text-teal-700',
      background: 'bg-teal-50/50',
      border: 'border-teal-100',
      glow: 'bg-teal-200/45',
      icon: Sparkles,
      iconBackground: 'bg-teal-100',
      iconText: 'text-teal-700',
      eyebrow: '优化已开始',
      title: '正在优化已有方案',
      description:
        '系统正在读取原行程并应用新的旅行要求，通常需要几十秒。完成后会自动展示，并作为新的历史记录保存。',
    },
  }

function getModelStatusText(llmStatus: LlmStatus | null) {
  if (!llmStatus) {
    return '模型状态读取中，任务已在等待队列中'
  }

  if (!llmStatus.configured) {
    return '当前使用本地模板生成，会先给出一版可预览方案'
  }

  return `当前模型：${llmStatus.model}`
}

export function ModelGenerationLoader({
  llmStatus,
  variant,
  contextItems = [],
}: ModelGenerationLoaderProps) {
  const config = variantConfig[variant]
  const StatusIcon = config.icon

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border bg-white px-5 py-6 text-stone-950 shadow-[0_18px_55px_rgba(68,64,60,0.08)] sm:px-6 sm:py-7 ${config.border}`}
    >
      <div
        className={`model-soft-glow pointer-events-none absolute -right-14 -top-20 h-44 w-44 rounded-full blur-3xl ${config.glow}`}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-stone-200 to-transparent" />

      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <div
              className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${config.iconBackground}`}
            >
              <span
                className={`model-calm-ring absolute inset-0 rounded-2xl border ${config.border}`}
              />
              <StatusIcon className={config.iconText} size={24} />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${config.background} ${config.accent}`}
                >
                  <CheckCircle2 size={14} />
                  {config.eyebrow}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
                  <Clock3 size={14} />
                  结果会自动展示
                </span>
              </div>

              <h3 className="mt-4 text-xl font-semibold tracking-tight text-stone-950 sm:text-2xl">
                {config.title}
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                {config.description}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-sm font-medium text-stone-600 lg:max-w-72">
            {getModelStatusText(llmStatus)}
          </div>
        </div>

        {contextItems.length ? (
          <div className="grid gap-3 border-y border-stone-100 py-4 md:grid-cols-3">
            {contextItems.map((item) => (
              <div className="min-w-0" key={item.label}>
                <p className="text-xs font-medium text-stone-400">
                  {item.label}
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-stone-800">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-4">
          {progressSteps.map((step, index) => (
            <div className="flex items-center gap-3" key={step}>
              <span
                className={`model-wait-dot h-2.5 w-2.5 shrink-0 rounded-full ${config.iconBackground}`}
                style={{ animationDelay: `${index * 0.38}s` }}
              />
              <span
                className={
                  index === 0
                    ? `text-sm font-semibold ${config.accent}`
                    : 'text-sm font-medium text-stone-500'
                }
              >
                {step}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">
          <CalendarCheck className="shrink-0 text-stone-400" size={18} />
          <span>可以放心停留在当前页面，生成完成后这里会自动换成行程内容。</span>
        </div>
      </div>
    </div>
  )
}
