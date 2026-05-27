import {
  ArrowRight,
  Car,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CloudSun,
  LibraryBig,
  Loader2,
  MapPinned,
  Route,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Ticket,
  WifiOff,
  X,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { Link } from 'react-router-dom'
import { fetchHealthStatus, type HealthStatus } from '../api/health'
import {
  fetchHomeScenicSpots,
  type HomeScenicSpot,
} from '../api/spots'

const HERO_ROTATION_INTERVAL_MS = 5000

const HERO_IMAGES = [
  {
    name: '长城',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/The_Great_Wall_of_China_at_Jinshanling-edit.jpg/1920px-The_Great_Wall_of_China_at_Jinshanling-edit.jpg',
  },
  {
    name: '故宫博物院',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Forbidden_City_Beijing_Shenwumen_Gate.JPG/1920px-Forbidden_City_Beijing_Shenwumen_Gate.JPG',
  },
  {
    name: '杭州西湖',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/West_Lake%2C_Hangzhou_2025.jpg/1920px-West_Lake%2C_Hangzhou_2025.jpg',
  },
  {
    name: '张家界国家森林公园',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/1_tianzishan_wulingyuan_zhangjiajie_2012.jpg/1920px-1_tianzishan_wulingyuan_zhangjiajie_2012.jpg',
  },
  {
    name: '桂林漓江',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/2/21/%E6%BC%93%E6%B1%9F%E5%B1%B1%E6%B0%B4.jpg',
  },
  {
    name: '丽江古城',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/1_lijiang_old_town_2012a.jpg/1920px-1_lijiang_old_town_2012a.jpg',
  },
  {
    name: '九寨沟',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/1_jiuzhaigou_valley_wu_hua_hai_2011b.jpg/1920px-1_jiuzhaigou_valley_wu_hua_hai_2011b.jpg',
  },
  {
    name: '黄山',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Huangshan_pic_4.jpg/1920px-Huangshan_pic_4.jpg',
  },
  {
    name: '布达拉宫',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Potala_palace23.jpg/1920px-Potala_palace23.jpg',
  },
  {
    name: '鸣沙山月牙泉',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Crescent_Lake_from_the_Singing_Sand_Dunes_%2820230918101214%29.jpg/1920px-Crescent_Lake_from_the_Singing_Sand_Dunes_%2820230918101214%29.jpg',
  },
] as const

const SCENIC_SPOTS_PER_PAGE = 10
const SPOT_DETAIL_DIALOG_EXIT_MS = 180

const fallbackScenicSpots: HomeScenicSpot[] = [
  {
    id: 'fallback-great-wall',
    name: '长城',
    city: '北京',
    province: '北京市',
    imageUrl:
      'https://commons.wikimedia.org/wiki/Special:Redirect/file/Great%20Wall%20of%20China%2C%20China%20%28Unsplash%29.jpg?width=1800',
    description: '适合安排半日到一日的山脊徒步与历史风景线。',
    tags: ['世界遗产', '人文历史', '徒步视野'],
    heightVariant: 'tall',
    detail: {
      overview:
        '长城以山脊线和城墙肌理构成强烈的空间记忆，适合把历史、人文和轻徒步放在同一条动线上慢慢展开。',
      averageTemperature: '北京年均约 12℃，春秋舒适，冬季偏冷且风感明显。',
      visitRecommendation:
        '建议安排半日到 1 天，选择成熟段落轻装徒步，体力充足可增加关楼之间的步行距离。',
      photoSpots: ['敌楼窗口视角', '山脊转折处', '清晨侧光城墙', '高处俯拍步道'],
      ticketPrice: '参考 40-80 元，缆车、滑车和联票以景区公示为准。',
      openingHours: '通常 07:30-17:30 开放，季节和天气管制需出行前核对。',
    },
  },
  {
    id: 'fallback-li-river',
    name: '桂林漓江',
    city: '桂林',
    province: '广西壮族自治区',
    imageUrl:
      'https://commons.wikimedia.org/wiki/Special:Redirect/file/Li%20River.jpg?width=1800',
    description: '山水画卷感很强，适合慢节奏游船、摄影和轻徒步。',
    tags: ['山水', '摄影', '慢游'],
    heightVariant: 'medium',
    detail: {
      overview:
        '桂林漓江的山水层次柔和，适合把游船、岸边散步和村落停留串成一段慢节奏风景线。',
      averageTemperature: '桂林年均约 19℃，冬季温和，夏季湿热多雨。',
      visitRecommendation:
        '建议安排半日到 1 天，上午游船看主景，下午留给阳朔周边骑行或轻徒步。',
      photoSpots: ['九马画山水岸', '黄布倒影', '船头开阔视角', '傍晚江畔步道'],
      ticketPrice: '参考 80-300 元，游船等级、码头和季节价格以当日公示为准。',
      openingHours: '游船通常白天发班，具体班次、码头和水位管制需提前确认。',
    },
  },
  {
    id: 'fallback-zhangjiajie',
    name: '张家界国家森林公园',
    city: '张家界',
    province: '湖南省',
    imageUrl:
      'https://commons.wikimedia.org/wiki/Special:Redirect/file/Zhangjiajie%20National%20Forest%20Park.jpg?width=1800',
    description: '峰林景观辨识度高，适合两到三天的自然风光深度游。',
    tags: ['自然风光', '峰林', '深度游'],
    heightVariant: 'short',
    detail: {
      overview:
        '张家界国家森林公园以石英砂岩峰林闻名，视野纵深强，适合做两到三天的自然景观深度游。',
      averageTemperature: '张家界年均约 16℃，春秋适合户外，雨后云雾和峰林层次更明显。',
      visitRecommendation:
        '建议安排 2-3 天，把袁家界、天子山和金鞭溪分段游览，避免一天内过度赶路。',
      photoSpots: ['袁家界观景台', '天子山云海视角', '金鞭溪溪谷', '索道高处视角'],
      ticketPrice: '参考 200 元左右，环保车、索道和电梯费用需另行核对。',
      openingHours: '通常 07:00-18:00 开放，索道、电梯和天气管制以景区公告为准。',
    },
  },
  {
    id: 'fallback-forbidden-city',
    name: '故宫博物院',
    city: '北京',
    province: '北京市',
    imageUrl:
      'https://commons.wikimedia.org/wiki/Special:Redirect/file/Forbidden%20City%2C%20Beijing.jpg?width=1800',
    description: '中轴线与宫殿群适合搭配城市漫游和博物馆路线。',
    tags: ['博物馆', '城市漫游', '建筑'],
    heightVariant: 'medium',
    detail: {
      overview:
        '故宫博物院以中轴线、宫殿群和馆藏展陈形成完整的宫城体验，适合提前规划参观顺序。',
      averageTemperature: '北京年均约 12℃，春秋参观最舒服，冬季室外停留需注意保暖。',
      visitRecommendation:
        '建议安排 4-6 小时，主轴线之外留出时间给东西六宫或专题展。',
      photoSpots: ['午门广场', '太和殿前广场', '红墙夹道', '角楼外侧水面'],
      ticketPrice: '参考 40-60 元，珍宝馆、钟表馆和特展以预约公示为准。',
      openingHours: '通常 08:30-17:00，周一闭馆，预约和淡旺季时间需提前核对。',
    },
  },
  {
    id: 'fallback-lijiang',
    name: '丽江古城',
    city: '丽江',
    province: '云南省',
    imageUrl:
      'https://commons.wikimedia.org/wiki/Special:Redirect/file/Lijiang%20Old%20Town.jpg?width=1800',
    description: '古城街巷、雪山视野和咖啡小店适合轻松度假节奏。',
    tags: ['古城', '休闲', '雪山'],
    heightVariant: 'tall',
    detail: {
      overview:
        '丽江古城适合慢慢走，石板路、院落、溪流和雪山远景共同构成轻松度假的节奏。',
      averageTemperature: '丽江年均约 13℃，日温差明显，早晚建议加外套。',
      visitRecommendation:
        '建议安排半日到 1 天，清晨看安静街巷，傍晚去高处看屋顶和雪山方向。',
      photoSpots: ['大研古城街巷', '狮子山观景点', '溪流石桥', '清晨客栈门前'],
      ticketPrice: '不用门票；部分维护费、展馆或演出项目以现场公示为准。',
      openingHours: '古城公共街区通常全天开放，商铺和演出时段以当日安排为准。',
    },
  },
  {
    id: 'fallback-west-lake',
    name: '杭州西湖',
    city: '杭州',
    province: '浙江省',
    imageUrl:
      'https://commons.wikimedia.org/wiki/Special:Redirect/file/West%20Lake%20Hangzhou%204.jpg?width=1800',
    description: '湖区动线成熟，适合亲友结伴、城市散步和夜游。',
    tags: ['城市湖景', '散步', '夜游'],
    heightVariant: 'short',
    detail: {
      overview:
        '杭州西湖把城市生活、湖岸步道和经典十景连在一起，适合用散步、骑行和泛舟慢慢消化。',
      averageTemperature: '杭州年均约 17℃，春秋舒适，夏季湿热且需防晒。',
      visitRecommendation:
        '建议安排半日到 1 天，白天走湖岸，傍晚留给断桥、苏堤或湖滨夜景。',
      photoSpots: ['断桥视角', '苏堤树影', '三潭印月船上视角', '湖滨蓝调时刻'],
      ticketPrice: '不用门票；游船、部分园中园和演出项目可能单独收费。',
      openingHours: '湖区公共空间通常全天开放，游船和园中园时段以当日公示为准。',
    },
  },
]

const quickActions = [
  {
    title: '单城市规划',
    description: '为明确目的地生成每日行程。',
    to: '/plan/city',
    icon: Sparkles,
  },
  {
    title: '自驾路线',
    description: '串联多座城市与沿途停留。',
    to: '/plan/drive',
    icon: Car,
  },
  {
    title: '互动地图',
    description: '搜索地点、收藏点位和查看路线。',
    to: '/map',
    icon: MapPinned,
  },
  {
    title: '天气查询',
    description: '查看目的地和沿途城市天气。',
    to: '/weather',
    icon: CloudSun,
  },
  {
    title: '行程库',
    description: '回看、优化和导出历史方案。',
    to: '/history',
    icon: LibraryBig,
  },
]

function getHealthLabel(
  healthStatus: 'loading' | 'success' | 'error',
  healthData: HealthStatus | null,
) {
  if (healthStatus === 'loading') {
    return {
      icon: Loader2,
      label: '服务检查中',
      className: 'border-white/25 bg-white/15 text-white',
    }
  }

  if (healthStatus === 'success' && healthData) {
    return {
      icon: ShieldCheck,
      label: `服务在线 · ${healthData.database.toUpperCase()}`,
      className: 'border-emerald-200/60 bg-emerald-400/20 text-emerald-50',
    }
  }

  return {
    icon: WifiOff,
    label: '服务待连接',
    className: 'border-rose-200/70 bg-rose-400/25 text-rose-50',
  }
}

function chunkScenicSpots(spots: HomeScenicSpot[]) {
  const pages: HomeScenicSpot[][] = []

  for (let index = 0; index < spots.length; index += SCENIC_SPOTS_PER_PAGE) {
    pages.push(spots.slice(index, index + SCENIC_SPOTS_PER_PAGE))
  }

  return pages
}

function getSpotCardSpanClass(heightVariant: HomeScenicSpot['heightVariant']) {
  if (heightVariant === 'short') {
    return 'row-span-3'
  }

  if (heightVariant === 'tall') {
    return 'row-span-5'
  }

  return 'row-span-4'
}

function getHighResolutionSpotImageUrl(imageUrl: string) {
  if (imageUrl.includes('/1280px-')) {
    return imageUrl.replace('/1280px-', '/1920px-')
  }

  if (imageUrl.includes('width=1800')) {
    return imageUrl.replace('width=1800', 'width=2200')
  }

  if (
    imageUrl.includes('commons.wikimedia.org/wiki/Special:FilePath') ||
    imageUrl.includes('commons.wikimedia.org/wiki/Special:Redirect')
  ) {
    return `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}width=2200`
  }

  return imageUrl
}

function buildRuntimeSpotDetailFallback(
  spot: HomeScenicSpot,
): HomeScenicSpot['detail'] {
  return {
    overview: `${spot.name}位于${spot.province}${spot.city}，${spot.description}适合围绕「${spot.tags.join('、')}」安排游览，建议保留从容停留时间，出行前再核对现场公告。`,
    averageTemperature:
      '当地气候以目的地实时天气为准，春秋通常更适合长时间户外停留。',
    visitRecommendation:
      spot.heightVariant === 'tall'
        ? '建议安排 1 天以上，优先把核心景观和交通衔接排稳。'
        : '建议安排半日到 1 天，按主景观、周边步道和休息点组织动线。',
    photoSpots: [
      `${spot.name}主景观位`,
      '入口标志或观景平台',
      '清晨或傍晚光线较柔和的位置',
    ],
    ticketPrice: '门票以景区公示为准；如为免费公共空间则不用门票。',
    openingHours: '开放时间以景区当日公告为准，节假日和天气管制可能调整。',
  }
}

function getSpotDetail(spot: HomeScenicSpot) {
  return spot.detail ?? buildRuntimeSpotDetailFallback(spot)
}

type SpotDetailDialogProps = {
  spot: HomeScenicSpot
  isClosing: boolean
  closeButtonRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
}

function SpotDetailDialog({
  spot,
  isClosing,
  closeButtonRef,
  onClose,
}: SpotDetailDialogProps) {
  const spotDetail = getSpotDetail(spot)
  const detailMetricItems = [
    {
      label: '平均温度',
      value: spotDetail.averageTemperature,
      icon: Thermometer,
    },
    {
      label: '门票价格',
      value: spotDetail.ticketPrice,
      icon: Ticket,
    },
    {
      label: '开放时间',
      value: spotDetail.openingHours,
      icon: Clock3,
    },
  ]

  return (
    <div
      className={`spot-dialog-backdrop fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 px-3 py-4 backdrop-blur-xl sm:px-6 ${
        isClosing ? 'spot-dialog-backdrop-out' : ''
      }`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        aria-labelledby="spot-detail-title"
        aria-modal="true"
        className={`spot-dialog-panel flex max-h-[92svh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/50 bg-[#f7f4ee] shadow-[0_32px_120px_rgba(12,10,9,0.38)] ${
          isClosing ? 'spot-dialog-panel-out' : ''
        }`}
        role="dialog"
      >
        <div className="relative min-h-[17rem] overflow-hidden bg-stone-950 sm:min-h-[22rem]">
          <img
            alt={`${spot.name}高清风景`}
            className="absolute inset-0 h-full w-full object-cover"
            src={getHighResolutionSpotImageUrl(spot.imageUrl)}
            onError={(event) => {
              const image = event.currentTarget

              if (!image.dataset.fallbackUsed) {
                image.dataset.fallbackUsed = 'true'
                image.src = spot.imageUrl
                return
              }

              image.style.display = 'none'
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/42 to-stone-950/8" />
          <button
            aria-label="关闭景点详情"
            className="absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-stone-950/45 text-white shadow-lg backdrop-blur transition hover:bg-stone-950/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            ref={closeButtonRef}
            title="关闭"
            type="button"
            onClick={onClose}
          >
            <X size={20} />
          </button>

          <div className="relative z-10 flex min-h-[17rem] flex-col justify-end p-5 text-white sm:min-h-[22rem] sm:p-8">
            <p className="text-sm font-medium text-stone-200">
              {spot.province} · {spot.city}
            </p>
            <h2
              className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl"
              id="spot-detail-title"
            >
              {spot.name}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {spot.tags.map((tag) => (
                <span
                  className="rounded-full border border-white/25 bg-white/12 px-3 py-1.5 text-xs font-medium text-white backdrop-blur"
                  key={tag}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-8 sm:py-7">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <section>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Destination Brief
              </p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-stone-950">
                景点介绍
              </h3>
              <p className="mt-4 text-base leading-8 text-stone-600">
                {spotDetail.overview}
              </p>
            </section>

            <div className="grid gap-3">
              {detailMetricItems.map((item) => {
                const ItemIcon = item.icon

                return (
                  <div
                    className="rounded-xl border border-stone-200 bg-white/75 p-4 shadow-sm"
                    key={item.label}
                  >
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-950 text-white">
                        <ItemIcon size={18} />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-stone-950">
                          {item.label}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-stone-600">
                          {item.value}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-stone-200 bg-white/75 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-700 text-white">
                  <Route size={18} />
                </span>
                <h3 className="text-base font-semibold text-stone-950">
                  推荐游玩方式与时长
                </h3>
              </div>
              <p className="mt-4 text-sm leading-7 text-stone-600">
                {spotDetail.visitRecommendation}
              </p>
            </section>

            <section className="rounded-xl border border-stone-200 bg-white/75 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-700 text-white">
                  <Camera size={18} />
                </span>
                <h3 className="text-base font-semibold text-stone-950">
                  推荐拍照打卡地点
                </h3>
              </div>
              <ul className="mt-4 grid gap-2 text-sm leading-6 text-stone-600">
                {spotDetail.photoSpots.map((photoSpot) => (
                  <li className="flex items-start gap-2" key={photoSpot}>
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600"
                      aria-hidden="true"
                    />
                    <span>{photoSpot}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <p className="mt-5 text-xs leading-5 text-stone-500">
            门票与开放时间为出行参考，实际价格、预约和临时管制请以景区当日公示为准。
          </p>
        </div>
      </section>
    </div>
  )
}

export function DashboardPage() {
  const scenicCarouselRef = useRef<HTMLDivElement | null>(null)
  const spotDialogCloseButtonRef = useRef<HTMLButtonElement | null>(null)
  const lastFocusedSpotButtonRef = useRef<HTMLButtonElement | null>(null)
  const spotDialogCloseTimerRef = useRef<number | null>(null)
  const [activeHeroIndex, setActiveHeroIndex] = useState(0)
  const [isHeroRotationEnabled] = useState(() => {
    if (typeof window === 'undefined') {
      return true
    }

    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  const [healthStatus, setHealthStatus] = useState<
    'loading' | 'success' | 'error'
  >('loading')
  const [healthData, setHealthData] = useState<HealthStatus | null>(null)
  const [healthErrorMessage, setHealthErrorMessage] = useState('')
  const [scenicSpots, setScenicSpots] =
    useState<HomeScenicSpot[]>(fallbackScenicSpots)
  const [scenicSpotErrorMessage, setScenicSpotErrorMessage] = useState('')
  const [currentSpotPage, setCurrentSpotPage] = useState(0)
  const [selectedSpot, setSelectedSpot] = useState<HomeScenicSpot | null>(null)
  const [isSpotDialogClosing, setIsSpotDialogClosing] = useState(false)

  const closeSelectedSpot = useCallback(() => {
    if (!selectedSpot || spotDialogCloseTimerRef.current !== null) {
      return
    }

    const finishClosing = () => {
      setSelectedSpot(null)
      setIsSpotDialogClosing(false)
      spotDialogCloseTimerRef.current = null

      window.setTimeout(() => {
        lastFocusedSpotButtonRef.current?.focus()
      }, 0)
    }

    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      finishClosing()
      return
    }

    setIsSpotDialogClosing(true)
    spotDialogCloseTimerRef.current = window.setTimeout(
      finishClosing,
      SPOT_DETAIL_DIALOG_EXIT_MS,
    )
  }, [selectedSpot])

  const handleOpenSpotDetail = useCallback(
    (spot: HomeScenicSpot, trigger: HTMLButtonElement) => {
      if (spotDialogCloseTimerRef.current !== null) {
        window.clearTimeout(spotDialogCloseTimerRef.current)
        spotDialogCloseTimerRef.current = null
      }

      lastFocusedSpotButtonRef.current = trigger
      setIsSpotDialogClosing(false)
      setSelectedSpot(spot)
    },
    [],
  )

  useEffect(() => {
    HERO_IMAGES.slice(1).forEach((heroImage) => {
      const image = new Image()

      image.src = heroImage.imageUrl
    })
  }, [])

  useEffect(() => {
    return () => {
      if (spotDialogCloseTimerRef.current !== null) {
        window.clearTimeout(spotDialogCloseTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!selectedSpot) {
      return undefined
    }

    const previousBodyOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'

    const focusTimerId = window.setTimeout(() => {
      spotDialogCloseButtonRef.current?.focus()
    }, 0)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeSelectedSpot()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousBodyOverflow
      window.clearTimeout(focusTimerId)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeSelectedSpot, selectedSpot])

  useEffect(() => {
    if (!isHeroRotationEnabled) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setActiveHeroIndex(
        (currentIndex) => (currentIndex + 1) % HERO_IMAGES.length,
      )
    }, HERO_ROTATION_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isHeroRotationEnabled])

  useEffect(() => {
    let isActive = true

    const loadHealthStatus = async () => {
      try {
        const result = await fetchHealthStatus()

        if (!isActive) {
          return
        }

        setHealthData(result)
        setHealthStatus('success')
      } catch (error) {
        if (!isActive) {
          return
        }

        setHealthErrorMessage(
          error instanceof Error ? error.message : '无法连接到后端服务',
        )
        setHealthStatus('error')
      }
    }

    void loadHealthStatus()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    let isActive = true

    const loadHomeScenicSpots = async () => {
      try {
        const spots = await fetchHomeScenicSpots()

        if (!isActive) {
          return
        }

        if (spots.length > 0) {
          setScenicSpots(spots)
          setScenicSpotErrorMessage('')
          setCurrentSpotPage(0)
          return
        }

        setScenicSpots(fallbackScenicSpots)
        setScenicSpotErrorMessage('后端未返回景点数据，已使用本地推荐')
        setCurrentSpotPage(0)
      } catch (error) {
        if (!isActive) {
          return
        }

        setScenicSpots(fallbackScenicSpots)
        setScenicSpotErrorMessage(
          error instanceof Error ? error.message : '无法加载热门景点',
        )
        setCurrentSpotPage(0)
      }
    }

    void loadHomeScenicSpots()

    return () => {
      isActive = false
    }
  }, [])

  const scenicSpotPages = useMemo(
    () => chunkScenicSpots(scenicSpots),
    [scenicSpots],
  )
  const maxSpotPageIndex = Math.max(scenicSpotPages.length - 1, 0)
  const activeSpotPage = Math.min(currentSpotPage, maxSpotPageIndex)

  const scrollToSpotPage = (pageIndex: number) => {
    const nextPageIndex = Math.min(
      Math.max(pageIndex, 0),
      maxSpotPageIndex,
    )
    const nextPage = scenicCarouselRef.current?.children.item(
      nextPageIndex,
    ) as HTMLElement | null

    nextPage?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'start',
    })
    setCurrentSpotPage(nextPageIndex)
  }

  const handleScenicCarouselScroll = () => {
    const carousel = scenicCarouselRef.current

    if (!carousel) {
      return
    }

    const carouselLeft = carousel.getBoundingClientRect().left
    const nextPageIndex = Array.from(carousel.children).reduce(
      (closestIndex, child, index) => {
        const closestChild = carousel.children.item(
          closestIndex,
        ) as HTMLElement | null
        const currentChild = child as HTMLElement
        const closestDistance = closestChild
          ? Math.abs(closestChild.getBoundingClientRect().left - carouselLeft)
          : Number.POSITIVE_INFINITY
        const currentDistance = Math.abs(
          currentChild.getBoundingClientRect().left - carouselLeft,
        )

        return currentDistance < closestDistance ? index : closestIndex
      },
      0,
    )

    setCurrentSpotPage(nextPageIndex)
  }

  const formattedTimestamp = healthData
    ? new Date(healthData.timestamp).toLocaleString()
    : ''
  const healthLabel = getHealthLabel(healthStatus, healthData)
  const HealthIcon = healthLabel.icon

  return (
    <div className="space-y-10">
      <section className="relative left-1/2 min-h-[calc(100svh-8rem)] w-screen -translate-x-1/2 overflow-hidden bg-stone-950">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-stone-900 to-amber-950" />
        {HERO_IMAGES.map((heroImage, index) => (
          <img
            alt=""
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${
              index === activeHeroIndex ? 'opacity-95' : 'opacity-0'
            }`}
            key={heroImage.name}
            loading={index === 0 ? 'eager' : 'lazy'}
            src={heroImage.imageUrl}
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950/82 via-stone-950/18 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-stone-950/85 to-transparent" />

        <div className="relative mx-auto flex min-h-[calc(100svh-8rem)] w-full max-w-7xl flex-col justify-end px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-2xl pb-8 text-white">
            <h1 className="max-w-xl text-5xl font-semibold leading-[1.08] tracking-tight sm:text-6xl lg:text-[4.25rem]">
              <span className="block sm:inline">下一程，</span>
              <span className="block sm:inline">已在眼前</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-stone-100 sm:text-lg">
              从灵感到路线，一屏整理清楚。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-stone-100"
                to="/plan/city"
              >
                开始规划
                <ArrowRight size={16} />
              </Link>
              <Link
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
                to="/map"
              >
                先看地图
                <MapPinned size={16} />
              </Link>
            </div>
          </div>

          <div className="flex border-t border-white/15 pt-5 text-white">
            <div
              className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium backdrop-blur ${healthLabel.className}`}
              title={healthErrorMessage || formattedTimestamp || undefined}
            >
              <HealthIcon
                className={healthStatus === 'loading' ? 'animate-spin' : ''}
                size={16}
              />
              {healthLabel.label}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((action) => {
          const ActionIcon = action.icon

          return (
            <Link
              className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_16px_50px_rgba(28,25,23,0.06)] transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_20px_70px_rgba(28,25,23,0.1)]"
              key={action.to}
              to={action.to}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-stone-950 text-white">
                  <ActionIcon size={19} />
                </span>
                <ArrowRight
                  className="text-stone-300 transition group-hover:translate-x-1 group-hover:text-emerald-700"
                  size={18}
                />
              </div>
              <h2 className="mt-5 text-base font-semibold text-stone-950">
                {action.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                {action.description}
              </p>
            </Link>
          )
        })}
      </section>

      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">
              Trending Places
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">
              热门景点推荐
            </h2>
          </div>
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-stone-700 transition hover:text-emerald-700"
            to="/plan/city"
          >
            用这些灵感生成行程
            <Route size={16} />
          </Link>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <p
            className="text-sm font-medium text-stone-500"
            title={scenicSpotErrorMessage || undefined}
          >
            共 {scenicSpots.length} 个目的地
          </p>
          <div className="flex items-center gap-2">
            <button
              aria-label="上一组热门景点"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={activeSpotPage === 0}
              title="上一组"
              type="button"
              onClick={() => scrollToSpotPage(activeSpotPage - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              aria-label="下一组热门景点"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={activeSpotPage >= maxSpotPageIndex}
              title="下一组"
              type="button"
              onClick={() => scrollToSpotPage(activeSpotPage + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div
          aria-label="热门景点推荐"
          className="mt-5 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          ref={scenicCarouselRef}
          onScroll={handleScenicCarouselScroll}
        >
          {scenicSpotPages.map((spotsPage, pageIndex) => (
            <div
              className="min-w-full snap-start scroll-ml-0"
              key={`scenic-page-${pageIndex + 1}`}
            >
              <div className="grid auto-rows-[4.75rem] grid-cols-2 gap-4 sm:auto-rows-[5.25rem] md:grid-cols-3 lg:grid-cols-4">
                {spotsPage.map((spot, spotIndex) => (
                  <article
                    className={getSpotCardSpanClass(spot.heightVariant)}
                    key={spot.id}
                  >
                    <button
                      aria-label={`查看${spot.name}详情`}
                      className="group relative h-full min-h-0 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-stone-800 via-emerald-900 to-amber-900 text-left shadow-[0_18px_60px_rgba(28,25,23,0.12)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_80px_rgba(28,25,23,0.18)] focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/45"
                      type="button"
                      onClick={(event) =>
                        handleOpenSpotDetail(spot, event.currentTarget)
                      }
                    >
                      <img
                        alt={`${spot.name}风景`}
                        className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                        loading={
                          pageIndex === 0 && spotIndex < 4 ? 'eager' : 'lazy'
                        }
                        src={spot.imageUrl}
                        onError={(event) => {
                          event.currentTarget.style.display = 'none'
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-stone-950/92 via-stone-950/36 to-transparent transition duration-500 group-hover:from-stone-950/96 group-hover:via-stone-950/45" />
                      <div className="absolute right-3 top-3 rounded-full border border-white/20 bg-white/12 px-3 py-1.5 text-xs font-semibold text-white opacity-0 backdrop-blur transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100">
                        查看详情
                      </div>
                      <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
                        <p className="text-xs font-medium text-stone-200 sm:text-sm">
                          {spot.province} · {spot.city}
                        </p>
                        <h3 className="mt-1 text-xl font-semibold tracking-tight sm:mt-2 sm:text-2xl">
                          {spot.name}
                        </h3>
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-stone-100 sm:mt-3 sm:text-sm sm:leading-6">
                          {spot.description}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2">
                          {spot.tags
                            .slice(
                              0,
                              spot.heightVariant === 'short' ? 2 : 3,
                            )
                            .map((tag) => (
                              <span
                                className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[0.68rem] font-medium text-white backdrop-blur sm:text-xs"
                                key={tag}
                              >
                                {tag}
                              </span>
                            ))}
                        </div>
                      </div>
                    </button>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div
          aria-label="热门景点分页"
          className="mt-4 flex justify-center gap-2"
        >
          {scenicSpotPages.map((_spotsPage, pageIndex) => (
            <button
              aria-label={`第 ${pageIndex + 1} 组热门景点`}
              className={`h-2 rounded-full transition ${
                pageIndex === activeSpotPage
                  ? 'w-7 bg-stone-950'
                  : 'w-2 bg-stone-300 hover:bg-emerald-600'
              }`}
              key={`scenic-dot-${pageIndex + 1}`}
              type="button"
              onClick={() => scrollToSpotPage(pageIndex)}
            />
          ))}
        </div>
      </section>

      {selectedSpot ? (
        <SpotDetailDialog
          closeButtonRef={spotDialogCloseButtonRef}
          isClosing={isSpotDialogClosing}
          spot={selectedSpot}
          onClose={closeSelectedSpot}
        />
      ) : null}
    </div>
  )
}
