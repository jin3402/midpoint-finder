import { Button, TextField } from '@toss/tds-mobile'
import type { KakaoPlacesResult } from '../../types/kakao'

interface AddressInputStepProps {
  addresses: string[]
  focusedIndex: number | null
  suggestions: KakaoPlacesResult[]
  isFinding: boolean
  canSearch: boolean
  findError: string | null
  onChangeAddress: (index: number, value: string) => void
  onFocusAddress: (index: number) => void
  onBlurAddress: (index: number) => void
  onSelectSuggestion: (index: number, place: KakaoPlacesResult) => void
  onAddAddress: () => void
  onRemoveAddress: (index: number) => void
  onFind: () => void
}

/** 출발지를 입력하고 "중간지점 찾기"를 누르는 첫 화면이에요. */
export default function AddressInputStep({
  addresses,
  focusedIndex,
  suggestions,
  isFinding,
  canSearch,
  findError,
  onChangeAddress,
  onFocusAddress,
  onBlurAddress,
  onSelectSuggestion,
  onAddAddress,
  onRemoveAddress,
  onFind,
}: AddressInputStepProps) {
  return (
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
                onChange={(e) => onChangeAddress(index, e.target.value)}
                onFocus={() => onFocusAddress(index)}
                onBlur={() => onBlurAddress(index)}
                autoComplete="off"
              />
              {focusedIndex === index && suggestions.length > 0 ? (
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
                  {suggestions.map((place, sIdx) => (
                    <button
                      key={`${place.id ?? place.place_name}-${sIdx}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onSelectSuggestion(index, place)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        border: 'none',
                        borderBottom:
                          sIdx < suggestions.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
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
              onClick={() => onRemoveAddress(index)}
            >
              삭제
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="weak"
        color="primary"
        display="full"
        size="large"
        onClick={onAddAddress}
      >
        + 인원 추가
      </Button>

      <Button
        type="button"
        color="primary"
        variant="fill"
        display="full"
        size="xlarge"
        loading={isFinding}
        disabled={isFinding || !canSearch}
        onClick={onFind}
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
  )
}
