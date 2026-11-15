import { describe, expect, it } from 'vitest'
import { buildMidpointShareMessage, buildPlaceShareMessage } from './shareMessages'

describe('shareMessages', () => {
  it('장소 공유 문구에 이름·주소·네이버지도 링크를 담는다', () => {
    const message = buildPlaceShareMessage({
      place_name: '테스트 카페',
      road_address_name: '서울 중구 명동길 1',
      x: '127',
      y: '37.5',
    })
    expect(message.split('\n')).toEqual([
      '📍 테스트 카페',
      '서울 중구 명동길 1',
      `네이버지도로 보기: https://map.naver.com/p/search/${encodeURIComponent('테스트 카페 서울 중구 명동길 1')}`,
      '',
      '중간지점찾기로 찾은 곳이에요 🙂',
    ])
  })

  it('주소가 없으면 그 줄을 빼고, 이름이 없으면 "추천 장소"로 쓴다', () => {
    const lines = buildPlaceShareMessage({ x: '127', y: '37.5' }).split('\n')
    expect(lines[0]).toBe('📍 추천 장소')
    expect(lines[1]).toMatch(/^네이버지도로 보기: /)
  })

  it('지역명을 모르면 링크 없이 공유한다', () => {
    expect(buildMidpointShareMessage(null)).toBe('📍 우리의 중간지점\n\n중간지점찾기로 계산했어요 🙂')
  })
})
