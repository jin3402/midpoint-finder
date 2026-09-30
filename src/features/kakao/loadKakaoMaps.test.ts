import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { KakaoMaps } from '../../types/kakao'

async function freshLoader() {
  vi.resetModules()
  return (await import('./loadKakaoMaps')).loadKakaoMaps
}

function sdkScript() {
  return document.getElementById('kakao-maps-sdk') as HTMLScriptElement | null
}

/** 실제 SDK처럼 스크립트 로드 후에는 load()만 있고, load() 콜백 뒤에 services가 생겨요. */
function simulateSdkLoaded() {
  const maps = {
    load: (callback: () => void) => {
      Object.assign(maps, { services: {} })
      callback()
    },
  }
  window.kakao = { maps: maps as unknown as KakaoMaps }
  sdkScript()!.dispatchEvent(new Event('load'))
}

beforeEach(() => {
  delete window.kakao
  document.head.innerHTML = ''
})

afterEach(() => {
  delete window.kakao
})

describe('loadKakaoMaps', () => {
  it('여러 번 불러도 스크립트는 하나만 주입하고 같은 결과를 돌려준다', async () => {
    const loadKakaoMaps = await freshLoader()
    const first = loadKakaoMaps('key')
    const second = loadKakaoMaps('key')

    expect(document.querySelectorAll('#kakao-maps-sdk')).toHaveLength(1)
    expect(sdkScript()!.src).toContain('autoload=false')
    expect(sdkScript()!.src).toContain('libraries=services')

    simulateSdkLoaded()
    const [a, b] = await Promise.all([first, second])
    expect(a).toBe(b)
    expect(a.services).toBeDefined()
  })

  it('kakao.maps.load() 콜백이 끝난 뒤에야 resolve한다', async () => {
    const loadKakaoMaps = await freshLoader()
    let loadCallback: (() => void) | null = null
    const promise = loadKakaoMaps('key')
    const resolved = vi.fn()
    void promise.then(resolved)

    window.kakao = {
      maps: {
        load: (callback: () => void) => {
          loadCallback = callback
        },
      } as unknown as KakaoMaps,
    }
    sdkScript()!.dispatchEvent(new Event('load'))
    await Promise.resolve()
    expect(resolved).not.toHaveBeenCalled()

    loadCallback!()
    await promise
    expect(resolved).toHaveBeenCalled()
  })

  it('스크립트 로드에 실패하면 다음 호출에서 다시 시도한다', async () => {
    const loadKakaoMaps = await freshLoader()
    const failed = loadKakaoMaps('key')
    sdkScript()!.dispatchEvent(new Event('error'))
    await expect(failed).rejects.toThrow('카카오 지도 SDK를 불러오지 못했어요')
    expect(sdkScript()).toBeNull()

    const retry = loadKakaoMaps('key')
    expect(sdkScript()).not.toBeNull()
    simulateSdkLoaded()
    await expect(retry).resolves.toBeDefined()
  })

  it('이미 준비돼 있으면 스크립트를 주입하지 않는다', async () => {
    const loadKakaoMaps = await freshLoader()
    const maps = { services: {} } as unknown as KakaoMaps
    window.kakao = { maps }
    await expect(loadKakaoMaps('key')).resolves.toBe(maps)
    expect(sdkScript()).toBeNull()
  })
})
