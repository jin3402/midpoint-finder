import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, TextField } from '@toss/tds-mobile'
import { useFullScreenAd } from '../ads/useFullScreenAd'
import { usePromotionReward } from '../promotion/usePromotionReward'
import { buildKakaoMapUrl, buildNaverMapSearchUrl, openExternalMapUrl, shareText } from '../share/shareUtils'
import type { LatLng } from './geo'
import { arithmeticMeanLatLng } from './geo'
import type { KakaoMap, KakaoMarker, KakaoPlaces, KakaoPlacesResult, KakaoServicesStatus } from '../../types/kakao'

function formatLatLng(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000
}

function toSvgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function createTossPinImage(fill: string, label: string) {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="46" height="58" viewBox="0 0 46 58">
    <path d="M23 0C12 0 4 8 4 19c0 15 19 39 19 39s19-24 19-39C42 8 34 0 23 0z" fill="${fill}"/>
    <circle cx="23" cy="21" r="11" fill="#ffffff" opacity="0.18"/>
    <text x="23" y="24" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="14" font-weight="800" fill="#fff">${label}</text>
  </svg>
  `.trim()
  return toSvgDataUrl(svg)
}

const SOURCE_COLORS = ['#3182F6', '#6B7280', '#059669', '#D97706', '#DC2626']
const MID_MARKER_IMAGE = createTossPinImage('#AA3BFF', 'M')
const CATEGORIES = ['맛집', '카페', '볼거리'] as const
type Category = (typeof CATEGORIES)[number]

/** 카카오 로컬 API는 한 번의 검색 조건당 최대 45개(15개 x 3페이지)만 제공하기 때문에,
 * 최대한 많은 추천 장소를 모으기 위해 검색 반경을 점점 넓혀가며 여러 번 조회하고 중복을 제거해요. */
const MAX_RECOMMENDATIONS = 50
const RECOMMENDATION_RADIUS_STEPS_M = [3000, 6000, 10000, 15000, 20000] // 20000m: 카카오 카테고리 검색 최대 반경
const INITIAL_VISIBLE_RECOMMENDATIONS = 10
const LOAD_MORE_STEP = 20

/** 추천 장소를 구분하기 위한 고유 키예요. (id가 없으면 이름+좌표로 대체) */
function getPlaceKey(place: KakaoPlacesResult) {
  return String(place.id ?? `${place.place_name}-${place.x}-${place.y}`)
}

let kakaoScriptLoadPromise: Promise<void> | null = null

async function ensureKakaoMapsLoaded(appKey: string) {
  if (window.kakao?.maps) return
  if (kakaoScriptLoadPromise) return kakaoScriptLoadPromise

  kakaoScriptLoadPromise = new Promise<void>((resolve, reject) => {
    const scriptId = 'kakao-maps-sdk'
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Kakao Maps SDK script load failed')))
      return
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.async = true
    script.defer = true
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
      appKey,
    )}&autoload=false&libraries=services`
    script.onload = () => {
      if (window.kakao?.maps?.load) {
        window.kakao.maps.load(() => resolve())
        return
      }
      reject(new Error('Kakao Maps SDK loaded, but window.kakao.maps.load is not available'))
    }
    script.onerror = () => reject(new Error('Kakao Maps SDK script load failed'))
    document.head.appendChild(script)
  })

  return kakaoScriptLoadPromise
}

function safeCreateMarkerImage(kakao: unknown, imageSrc: string, width = 46, height = 58) {
  try {
    const k = kakao as any
    if (!k?.MarkerImage) return undefined
    const size = k?.Size ? new k.Size(width, height) : { width, height }
    return new k.MarkerImage(imageSrc, size)
  } catch {
    return undefined
  }
}

