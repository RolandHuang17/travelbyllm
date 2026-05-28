import { useEffect, useMemo, useRef, useState } from 'react'
import type { LlmStatus } from '../api/plan'
import {
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Gauge,
  MapPinned,
  Route,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

type ModelGenerationLoaderProps = {
  isComplete: boolean
  llmStatus: LlmStatus | null
  onCompleteAnimationEnd: () => void
  variant: 'city' | 'drive' | 'optimize'
  contextItems?: {
    label: string
    value: string
  }[]
}

const progressSteps = [
  '确认需求',
  '组织路线',
  '补充天气交通',
  '生成结构化结果',
  '准备展示',
]

const progressPhaseDetails = [
  '正在确认城市、天数和偏好信息',
  '正在组织每日动线与停留节奏',
  '正在补充天气、交通和出行建议',
  '正在整理结构化行程内容',
  '正在准备展示与历史记录',
]

const PROGRESS_TO_88_MS = 75_000
const PROGRESS_TO_95_MS = 95_000
const COMPLETION_ANIMATION_MS = 520
const COMPLETION_HOLD_MS = 320

type LoaderVariantConfig = {
  accent: string
  background: string
  border: string
  dotActive: string
  fill: string
  glow: string
  icon: LucideIcon
  iconBackground: string
  iconText: string
  ring: string
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
      dotActive: 'bg-emerald-600 shadow-[0_0_0_5px_rgba(16,185,129,0.12)]',
      fill: 'from-emerald-500 via-teal-400 to-sky-400',
      glow: 'bg-emerald-200/45',
      icon: MapPinned,
      iconBackground: 'bg-emerald-100',
      iconText: 'text-emerald-700',
      ring: 'ring-emerald-100',
      eyebrow: '请求已接收',
      title: '正在整理城市行程',
      description:
        '系统正在把城市、天数和偏好整理成可执行攻略，通常需要几十秒。完成后会自动展示并写入历史记录。',
    },
    drive: {
      accent: 'text-amber-700',
      background: 'bg-amber-50/50',
      border: 'border-amber-100',
      dotActive: 'bg-amber-600 shadow-[0_0_0_5px_rgba(245,158,11,0.14)]',
      fill: 'from-amber-500 via-orange-400 to-rose-400',
      glow: 'bg-amber-200/45',
      icon: Route,
      iconBackground: 'bg-amber-100',
      iconText: 'text-amber-700',
      ring: 'ring-amber-100',
      eyebrow: '路线已提交',
      title: '正在整理自驾路线',
      description:
        '系统正在核对城市顺序、停留节奏和沿途建议，通常需要几十秒。完成后会自动展示并写入历史记录。',
    },
    optimize: {
      accent: 'text-teal-700',
      background: 'bg-teal-50/50',
      border: 'border-teal-100',
      dotActive: 'bg-teal-600 shadow-[0_0_0_5px_rgba(20,184,166,0.13)]',
      fill: 'from-teal-500 via-cyan-400 to-emerald-400',
      glow: 'bg-teal-200/45',
      icon: Sparkles,
      iconBackground: 'bg-teal-100',
      iconText: 'text-teal-700',
      ring: 'ring-teal-100',
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

function getEstimatedProgress(elapsedMs: number) {
  if (elapsedMs <= PROGRESS_TO_88_MS) {
    const ratio = elapsedMs / PROGRESS_TO_88_MS
    const easedRatio = 1 - Math.pow(1 - ratio, 2.35)

    return easedRatio * 88
  }

  if (elapsedMs <= PROGRESS_TO_95_MS) {
    const ratio =
      (elapsedMs - PROGRESS_TO_88_MS) /
      (PROGRESS_TO_95_MS - PROGRESS_TO_88_MS)
    const easedRatio = 1 - Math.pow(1 - ratio, 1.8)

    return 88 + easedRatio * 7
  }

  const extraSeconds = (elapsedMs - PROGRESS_TO_95_MS) / 1000

  return 95 + Math.min(2, 2 * (1 - Math.exp(-extraSeconds / 85)))
}

function getProgressPhaseIndex(progress: number, isComplete: boolean) {
  if (isComplete || progress >= 96) {
    return progressSteps.length - 1
  }

  if (progress >= 88) {
    return 4
  }

  if (progress >= 68) {
    return 3
  }

  if (progress >= 42) {
    return 2
  }

  if (progress >= 18) {
    return 1
  }

  return 0
}

export function ModelGenerationLoader({
  isComplete,
  llmStatus,
  onCompleteAnimationEnd,
  variant,
  contextItems = [],
}: ModelGenerationLoaderProps) {
  const config = variantConfig[variant]
  const StatusIcon = config.icon
  const [progress, setProgress] = useState(0)
  const completedRef = useRef(false)
  const frameRef = useRef<number | null>(null)
  const completeTimeoutRef = useRef<number | null>(null)
  const onCompleteAnimationEndRef = useRef(onCompleteAnimationEnd)
  const progressRef = useRef(0)
  const startedAtRef = useRef<number | null>(null)
  const completionStartedAtRef = useRef<number | null>(null)
  const completionStartProgressRef = useRef(0)

  useEffect(() => {
    onCompleteAnimationEndRef.current = onCompleteAnimationEnd
  }, [onCompleteAnimationEnd])

  useEffect(() => {
    progressRef.current = progress
  }, [progress])

  useEffect(() => {
    if (isComplete) {
      return
    }

    completedRef.current = false
    startedAtRef.current = performance.now()

    const updateProgress = (timestamp: number) => {
      if (!startedAtRef.current) {
        startedAtRef.current = timestamp
      }

      const elapsedMs = timestamp - startedAtRef.current
      setProgress((currentProgress) =>
        Math.max(currentProgress, getEstimatedProgress(elapsedMs)),
      )
      frameRef.current = requestAnimationFrame(updateProgress)
    }

    frameRef.current = requestAnimationFrame(updateProgress)

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [isComplete])

  useEffect(() => {
    if (!isComplete) {
      return
    }

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
    }

    completionStartedAtRef.current = null
    completionStartProgressRef.current = progressRef.current

    const updateCompletion = (timestamp: number) => {
      if (!completionStartedAtRef.current) {
        completionStartedAtRef.current = timestamp
      }

      const elapsedMs = timestamp - completionStartedAtRef.current
      const ratio = Math.min(elapsedMs / COMPLETION_ANIMATION_MS, 1)
      const easedRatio = 1 - Math.pow(1 - ratio, 3)

      setProgress(
        completionStartProgressRef.current +
          (100 - completionStartProgressRef.current) * easedRatio,
      )

      if (ratio < 1) {
        frameRef.current = requestAnimationFrame(updateCompletion)
        return
      }

      setProgress(100)

      completeTimeoutRef.current = window.setTimeout(() => {
        if (completedRef.current) {
          return
        }

        completedRef.current = true
        onCompleteAnimationEndRef.current()
      }, COMPLETION_HOLD_MS)
    }

    frameRef.current = requestAnimationFrame(updateCompletion)

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
      }

      if (completeTimeoutRef.current !== null) {
        window.clearTimeout(completeTimeoutRef.current)
      }
    }
  }, [isComplete])

  const displayedProgress = Math.min(100, Math.max(0, progress))
  const displayedProgressLabel = Math.round(displayedProgress)
  const activeStepIndex = getProgressPhaseIndex(displayedProgress, isComplete)
  const phaseLabel = isComplete ? '生成完成，正在打开结果' : progressSteps[activeStepIndex]
  const phaseDescription = isComplete
    ? '结果已经返回，正在为你切换到行程内容。'
    : progressPhaseDetails[activeStepIndex]
  const progressBarStyle = useMemo(
    () => ({
      transform: `scaleX(${displayedProgress / 100})`,
    }),
    [displayedProgress],
  )

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border bg-white px-5 py-6 text-stone-950 shadow-[0_18px_55px_rgba(68,64,60,0.08)] sm:px-6 sm:py-7 ${config.border} ${isComplete ? 'model-complete-flash' : ''}`}
    >
      <div
        className={`model-soft-glow pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full blur-3xl ${config.glow}`}
      />
      <div
        className={`model-soft-glow pointer-events-none absolute -bottom-24 left-8 h-36 w-36 rounded-full blur-3xl ${config.glow}`}
        style={{ animationDelay: '1.6s' }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-stone-200 to-transparent" />

      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <div
              className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-8 ${config.iconBackground} ${config.ring}`}
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

          <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-sm text-stone-600 shadow-inner lg:max-w-72">
            <div className="mb-1 flex items-center gap-2 font-semibold text-stone-800">
              <Gauge size={16} className={config.accent} />
              <span>生成状态</span>
            </div>
            <p className="leading-6">{getModelStatusText(llmStatus)}</p>
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

        <div className="rounded-2xl border border-stone-100 bg-stone-50/80 p-4 shadow-inner">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className={`text-sm font-semibold ${config.accent}`}>
                {phaseLabel}
              </p>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                {phaseDescription}
              </p>
            </div>
            <div className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-stone-950">
              {displayedProgressLabel}
              <span className="ml-1 text-base text-stone-400">%</span>
            </div>
          </div>

          <div
            aria-label={`AI 生成预计进度 ${displayedProgressLabel}%`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={displayedProgressLabel}
            className="h-3 overflow-hidden rounded-full bg-white shadow-inner ring-1 ring-stone-200"
            role="progressbar"
          >
            <div
              className={`model-progress-fill relative h-full rounded-full bg-gradient-to-r ${config.fill}`}
              style={progressBarStyle}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-5">
          {progressSteps.map((step, index) => (
            <div className="flex items-center gap-3" key={step}>
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full transition ${
                  index <= activeStepIndex
                    ? `model-wait-dot ${config.dotActive}`
                    : 'bg-stone-200'
                }`}
                style={{ animationDelay: `${index * 0.38}s` }}
              />
              <span
                className={
                  index === activeStepIndex
                    ? `text-sm font-semibold ${config.accent}`
                    : index < activeStepIndex
                      ? 'text-sm font-medium text-stone-700'
                      : 'text-sm font-medium text-stone-400'
                }
              >
                {step}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600 ring-1 ring-stone-100">
          <CalendarCheck className="shrink-0 text-stone-400" size={18} />
          <span>
            {isComplete
              ? '进度已完成，马上展示行程内容。'
              : '可以放心停留在当前页面，生成完成后这里会自动换成行程内容。'}
          </span>
        </div>
      </div>
    </div>
  )
}
