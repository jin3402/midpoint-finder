import type { CSSProperties } from 'react'
import type { KakaoPlacesResult } from '../../types/kakao'

export type MapProvider = 'kakao' | 'naver'

interface PlaceActionSheetProps {
  place: KakaoPlacesResult
  isOpeningMap: boolean
  onClose: () => void
  onShare: () => void
  onViewOnMap: (provider: MapProvider) => void
}

function actionButtonStyle(isOpeningMap: boolean, overrides: CSSProperties): CSSProperties {
  return {
    border: 'none',
    borderRadius: 12,
    padding: '14px 12px',
    fontWeight: 700,
    fontSize: 15,
    cursor: isOpeningMap ? 'default' : 'pointer',
    ...overrides,
  }
}

/** 추천 장소를 눌렀을 때 뜨는 "공유하기 / 카카오맵 / 네이버지도" 시트예요. */
export default function PlaceActionSheet({
  place,
  isOpeningMap,
  onClose,
  onShare,
  onViewOnMap,
}: PlaceActionSheetProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${place.place_name ?? '추천 장소'} 옵션`}
      onClick={() => !isOpeningMap && onClose()}
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
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'rgba(0,0,0,0.12)',
            margin: '0 auto 6px',
          }}
        />

        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#08060d' }}>
            {place.place_name ?? '추천 장소'}
          </div>
          <div style={{ fontSize: 13, color: '#6b6375', marginTop: 4 }}>
            {place.road_address_name || place.address_name || ''}
          </div>
        </div>

        <button
          type="button"
          onClick={onShare}
          disabled={isOpeningMap}
          style={actionButtonStyle(isOpeningMap, {
            background: 'rgba(49,130,246,0.08)',
            color: '#3182F6',
            opacity: isOpeningMap ? 0.5 : 1,
          })}
        >
          공유하기
        </button>
        <button
          type="button"
          onClick={() => onViewOnMap('kakao')}
          disabled={isOpeningMap}
          style={actionButtonStyle(isOpeningMap, {
            background: 'rgba(255, 224, 0, 0.18)',
            color: '#8a6d00',
            opacity: isOpeningMap ? 0.6 : 1,
          })}
        >
          {isOpeningMap ? '이동 준비 중...' : '카카오맵으로 보기'}
        </button>
        <button
          type="button"
          onClick={() => onViewOnMap('naver')}
          disabled={isOpeningMap}
          style={actionButtonStyle(isOpeningMap, {
            background: 'rgba(3, 199, 90, 0.12)',
            color: '#03A24A',
            opacity: isOpeningMap ? 0.6 : 1,
          })}
        >
          {isOpeningMap ? '이동 준비 중...' : '네이버지도로 보기'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isOpeningMap}
          style={actionButtonStyle(isOpeningMap, {
            padding: '12px',
            fontSize: 14,
            background: 'transparent',
            color: '#6b6375',
          })}
        >
          닫기
        </button>
      </div>
    </div>
  )
}
