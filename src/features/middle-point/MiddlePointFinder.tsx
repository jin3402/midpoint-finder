import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, TextField } from '@toss/tds-mobile'
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
const REC_MARKER_IMAGE = createTossPinImage('#9CA3AF', 'R')
const CATEGORIES = ['맛집', '카페', '볼거리'] as const
type Category = (typeof CATEGORIES)[number]

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

function safeCreateMarkerImage(kakao: unknown, imageSrc: string) {
  try {
    const k = kakao as any
    if (!k?.MarkerImage) return undefined
    const size = k?.Size ? new k.Size(46, 58) : { width: 46, height: 58 }
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
  const [activeCategory, setActiveCategory] = useState<Category>('맛집')
  const [, setRecMarkers] = useState<KakaoMarker[]>([])
  const [kakaoError, setKakaoError] = useState<string | null>(null)
  const [findError, setFindError] = useState<string | null>(null)
  const [isFinding, setIsFinding] = useState(false)

  const mapElRef = useRef<HTMLDivElement | null>(null)
  const [mapInstance, setMapInstance] = useState<KakaoMap | null>(null)
  const markersRef = useRef<KakaoMarker[]>([])
  const kakaoAppKey = import.meta.env.VITE_KAKAO_MAP_APPKEY as string | undefined

  const clearRecMarkers = useCallback(() => {
    setRecMarkers((prev) => {
      prev.forEach((marker) => marker.setMap(null))
      return []
    })
  }, [])

  const clearResult = useCallback(() => {
    setFindError(null)
    setPoints([])
    setMidpoint(null)
    setMidpointRegion(null)
    setRecommendations([])
    setLoadMoreCount(0)
    clearRecMarkers()
  }, [clearRecMarkers])

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
      setFindError('카카오 장소 검색 서비스를 불러오지 못했어요.')
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

      const places = new PlacesCtor()
      let cataegoryCode = 'FD6'
      if (activeCategory === '카페') {
        cataegoryCode = 'CE7'
      } else if (activeCategory === '볼거리') {
        cataegoryCode = 'AT4'
      }

      await new Promise<void>((resolve) => {
        (places as any).categorySearch(
          cataegoryCode,
          (data: KakaoPlacesResult[], status: any) => {
            clearRecMarkers()

            if (status !== Status.OK || data.length === 0) {
              setRecommendations([])
              setLoadMoreCount(0)
              resolve()
              return
            }

            setRecommendations(data)
            setLoadMoreCount(0)

            const nextRecMarkers = data
              .map((place) => {
                const lat = Number(place.y)
                const lng = Number(place.x)
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

                const pos = new kakaoMaps.LatLng(lat, lng)
                const markerImage = safeCreateMarkerImage(kakaoMaps, REC_MARKER_IMAGE)
                const marker = new kakaoMaps.Marker({
                  position: pos,
                  ...(markerImage ? { image: markerImage } : {}),
                })
                marker.setMap(map)
                return marker
              })
              .filter((marker): marker is KakaoMarker => marker !== null)

            setRecMarkers(nextRecMarkers)
            resolve()
          },
          {
            location: new kakaoMaps.LatLng(targetMidpoint.lat, targetMidpoint.lng),
            radius: 3000,
            sort: (services as any).SortBy.DISTANCE
          },
        )
      })
    },
    [activeCategory, clearRecMarkers, mapInstance],
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
      setKakaoError('카카오 지도 API 키를 `.env`의 `VITE_KAKAO_MAP_APPKEY`로 설정해 주세요.')
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

  const visibleRecommendations = recommendations.slice(0, Math.min(5 + loadMoreCount * 5, 20))
  const canLoadMore = recommendations.length > visibleRecommendations.length && loadMoreCount < 3

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {step === 'input' ? (
        <>
          <h1 style={{ margin: 0, fontSize: 22 }}>중간지점 찾기</h1>
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
                <div style={{ flex: 1 }}>
                  <TextField
                    variant="box"
                    label={`출발지 ${index + 1}`}
                    labelOption="sustain"
                    placeholder="예: 강남역, 서울역"
                    value={address}
                    onChange={(e) => updateAddress(index, e.target.value)}
                  />
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
              <div style={{ fontWeight: 700 }}>중간지점</div>
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recommendations.length === 0 ? (
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
                  visibleRecommendations.map((place, index) => (
                    <div
                      key={`${place.id ?? place.place_name ?? index}-${index}`}
                      style={{
                        color: '#08060d',
                        border: '1px solid rgba(0,0,0,0.08)',
                        borderRadius: 10,
                        padding: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        background: '#fff',
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
                  ))
                )}
                {canLoadMore ? (
                  <button
                    type="button"
                    onClick={() => setLoadMoreCount((prev) => Math.min(prev + 1, 3))}
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
    </div>
  )
}

