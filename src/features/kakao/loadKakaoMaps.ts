import type { KakaoMaps } from '../../types/kakao'

const SCRIPT_ID = 'kakao-maps-sdk'

let loadPromise: Promise<KakaoMaps> | null = null

function sdkUrl(appKey: string) {
  return `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false&libraries=services`
}

/**
 * Kakao Maps JS SDK를 한 번만 주입하고, `kakao.maps.load()`까지 끝난 뒤 resolve해요.
 *
 * - `autoload=false`로 받아 준비 시점을 직접 제어해요. 스크립트가 로드된 직후에는
 *   `kakao.maps`는 있어도 `services`·`Map` 같은 생성자는 아직 없어요.
 * - 여러 곳에서 동시에 불러도 스크립트는 하나만 주입돼요.
 * - 실패하면 스크립트와 캐시를 지워서 다음 호출에서 다시 시도할 수 있어요.
 */
export function loadKakaoMaps(appKey: string): Promise<KakaoMaps> {
  const current = window.kakao?.maps
  if (current?.services) return Promise.resolve(current)
  if (loadPromise) return loadPromise

  loadPromise = new Promise<KakaoMaps>((resolve, reject) => {
    const initialize = () => {
      const maps = window.kakao?.maps
      if (!maps?.load) {
        reject(new Error('카카오 지도 SDK를 불러왔지만 초기화할 수 없어요.'))
        return
      }
      maps.load(() => resolve(maps))
    }

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    if (existing && window.kakao?.maps) {
      initialize()
      return
    }

    const script = existing ?? document.createElement('script')
    script.addEventListener('load', initialize, { once: true })
    script.addEventListener(
      'error',
      () => reject(new Error('카카오 지도 SDK를 불러오지 못했어요. 네트워크를 확인해 주세요.')),
      { once: true },
    )

    if (!existing) {
      script.id = SCRIPT_ID
      script.async = true
      script.src = sdkUrl(appKey)
      document.head.appendChild(script)
    }
  }).catch((error: unknown) => {
    loadPromise = null
    document.getElementById(SCRIPT_ID)?.remove()
    throw error
  })

  return loadPromise
}
