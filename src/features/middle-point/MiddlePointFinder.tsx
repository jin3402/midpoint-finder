import { useCallback, useEffect, useRef, useState } from 'react'
import { useFullScreenAd } from '../ads/useFullScreenAd'
import { loadKakaoMaps } from '../kakao/loadKakaoMaps'
import { createMarkerImage, createTossPinImage, MID_MARKER_IMAGE, SOURCE_COLORS } from '../kakao/markers'
import { collectNearbyPlaces, resolveRegionName, searchPlaceCoords } from '../kakao/places'
import { usePromotionReward } from '../promotion/usePromotionReward'
import { buildKakaoMapUrl, buildNaverMapSearchUrl, openExternalMapUrl, shareText } from '../share/shareUtils'
import type { KakaoMap, KakaoMarker, KakaoPlacesResult } from '../../types/kakao'
import AddressInputStep from './AddressInputStep'
import { CATEGORY_CODES, type Category } from './categories'
import { arithmeticMeanLatLng, type LatLng } from './geo'
import PlaceActionSheet, { type MapProvider } from './PlaceActionSheet'
import RecommendationPanel from './RecommendationPanel'
import ShareToast from './ShareToast'
import { buildMidpointShareMessage, buildPlaceShareMessage, placeSearchQuery } from './shareMessages'

const INITIAL_VISIBLE_RECOMMENDATIONS = 10
const LOAD_MORE_STEP = 20
const MISSING_APP_KEY_MESSAGE = '지도 API 키를 `.env`의 `VITE_KAKAO_MAP_APPKEY`로 설정해 주세요.'

