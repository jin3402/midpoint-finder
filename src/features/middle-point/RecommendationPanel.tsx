import { getPlaceKey } from '../kakao/places'
import type { KakaoPlacesResult } from '../../types/kakao'
import { CATEGORIES, type Category } from './categories'

interface RecommendationPanelProps {
  activeCategory: Category
  recommendations: KakaoPlacesResult[]
  visibleCount: number
  isLoading: boolean
  onSelectCategory: (category: Category) => void
  onOpenPlace: (place: KakaoPlacesResult) => void
  onLoadMore: () => void
}

const messageBoxStyle = {
  padding: 12,
  borderRadius: 10,
  background: 'rgba(0,0,0,0.03)',
  color: '#6b6375',
  fontWeight: 600,
} as const

/** 중간지점 주변 추천 장소: 카테고리 칩 + 목록 + 더보기 */
export default function RecommendationPanel({
  activeCategory,
  recommendations,
  visibleCount,
  isLoading,
  onSelectCategory,
  onOpenPlace,
  onLoadMore,
}: RecommendationPanelProps) {
  const visibleRecommendations = recommendations.slice(0, visibleCount)
  const canLoadMore = recommendations.length > visibleRecommendations.length

  return (
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
              onClick={() => onSelectCategory(category)}
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
        {isLoading ? (
          <div style={messageBoxStyle}>주변 {activeCategory} 정보를 모으고 있어요...</div>
        ) : recommendations.length === 0 ? (
          <div style={messageBoxStyle}>주변에 추천할 장소가 없어요</div>
        ) : (
          visibleRecommendations.map((place, index) => (
            <div
              key={`${getPlaceKey(place)}-${index}`}
              role="button"
              tabIndex={0}
              onClick={() => onOpenPlace(place)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onOpenPlace(place)
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
          ))
        )}
        {canLoadMore ? (
          <button
            type="button"
            onClick={onLoadMore}
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
  )
}
