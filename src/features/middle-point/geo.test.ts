import { describe, expect, it } from 'vitest'
import { arithmeticMeanLatLng, geographicMidpoint, isValidLatLng, type LatLng } from './geo'

/** 두 좌표 사이 거리(m), 하버사인 공식 */
function distanceMeters(a: LatLng, b: LatLng) {
  const R = 6_371_000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const gangnam = { lat: 37.4979, lng: 127.0276 }
const seoulStation = { lat: 37.5547, lng: 126.9707 }
const hongdae = { lat: 37.5572, lng: 126.9245 }

describe('arithmeticMeanLatLng', () => {
  it('N개 좌표의 위도·경도 평균을 낸다', () => {
    const mean = arithmeticMeanLatLng([gangnam, seoulStation, hongdae])
    expect(mean?.lat).toBeCloseTo((37.4979 + 37.5547 + 37.5572) / 3, 10)
    expect(mean?.lng).toBeCloseTo((127.0276 + 126.9707 + 126.9245) / 3, 10)
  })

  it('범위를 벗어나거나 숫자가 아닌 좌표는 빼고 계산한다', () => {
    expect(arithmeticMeanLatLng([gangnam, { lat: Number.NaN, lng: 0 }, { lat: 91, lng: 0 }])).toEqual(
      gangnam,
    )
  })

  it('유효한 좌표가 없으면 null', () => {
    expect(arithmeticMeanLatLng([])).toBeNull()
    expect(arithmeticMeanLatLng([{ lat: 200, lng: 0 }])).toBeNull()
  })
})

describe('geographicMidpoint', () => {
  it('두 점에서 같은 거리에 있다', () => {
    const mid = geographicMidpoint(gangnam, seoulStation)
    expect(distanceMeters(mid, gangnam)).toBeCloseTo(distanceMeters(mid, seoulStation), 3)
  })

  it('서울 시내 거리에서는 산술 평균과의 차이가 몇 미터 수준이다', () => {
    const spherical = geographicMidpoint(gangnam, seoulStation)
    const mean = arithmeticMeanLatLng([gangnam, seoulStation])!
    expect(distanceMeters(spherical, mean)).toBeLessThan(5)
  })

  it('날짜 변경선을 넘는 경도도 [-180, 180) 범위로 돌려준다', () => {
    const mid = geographicMidpoint({ lat: 0, lng: 179 }, { lat: 0, lng: -179 })
    expect(isValidLatLng(mid)).toBe(true)
    expect(Math.abs(mid.lng)).toBeCloseTo(180, 6)
  })
})
