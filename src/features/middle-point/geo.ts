export type LatLng = {
  lat: number
  lng: number
}

function toRadians(deg: number) {
  return (deg * Math.PI) / 180
}

function toDegrees(rad: number) {
  return (rad * 180) / Math.PI
}

function normalizeLng(deg: number) {
  // [-180, 180)로 정규화
  const normalized = ((deg + 180) % 360 + 360) % 360 - 180
  return normalized
}

/**
 * 두 좌표의 “구면 중간점(대권 중간)”을 계산합니다.
 * - 단순 위/경도 평균과 달리 지구 곡면을 고려합니다.
 */
export function geographicMidpoint(a: LatLng, b: LatLng): LatLng {
  const lat1 = toRadians(a.lat)
  const lon1 = toRadians(a.lng)
  const lat2 = toRadians(b.lat)
  const lon2 = toRadians(b.lng)

  // 좌표를 3D 단위 구 위의 벡터로 변환
  const x1 = Math.cos(lat1) * Math.cos(lon1)
  const y1 = Math.cos(lat1) * Math.sin(lon1)
  const z1 = Math.sin(lat1)

  const x2 = Math.cos(lat2) * Math.cos(lon2)
  const y2 = Math.cos(lat2) * Math.sin(lon2)
  const z2 = Math.sin(lat2)

  // 벡터 평균
  const x = x1 + x2
  const y = y1 + y2
  const z = z1 + z2

  const lon = Math.atan2(y, x)
  const hyp = Math.sqrt(x * x + y * y)
  const lat = Math.atan2(z, hyp)

  return {
    lat: toDegrees(lat),
    lng: normalizeLng(toDegrees(lon)),
  }
}

export function isValidLatLng(value: LatLng) {
  return isValidLat(value.lat) && isValidLng(value.lng)
}

/** 여러 좌표의 위도·경도 산술 평균(중간지점 근사). */
export function arithmeticMeanLatLng(points: LatLng[]): LatLng | null {
  const valid = points.filter(isValidLatLng)
  if (valid.length === 0) return null
  const sumLat = valid.reduce((s, p) => s + p.lat, 0)
  const sumLng = valid.reduce((s, p) => s + p.lng, 0)
  const n = valid.length
  return { lat: sumLat / n, lng: sumLng / n }
}

export function isValidLat(lat: number) {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90
}

export function isValidLng(lng: number) {
  return Number.isFinite(lng) && lng >= -180 && lng <= 180
}