function searchPlace(
  places: KakaoPlaces,
  Status: KakaoServicesStatus | undefined,
  query: string,
): Promise<LatLng | null> {
  const keyword = query.trim()
  if (!keyword) return Promise.resolve(null)

  return new Promise((resolve) => {
    places.keywordSearch(keyword, (data, status) => {
      if (!Status) {
        resolve(null)
        return
      }
      // 크래시 방지: OK + 결과 존재 시에만 좌표 수집
      if (status === Status.OK && data.length > 0) {
        const lat = Number(data[0].y)
        const lng = Number(data[0].x)
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          resolve({ lat, lng })
          return
        }
      }
      resolve(null)
    })
  })
}

export default function MiddlePointFinder() {
  const [step, setStep] = useState<'input' | 'result'>('input')
  const [addresses, setAddresses] = useState<string[]>(['', ''])
  const [midpoint, setMidpoint] = useState<LatLng | null>(null)
  const [midpointRegion, setMidpointRegion] = useState<string | null>(null)
  const [points, setPoints] = useState<LatLng[]>([])
  const [recommendations, setRecommendations] = useState<KakaoPlacesResult[]>([])
  const [loadMoreCount, setLoadMoreCount] = useState(0)
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false)
  const [activeCategory, setActiveCategory] = useState<Category>('맛집')
  const [kakaoError, setKakaoError] = useState<string | null>(null)
  const [findError, setFindError] = useState<string | null>(null)
  const [isFinding, setIsFinding] = useState(false)
  const { showAd } = useFullScreenAd()
  const { grantOnce: grantPromotionRewardOnce } = usePromotionReward()
  const [focusedAddressIndex, setFocusedAddressIndex] = useState<number | null>(null)
  const [addressSuggestions, setAddressSuggestions] = useState<KakaoPlacesResult[]>([])
  const [shareToast, setShareToast] = useState<string | null>(null)
  const [actionSheetPlace, setActionSheetPlace] = useState<KakaoPlacesResult | null>(null)
  const [isOpeningMap, setIsOpeningMap] = useState(false)

  const mapElRef = useRef<HTMLDivElement | null>(null)
  const [mapInstance, setMapInstance] = useState<KakaoMap | null>(null)
  const markersRef = useRef<KakaoMarker[]>([])
  const kakaoAppKey = import.meta.env.VITE_KAKAO_MAP_APPKEY as string | undefined

  const clearResult = useCallback(() => {
    setFindError(null)
    setPoints([])
    setMidpoint(null)
    setMidpointRegion(null)
    setRecommendations([])
    setLoadMoreCount(0)
    setIsLoadingRecommendations(false)
    setActionSheetPlace(null)
  }, [])

  const updateAddress = useCallback(
    (index: number, value: string) => {
      clearResult()
      setAddresses((prev) => prev.map((v, i) => (i === index ? value : v)))
    },
    [clearResult],
  )

  const addAddress = useCallback(() => {
    clearResult()
    setAddresses((prev) => [...prev, ''])
  }, [clearResult])

  const removeAddress = useCallback(
    (index: number) => {
      if (addresses.length <= 2) return
      clearResult()
      setAddresses((prev) => prev.filter((_, i) => i !== index))
    },
    [addresses.length, clearResult],
  )

  const handleFindMidpoint = useCallback(async () => {
    clearResult()

    const trimmed = addresses.map((v) => v.trim())
    if (trimmed.some((v) => v.length === 0)) {
      setFindError('모든 입력란에 장소/키워드를 입력해 주세요.')
      return
    }

    const kakaoMaps = window.kakao?.maps
    const services = kakaoMaps?.services
    const PlacesCtor = services?.Places
    const Status = services?.Status

    if (!kakaoMaps || !PlacesCtor || !Status) {
      setFindError('지도 장소 검색 서비스를 불러오지 못했어요.')
      return
    }

    setIsFinding(true)
    try {
      const places = new PlacesCtor()
      // 버튼 클릭 시점에만 비동기 장소 검색 수행
      const searched = await Promise.all(trimmed.map((keyword) => searchPlace(places, Status, keyword)))
      const validPoints = searched.filter((p): p is LatLng => p !== null)

      if (validPoints.length < 2) {
        setFindError('유효한 장소 좌표가 2개 미만이라 중간 지점을 계산할 수 없어요.')
        return
      }

      const mean = arithmeticMeanLatLng(validPoints)
      if (!mean) {
        setFindError('중간 지점을 계산할 수 없어요.')
        return
      }

      setPoints(validPoints)
      setMidpoint({
        lat: formatLatLng(mean.lat),
        lng: formatLatLng(mean.lng),
      })

      setStep('result')
    } finally {
      setIsFinding(false)
    }
  }, [addresses, clearResult])

  const searchNearbyPlaces = useCallback(
    async (targetMidpoint: LatLng) => {
      const kakaoMaps = window.kakao?.maps
      const services = kakaoMaps?.services
      const PlacesCtor = services?.Places
      const Status = services?.Status
      const map = mapInstance

      if (!kakaoMaps || !PlacesCtor || !Status || !map) return

      const places = new PlacesCtor() as any
      let categoryCode = 'FD6'
      if (activeCategory === '카페') {
        categoryCode = 'CE7'
      } else if (activeCategory === '볼거리') {
        categoryCode = 'AT4'
      }

      const center = new kakaoMaps.LatLng(targetMidpoint.lat, targetMidpoint.lng)
      const sortByDistance = (services as any).SortBy.DISTANCE

      // 한 번의 카카오 카테고리 검색은 최대 45개(15개 x 3페이지)까지만 결과를 주기 때문에,
      // 반경별로 여러 번 요청해서 최대한 많은 장소를 모아요.
      const fetchPage = (radius: number, page: number) =>
        new Promise<{ data: KakaoPlacesResult[]; hasMore: boolean }>((resolve) => {
          places.categorySearch(
            categoryCode,
            (data: KakaoPlacesResult[], status: any, pagination: any) => {
              if (status !== Status.OK) {
                resolve({ data: [], hasMore: false })
                return
              }
              const hasMore =
                typeof pagination?.hasNextPage === 'boolean' ? pagination.hasNextPage : data.length >= 15
              resolve({ data, hasMore })
            },
            { location: center, radius, sort: sortByDistance, page, size: 15 },
          )
        })

      setIsLoadingRecommendations(true)

      const seen = new Set<string>()
      const collected: KakaoPlacesResult[] = []

      for (const radius of RECOMMENDATION_RADIUS_STEPS_M) {
        if (collected.length >= MAX_RECOMMENDATIONS) break

        for (let page = 1; page <= 3; page++) {
          const { data, hasMore } = await fetchPage(radius, page)

          for (const place of data) {
            const key = getPlaceKey(place)
            if (seen.has(key)) continue
            seen.add(key)
            collected.push(place)
          }

          if (!hasMore || data.length < 15 || collected.length >= MAX_RECOMMENDATIONS) break
        }
      }

      const sorted = collected
        .slice()
        .sort((a, b) => Number(a.distance ?? Number.MAX_SAFE_INTEGER) - Number(b.distance ?? Number.MAX_SAFE_INTEGER))
        .slice(0, MAX_RECOMMENDATIONS)

      setRecommendations(sorted)
      setLoadMoreCount(0)
      setIsLoadingRecommendations(false)
    },
    [activeCategory, mapInstance],
  )

  const resolveMidpointRegion = useCallback(async (targetMidpoint: LatLng) => {
    const kakaoMaps = window.kakao?.maps
    const services = kakaoMaps?.services
    const GeocoderCtor = services?.Geocoder
    const Status = services?.Status

    if (!GeocoderCtor || !Status) {
      setMidpointRegion('대략적인 위치 정보를 불러오지 못했어요.')
      return
    }

    const geocoder = new GeocoderCtor() as any
    const region = await new Promise<string | null>((resolve) => {
      geocoder.coord2RegionCode(targetMidpoint.lng, targetMidpoint.lat, (result: any[], status: any) => {
        if (status === Status.OK && result.length > 0) {
          const hCode = result.find((item) => item.region_type === 'H') ?? result[0]
          const regionText = [hCode?.region_1depth_name, hCode?.region_2depth_name, hCode?.region_3depth_name]
            .filter(Boolean)
            .join(' ')
          resolve(regionText || null)
          return
        }

        geocoder.coord2Address(targetMidpoint.lng, targetMidpoint.lat, (addressResult: any[], addressStatus: any) => {
          if (addressStatus !== Status.OK || addressResult.length === 0) {
            resolve(null)
            return
          }

          const first = addressResult[0]
          const regionText = first?.address?.address_name || first?.road_address?.address_name || null
          resolve(regionText || null)
        })
      })
    })

    setMidpointRegion(region ? `대략적인 위치: ${region}` : '대략적인 위치 정보를 찾지 못했어요.')
  }, [])

  useEffect(() => {
    // 화면이 결과창이 아니면 지도를 초기화하고 멈춥니다
    if (step !== 'result') {
      setMapInstance(null)
      return
    }

    if (!mapElRef.current) return
    if (!kakaoAppKey) {
      setKakaoError('지도 API 키를 `.env`의 `VITE_KAKAO_MAP_APPKEY`로 설정해 주세요.')
      return
    }
    if (mapInstance) return // 이미 지도가 있으면 새로 안 그림

    const container = mapElRef.current
    let cancelled = false

      ; (async () => {
        try {
          await ensureKakaoMapsLoaded(kakaoAppKey)
          if (cancelled) return
          const kakao = window.kakao?.maps
          if (!kakao) throw new Error('카카오 지도 SDK가 정상적으로 로드되지 않았어요.')

          // 지도를 그리고 상태(State)에 쏙 저장합니다
          const newMap = new kakao.Map(container, {
            center: new kakao.LatLng(37.5665, 126.978),
            level: 6,
          })
          setMapInstance(newMap)
        } catch (error) {
          setKakaoError(error instanceof Error ? error.message : String(error))
        }
      })()

    return () => {
      cancelled = true
    }
  }, [kakaoAppKey, step, mapInstance])

  useEffect(() => {
    const map = mapInstance
    const kakao = window.kakao?.maps
    if (!map || !kakao) return

    for (const marker of markersRef.current) marker.setMap(null)
    markersRef.current = []

    if (points.length < 2 || !midpoint) return

    const bounds = new kakao.LatLngBounds()
    const next: KakaoMarker[] = []

    points.forEach((p, index) => {
      const pos = new kakao.LatLng(p.lat, p.lng)
      bounds.extend(pos)
      const markerImage = safeCreateMarkerImage(
        kakao,
        createTossPinImage(SOURCE_COLORS[index % SOURCE_COLORS.length], `${index + 1}`),
      )
      const marker = new kakao.Marker({ position: pos, ...(markerImage ? { image: markerImage } : {}) })
      marker.setMap(map)
      next.push(marker)
    })

    const midPos = new kakao.LatLng(midpoint.lat, midpoint.lng)
    bounds.extend(midPos)
    const midMarkerImage = safeCreateMarkerImage(kakao, MID_MARKER_IMAGE)
    const midMarker = new kakao.Marker({ position: midPos, ...(midMarkerImage ? { image: midMarkerImage } : {}) })
    midMarker.setMap(map)
    next.push(midMarker)

    markersRef.current = next
    map.setBounds(bounds)
  }, [points, midpoint, mapInstance])

  useEffect(() => {
    if (!midpoint) return
    void searchNearbyPlaces(midpoint)
  }, [midpoint, activeCategory, searchNearbyPlaces])

  useEffect(() => {
    if (!midpoint) return
    void resolveMidpointRegion(midpoint)
  }, [midpoint, resolveMidpointRegion])

  // 출발지 입력 시 연관/추천 주소를 보여주기 위한 디바운스된 키워드 검색
  useEffect(() => {
    if (focusedAddressIndex === null) {
      setAddressSuggestions([])
      return
    }

    const keyword = (addresses[focusedAddressIndex] ?? '').trim()
    if (keyword.length < 2) {
      setAddressSuggestions([])
      return
    }

    const services = window.kakao?.maps?.services
    const PlacesCtor = services?.Places
    const Status = services?.Status
    if (!PlacesCtor || !Status) return

    const timeoutId = window.setTimeout(() => {
      const places = new PlacesCtor()
      places.keywordSearch(
        keyword,
        (data, status) => {
          setAddressSuggestions(status === Status.OK ? data.slice(0, 5) : [])
        },
        { size: 5 },
      )
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [addresses, focusedAddressIndex])

  const selectAddressSuggestion = useCallback(
    (index: number, place: KakaoPlacesResult) => {
      const nextValue = place.place_name || place.road_address_name || place.address_name || ''
      updateAddress(index, nextValue)
      setAddressSuggestions([])
      setFocusedAddressIndex(null)
    },
    [updateAddress],
  )

  useEffect(() => {
    if (!shareToast) return
    const timeoutId = window.setTimeout(() => setShareToast(null), 2600)
    return () => window.clearTimeout(timeoutId)
  }, [shareToast])

  const runShare = useCallback(
    async (message: string) => {
      const result = await shareText(message)
      if (result === 'copied') {
        setShareToast('공유 내용을 클립보드에 복사했어요. 카카오톡 등에 붙여넣어 공유해 보세요.')
      } else if (result === 'failed') {
        setShareToast('공유에 실패했어요. 잠시 후 다시 시도해 주세요.')
      }

      // 공유(또는 복사)에 성공하면 "중간지점 공유하면 3원 지급" 프로모션 지급 시도 (기기당 1회)
      if (result === 'shared' || result === 'copied') {
        void grantPromotionRewardOnce()
      }
    },
    [grantPromotionRewardOnce],
  )

  const handleSharePlace = useCallback(
    (place: KakaoPlacesResult) => {
      const name = place.place_name || '추천 장소'
      const address = place.road_address_name || place.address_name || ''
      const mapUrl = buildNaverMapSearchUrl([name, address].filter(Boolean).join(' '))
      const message = [`📍 ${name}`, address || null, mapUrl ? `네이버지도로 보기: ${mapUrl}` : null, '', '중간지점찾기로 찾은 곳이에요 🙂']
        .filter((line): line is string => line !== null)
        .join('\n')
      void runShare(message)
    },
    [runShare],
  )

  // 장소 항목을 누르면 액션 시트를 열어서 "공유하기"/"지도로 보기" 옵션을 보여줘요.
  const handleOpenPlaceActions = useCallback((place: KakaoPlacesResult) => {
    setActionSheetPlace(place)
  }, [])

  const handleSharePlaceFromSheet = useCallback(() => {
    if (!actionSheetPlace) return
    handleSharePlace(actionSheetPlace)
    setActionSheetPlace(null)
  }, [actionSheetPlace, handleSharePlace])

  // 카카오맵/네이버지도로 이동하기 전에 전면 광고를 보여주고, 닫히면(또는 미지원/실패 시) 바로 이동해요.
  const handleViewOnMap = useCallback(
    async (place: KakaoPlacesResult, provider: 'kakao' | 'naver') => {
      const name = place.place_name || '추천 장소'
      const address = place.road_address_name || place.address_name || ''
      const url =
        provider === 'kakao'
          ? buildKakaoMapUrl(place)
          : buildNaverMapSearchUrl([name, address].filter(Boolean).join(' '))

      if (!url) {
        setActionSheetPlace(null)
        setShareToast('지도 링크를 만들지 못했어요.')
        return
      }

      setIsOpeningMap(true)
      try {
        await showAd()
        await openExternalMapUrl(url)
      } finally {
        setIsOpeningMap(false)
        setActionSheetPlace(null)
      }
    },
    [showAd],
  )

  const handleShareMidpoint = useCallback(() => {
    const regionText = midpointRegion?.replace('대략적인 위치: ', '') ?? null
    const mapUrl = regionText ? buildNaverMapSearchUrl(regionText) : null
    const message = [
      '📍 우리의 중간지점',
      regionText || null,
      mapUrl ? `네이버지도로 보기: ${mapUrl}` : null,
      '',
      '중간지점찾기로 계산했어요 🙂',
    ]
      .filter((line): line is string => line !== null)
      .join('\n')
    void runShare(message)
  }, [midpointRegion, runShare])

  const visibleRecommendations = recommendations.slice(
    0,
    Math.min(INITIAL_VISIBLE_RECOMMENDATIONS + loadMoreCount * LOAD_MORE_STEP, recommendations.length),
  )
  const canLoadMore = recommendations.length > visibleRecommendations.length

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {step === 'input' ? (
        <>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: -0.4,
              backgroundImage: 'linear-gradient(90deg, #3182F6 0%, #AA3BFF 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: '#3182F6',
            }}
          >
            중간지점 찾기
          </h1>
          <p style={{ margin: 0, color: '#6b6375', lineHeight: 1.4 }}>
            장소/키워드를 입력하고 버튼을 누르면 중간 지점을 계산합니다.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {addresses.map((address, index) => (
              <div
                key={`address-${index}`}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-end',
                  padding: 16,
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 12,
                }}
              >
                <div style={{ flex: 1, position: 'relative' }}>
                  <TextField
                    variant="box"
                    label={`출발지 ${index + 1}`}
                    labelOption="sustain"
                    placeholder="예: 강남역, 서울역"
                    value={address}
                    onChange={(e) => updateAddress(index, e.target.value)}
                    onFocus={() => setFocusedAddressIndex(index)}
                    onBlur={() => setFocusedAddressIndex((prev) => (prev === index ? null : prev))}
                    autoComplete="off"
                  />
                  {focusedAddressIndex === index && addressSuggestions.length > 0 ? (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        background: '#fff',
                        border: '1px solid rgba(0,0,0,0.08)',
                        borderRadius: 12,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        overflow: 'hidden',
                        zIndex: 30,
                      }}
                    >
                      {addressSuggestions.map((place, sIdx) => (
                        <button
                          key={`${place.id ?? place.place_name}-${sIdx}`}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectAddressSuggestion(index, place)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                            width: '100%',
                            textAlign: 'left',
                            padding: '10px 12px',
                            border: 'none',
                            borderBottom:
                              sIdx < addressSuggestions.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                            background: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ fontWeight: 700, fontSize: 14, color: '#08060d' }}>
                            {place.place_name ?? '이름 없는 장소'}
                          </span>
                          <span style={{ fontSize: 12, color: '#6b6375' }}>
                            {place.road_address_name || place.address_name || ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="weak"
                  color="dark"
                  size="medium"
                  disabled={addresses.length <= 2}
                  onClick={() => removeAddress(index)}
                >
                  삭제
                </Button>
              </div>
            ))}
          </div>

          <Button type="button" variant="weak" color="primary" display="full" size="large" onClick={addAddress}>
            + 인원 추가
          </Button>

          <Button
            type="button"
            color="primary"
            variant="fill"
            display="full"
            size="xlarge"
            loading={isFinding}
            disabled={isFinding || !kakaoAppKey || Boolean(kakaoError)}
            onClick={() => void handleFindMidpoint()}
          >
            중간지점 찾기
          </Button>

          {findError ? (
            <div
              role="alert"
              style={{
                padding: 12,
                borderRadius: 12,
                background: 'rgba(255, 59, 48, 0.08)',
                color: '#08060d',
                fontWeight: 600,
                lineHeight: 1.45,
              }}
            >
              {findError}
            </div>
          ) : null}
        </>
      ) : null}

      {step === 'result' ? (
        <>
          <button
            type="button"
            onClick={() => setStep('input')}
            style={{
              alignSelf: 'flex-start',
              border: 'none',
              background: 'transparent',
              padding: 0,
              fontSize: 15,
              fontWeight: 700,
              color: '#1f2937',
              cursor: 'pointer',
            }}
          >
            ← 다시 검색하기
          </button>

          <div style={{ marginTop: 6 }}>
            <div style={{ fontWeight: 600, textAlign: 'left', marginBottom: 8 }}>지도</div>
            <div
              style={{
                height: 320,
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid rgba(0,0,0,0.08)',
                position: 'relative',
                background: 'rgba(0,0,0,0.03)',
              }}
            >
              <div ref={mapElRef} style={{ width: '100%', height: '100%' }} />
              {kakaoError ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 16,
                    background: 'rgba(255,255,255,0.9)',
                    color: '#08060d',
                    fontWeight: 700,
                    textAlign: 'left',
                    lineHeight: 1.4,
                  }}
                >
                  {kakaoError}
                </div>
              ) : null}
            </div>
          </div>

          {midpoint ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                marginTop: 8,
                padding: 16,
                border: '1px solid rgba(170, 59, 255, 0.35)',
                background: 'rgba(170, 59, 255, 0.06)',
                borderRadius: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontWeight: 700 }}>중간지점</div>
                <button
                  type="button"
                  onClick={handleShareMidpoint}
                  disabled={!midpointRegion}
                  style={{
                    border: 'none',
                    borderRadius: 999,
                    padding: '6px 12px',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: midpointRegion ? 'pointer' : 'default',
                    background: '#AA3BFF',
                    color: '#fff',
                    opacity: midpointRegion ? 1 : 0.5,
                  }}
                >
                  공유하기
                </button>
              </div>
              <div style={{ color: '#08060d' }}>
                <div>{midpointRegion ?? '대략적인 위치를 확인하는 중이에요.'}</div>
              </div>
            </div>
          ) : null}

          {midpoint ? (
            <div
              style={{
                marginTop: 8,
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 12,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                background: '#fff',
              }}
            >
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CATEGORIES.map((category) => {
                  const isActive = category === activeCategory
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(category)}
                      style={{
                        border: 'none',
                        borderRadius: 999,
                        padding: '8px 14px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: isActive ? '#3182F6' : 'rgba(49,130,246,0.12)',
                        color: isActive ? '#fff' : '#1f2937',
                      }}
                    >
                      {category}
                    </button>
                  )
                })}
              </div>

              {recommendations.length > 0 ? (
                <div style={{ fontSize: 13, color: '#6b6375', fontWeight: 600 }}>
                  총 {recommendations.length}곳 중 {visibleRecommendations.length}곳 표시 중 · 장소를 누르면 공유하기/지도로
                  보기 옵션이 나와요
                </div>
              ) : null}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {isLoadingRecommendations ? (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      background: 'rgba(0,0,0,0.03)',
                      color: '#6b6375',
                      fontWeight: 600,
                    }}
                  >
                    주변 {activeCategory} 정보를 모으고 있어요...
                  </div>
                ) : recommendations.length === 0 ? (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      background: 'rgba(0,0,0,0.03)',
                      color: '#6b6375',
                      fontWeight: 600,
                    }}
                  >
                    주변에 추천할 장소가 없어요
                  </div>
                ) : (
                  visibleRecommendations.map((place, index) => {
                    const placeKey = getPlaceKey(place)
                    return (
                      <div
                        key={`${placeKey}-${index}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleOpenPlaceActions(place)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleOpenPlaceActions(place)
                          }
                        }}
                        style={{
                          color: '#08060d',
                          border: '1px solid rgba(0,0,0,0.08)',
                          borderRadius: 10,
                          padding: 12,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          background: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{place.place_name ?? '이름 없는 장소'}</div>
                        <div style={{ fontSize: 13, color: '#6b6375' }}>
                          {(place.category_group_name || activeCategory) +
                            ' · ' +
                            (place.distance ? `${place.distance}m` : '거리 정보 없음')}
                        </div>
                        <div style={{ fontSize: 13, color: '#6b6375' }}>
                          {place.road_address_name || place.address_name || '주소 정보 없음'}
                        </div>
                      </div>
                    )
                  })
                )}
                {canLoadMore ? (
                  <button
                    type="button"
                    onClick={() => setLoadMoreCount((prev) => prev + 1)}
                    style={{
                      border: '1px solid rgba(0,0,0,0.12)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      background: '#fff',
                      fontWeight: 700,
                      color: '#1f2937',
                      cursor: 'pointer',
                    }}
                  >
                    더보기
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {shareToast ? (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 112,
            transform: 'translateX(-50%)',
            maxWidth: 'calc(100% - 40px)',
            padding: '10px 16px',
            borderRadius: 999,
            background: 'rgba(8, 6, 13, 0.88)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            textAlign: 'center',
            zIndex: 60,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          }}
        >
          {shareToast}
        </div>
      ) : null}

      {actionSheetPlace ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${actionSheetPlace.place_name ?? '추천 장소'} 옵션`}
          onClick={() => !isOpeningMap && setActionSheetPlace(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(8, 6, 13, 0.45)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 80,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              background: '#fff',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: '14px 16px calc(16px + env(safe-area-inset-bottom, 0px))',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.12)', margin: '0 auto 6px' }} />

            <div style={{ textAlign: 'center', marginBottom: 4 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#08060d' }}>
                {actionSheetPlace.place_name ?? '추천 장소'}
              </div>
              <div style={{ fontSize: 13, color: '#6b6375', marginTop: 4 }}>
                {actionSheetPlace.road_address_name || actionSheetPlace.address_name || ''}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSharePlaceFromSheet}
              disabled={isOpeningMap}
              style={{
                border: 'none',
                borderRadius: 12,
                padding: '14px 12px',
                fontWeight: 700,
                fontSize: 15,
                cursor: isOpeningMap ? 'default' : 'pointer',
                background: 'rgba(49,130,246,0.08)',
                color: '#3182F6',
                opacity: isOpeningMap ? 0.5 : 1,
              }}
            >
              공유하기
            </button>
            <button
              type="button"
              onClick={() => void handleViewOnMap(actionSheetPlace, 'kakao')}
              disabled={isOpeningMap}
              style={{
                border: 'none',
                borderRadius: 12,
                padding: '14px 12px',
                fontWeight: 700,
                fontSize: 15,
                cursor: isOpeningMap ? 'default' : 'pointer',
                background: 'rgba(255, 224, 0, 0.18)',
                color: '#8a6d00',
                opacity: isOpeningMap ? 0.6 : 1,
              }}
            >
              {isOpeningMap ? '이동 준비 중...' : '카카오맵으로 보기'}
            </button>
            <button
              type="button"
              onClick={() => void handleViewOnMap(actionSheetPlace, 'naver')}
              disabled={isOpeningMap}
              style={{
                border: 'none',
                borderRadius: 12,
                padding: '14px 12px',
                fontWeight: 700,
                fontSize: 15,
                cursor: isOpeningMap ? 'default' : 'pointer',
                background: 'rgba(3, 199, 90, 0.12)',
                color: '#03A24A',
                opacity: isOpeningMap ? 0.6 : 1,
              }}
            >
              {isOpeningMap ? '이동 준비 중...' : '네이버지도로 보기'}
            </button>
            <button
              type="button"
              onClick={() => setActionSheetPlace(null)}
              disabled={isOpeningMap}
              style={{
                border: 'none',
                borderRadius: 12,
                padding: '12px',
                fontWeight: 700,
                fontSize: 14,
                cursor: isOpeningMap ? 'default' : 'pointer',
                background: 'transparent',
                color: '#6b6375',
              }}
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