function formatLatLng(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000
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
  const [isKakaoReady, setIsKakaoReady] = useState(false)
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
  /** 가장 최근에 시작한 검색만 결과를 반영하려고 쓰는 번호예요. (카테고리를 빠르게 바꿀 때 대비) */
  const latestSearchIdRef = useRef(0)
  const kakaoAppKey = import.meta.env.VITE_KAKAO_MAP_APPKEY as string | undefined

  // 출발지 자동완성과 좌표 변환(Places)이 입력 화면에서 바로 필요해서, 화면에 들어오자마자 SDK를 불러와요.
  // 여기서 실패하면 "중간지점 찾기"를 누를 때 다시 시도하고, 그때 안내 문구를 보여줘요.
  useEffect(() => {
    if (!kakaoAppKey) return
    let cancelled = false
    loadKakaoMaps(kakaoAppKey)
      .then(() => {
        if (!cancelled) setIsKakaoReady(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [kakaoAppKey])

  const clearResult = useCallback(() => {
    // 진행 중인 추천 장소 검색이 나중에 끝나도 결과를 반영하지 않게 해요.
    latestSearchIdRef.current += 1
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

    if (!kakaoAppKey) {
      setFindError(MISSING_APP_KEY_MESSAGE)
      return
    }

    setIsFinding(true)
    try {
      // 입력 화면 진입 시 시작한 SDK 로딩이 아직 안 끝났으면 여기서 기다려요.
      const kakaoMaps = await loadKakaoMaps(kakaoAppKey).catch(() => null)
      const services = kakaoMaps?.services
      if (!services) {
        setFindError('지도 장소 검색 서비스를 불러오지 못했어요.')
        return
      }

      const places = new services.Places()
      const searched = await Promise.all(
        trimmed.map((keyword) => searchPlaceCoords(places, services.Status, keyword)),
      )
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
  }, [addresses, clearResult, kakaoAppKey])

  const searchNearbyPlaces = useCallback(
    async (targetMidpoint: LatLng) => {
      const kakaoMaps = window.kakao?.maps
      const services = kakaoMaps?.services
      if (!kakaoMaps || !services || !mapInstance) return

      const searchId = ++latestSearchIdRef.current
      setIsLoadingRecommendations(true)

      const sorted = await collectNearbyPlaces({
        places: new services.Places(),
        Status: services.Status,
        center: new kakaoMaps.LatLng(targetMidpoint.lat, targetMidpoint.lng),
        categoryCode: CATEGORY_CODES[activeCategory],
        sortBy: services.SortBy.DISTANCE,
        // 그사이 카테고리가 바뀌었거나 다시 검색했다면 이 결과는 버려요.
        isStale: () => searchId !== latestSearchIdRef.current,
      })
      if (!sorted) return

      setRecommendations(sorted)
      setLoadMoreCount(0)
      setIsLoadingRecommendations(false)
    },
    [activeCategory, mapInstance],
  )

  const resolveMidpointRegion = useCallback(async (targetMidpoint: LatLng) => {
    const services = window.kakao?.maps?.services
    if (!services) {
      setMidpointRegion('대략적인 위치 정보를 불러오지 못했어요.')
      return
    }

    const region = await resolveRegionName(new services.Geocoder(), services.Status, targetMidpoint)
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
      setKakaoError(MISSING_APP_KEY_MESSAGE)
      return
    }
    if (mapInstance) return // 이미 지도가 있으면 새로 안 그림

    const container = mapElRef.current
    let cancelled = false

    loadKakaoMaps(kakaoAppKey)
      .then((kakao) => {
        if (cancelled) return
        setMapInstance(
          new kakao.Map(container, {
            center: new kakao.LatLng(37.5665, 126.978),
            level: 6,
          }),
        )
      })
      .catch((error: unknown) => {
        if (!cancelled) setKakaoError(error instanceof Error ? error.message : String(error))
      })

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
    const addMarker = (point: LatLng, imageSrc: string) => {
      const position = new kakao.LatLng(point.lat, point.lng)
      bounds.extend(position)
      const image = createMarkerImage(kakao, imageSrc)
      const marker = new kakao.Marker({ position, ...(image ? { image } : {}) })
      marker.setMap(map)
      return marker
    }

    markersRef.current = [
      ...points.map((point, index) =>
        addMarker(point, createTossPinImage(SOURCE_COLORS[index % SOURCE_COLORS.length], `${index + 1}`)),
      ),
      addMarker(midpoint, MID_MARKER_IMAGE),
    ]
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
    if (!services) return

    const timeoutId = window.setTimeout(() => {
      new services.Places().keywordSearch(
        keyword,
        (data, status) => {
          setAddressSuggestions(status === services.Status.OK ? data.slice(0, 5) : [])
        },
        { size: 5 },
      )
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [addresses, focusedAddressIndex, isKakaoReady])

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

  const handleSharePlaceFromSheet = useCallback(() => {
    if (!actionSheetPlace) return
    void runShare(buildPlaceShareMessage(actionSheetPlace))
    setActionSheetPlace(null)
  }, [actionSheetPlace, runShare])

  // 카카오맵/네이버지도로 이동하기 전에 전면 광고를 보여주고, 닫히면(또는 미지원/실패 시) 바로 이동해요.
  const handleViewOnMap = useCallback(
    async (place: KakaoPlacesResult, provider: MapProvider) => {
      const url =
        provider === 'kakao' ? buildKakaoMapUrl(place) : buildNaverMapSearchUrl(placeSearchQuery(place))

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
    void runShare(buildMidpointShareMessage(regionText))
  }, [midpointRegion, runShare])

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {step === 'input' ? (
        <AddressInputStep
          addresses={addresses}
          focusedIndex={focusedAddressIndex}
          suggestions={addressSuggestions}
          isFinding={isFinding}
          canSearch={Boolean(kakaoAppKey) && !kakaoError}
          findError={findError}
          onChangeAddress={updateAddress}
          onFocusAddress={setFocusedAddressIndex}
          onBlurAddress={(index) => setFocusedAddressIndex((prev) => (prev === index ? null : prev))}
          onSelectSuggestion={selectAddressSuggestion}
          onAddAddress={addAddress}
          onRemoveAddress={removeAddress}
          onFind={() => void handleFindMidpoint()}
        />
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
            <RecommendationPanel
              activeCategory={activeCategory}
              recommendations={recommendations}
              visibleCount={INITIAL_VISIBLE_RECOMMENDATIONS + loadMoreCount * LOAD_MORE_STEP}
              isLoading={isLoadingRecommendations}
              onSelectCategory={setActiveCategory}
              onOpenPlace={setActionSheetPlace}
              onLoadMore={() => setLoadMoreCount((prev) => prev + 1)}
            />
          ) : null}
        </>
      ) : null}

      {shareToast ? <ShareToast message={shareToast} /> : null}

      {actionSheetPlace ? (
        <PlaceActionSheet
          place={actionSheetPlace}
          isOpeningMap={isOpeningMap}
          onClose={() => setActionSheetPlace(null)}
          onShare={handleSharePlaceFromSheet}
          onViewOnMap={(provider) => void handleViewOnMap(actionSheetPlace, provider)}
        />
      ) : null}
    </div>
  )
}
