# 중간지점 찾기

여러 사람의 출발지를 입력하면 중간 지점을 계산하고, 그 주변 맛집·카페·볼거리를 추천하는 앱인토스(Apps in Toss) 미니앱입니다. 개인 프로젝트입니다.

- 플랫폼: 앱인토스 WebView 미니앱 (`midpoint-finder`, `package.json` 버전 1.0.6)
- 저장소에는 배포 링크가 없습니다. 토스 앱의 미니앱으로만 접근할 수 있습니다.
- 기기 위치 권한을 요구하지 않습니다(`permissions: []`). 출발지는 주소·장소명 입력으로 받습니다.

## 주요 기능

- 출발지 2곳 이상 입력(인원 추가/삭제), 입력 중 장소 자동완성
- 카카오 장소 검색으로 좌표를 얻고, 위도·경도 산술 평균으로 중간 지점 계산
- 지도에 출발지·중간 지점 마커 표시, 중간 지점의 행정동 이름 표시
- 중간 지점 주변 맛집(`FD6`)·카페(`CE7`)·볼거리(`AT4`) 최대 50곳, 가까운 순
- 장소 공유(OS 공유 시트 → 클립보드 복사), 카카오맵·네이버지도로 열기(이동 전 전면 광고)
- 하단 배너 광고, 공유 시 프로모션 포인트 지급(기기당 1회)

## 기술 스택

TypeScript, React 18, Vite, `@apps-in-toss/web-framework`, TDS(`@toss/tds-mobile`), Kakao Maps JavaScript SDK(`services`), Vitest + Testing Library

## 문제와 해결

**1. 지도: iframe 대신 SDK를 직접 로드, 로딩 순서 제어**
토스 미니앱 WebView에서는 iframe으로 띄운 지도가 차단돼 Kakao Maps JS SDK를 스크립트로 주입해 앱이 가진 `div`에 직접 그립니다(이 전환은 첫 커밋 이전의 일이라 저장소 기록에는 없습니다). SDK를 `autoload=false`로 받고 `kakao.maps.load()` 콜백 뒤에야 준비 완료로 봅니다. 여러 곳에서 불러도 스크립트는 한 번만 주입하고, 실패하면 다음 시도에서 다시 받습니다.
이 로더만 남기고 `index.html`의 SDK 태그를 지운 뒤(`fe5be73`), 로더가 결과 화면에서만 실행돼 입력 화면 검색이 항상 실패하는 회귀가 있었습니다. 입력 화면 진입 시 로드하고 검색 버튼이 로드를 기다리도록 고쳤고, 회귀 테스트가 있습니다.
관련: `src/features/kakao/loadKakaoMaps.ts`, `src/features/middle-point/MiddlePointFinder.test.tsx`

**2. 카카오 카테고리 검색의 45개 상한**
카테고리 검색은 한 조건당 15개 × 3페이지, 최대 45개만 돌려줍니다. 반경을 3·6·10·15·20km로 넓혀 가며 다시 조회하고, 장소 id로 중복을 없앤 뒤 가까운 순으로 최대 50곳을 모읍니다. 응답에 `hasNextPage`가 없을 때는 결과 개수(15개 미만이면 마지막 페이지)로 판단합니다.
관련: `src/features/kakao/places.ts` (반경 확장·종료 조건 테스트 포함)

**3. 카테고리를 빠르게 바꾸면 이전 결과가 덮어씀**
위 수집은 한 번에 최대 15번 순서대로 요청해서, 맛집 검색이 끝나기 전에 카페로 바꾸면 늦게 끝난 맛집 결과가 카페 탭에 나올 수 있었습니다. 검색마다 번호를 매겨 최신 검색이 아니면 결과를 버립니다.
관련: `MiddlePointFinder.tsx`의 `latestSearchIdRef`, `MiddlePointFinder.test.tsx`

**4. 앱인토스 검수: 앱 이름·아이콘을 콘솔 등록값과 일치**
`granite.config.ts`의 `brand.displayName`이 앱 ID(`midpoint-finder`)로, 아이콘이 로컬 경로로 되어 있어 콘솔에 등록한 값과 달랐습니다. 이름을 `중간지점찾기`로(`1601c89`), 아이콘을 콘솔에 올린 이미지 URL로(`9069cd8`) 맞춰 심사 반려를 해결했습니다.

## 설계 메모: 구면 중간점 대신 산술 평균

`geo.ts`에 두 방식이 있습니다. 구면(대권) 중간점 `geographicMidpoint`는 두 점만 다루고, 앱은 출발지를 2곳 이상 받으므로 N개를 다루는 산술 평균 `arithmeticMeanLatLng`를 씁니다. 강남역–서울역(약 8km)에서 두 방식의 차이가 5m 미만임을 테스트로 확인합니다(`geo.test.ts`). 전국 단위로 범위를 넓히면 구면 방식으로 바꾸는 것이 맞습니다.

## 구조

```text
src/
├── features/
│   ├── middle-point/   # 메인 화면(MiddlePointFinder), 입력 단계, 추천 목록, 액션시트, 중간점 계산(geo.ts)
│   ├── kakao/          # SDK 로더, 장소 검색·추천 수집·지역명 조회, 마커 이미지
│   ├── ads/            # 전면·배너 광고 훅
│   ├── promotion/      # 공유 프로모션 지급
│   └── share/          # 공유·외부 지도 링크
└── types/kakao.d.ts    # 사용하는 Kakao Maps SDK 타입
```

## 로컬 실행

Node 22에서 확인했습니다.

```bash
cp .env.example .env   # VITE_KAKAO_MAP_APPKEY 입력
npm ci
npm run dev            # http://localhost:5173
npm test
npm run lint
npm run typecheck
npm run build          # ait build → midpoint-finder.ait
```

- 카카오 개발자 콘솔에서 JavaScript 키를 발급하고, 실행할 도메인(예: `http://localhost:5173`)을 플랫폼에 등록해야 지도가 뜹니다.
- 광고·프로모션은 토스 앱(샌드박스/QR 테스트)에서만 동작하고, 일반 브라우저에서는 건너뜁니다.

## 환경변수

| 이름 | 용도 |
|---|---|
| `VITE_KAKAO_MAP_APPKEY` | Kakao Maps JavaScript SDK 앱 키 (필수) |

JavaScript 키는 브라우저로 내려가는 키라 번들에 포함됩니다. 카카오 콘솔의 플랫폼(도메인) 제한으로 보호해야 합니다.

## 한계와 다음 단계

- 출발지 수에 상한이 없습니다. 마커 색은 5가지를 순환합니다.
- 좌표를 못 찾은 출발지는 조용히 빼고 계산합니다. 2곳 미만일 때만 안내하므로, 어떤 출발지가 빠졌는지 알려주는 것이 다음 개선점입니다.
- 전면 광고가 로드된 뒤 닫힘·실패 이벤트가 오지 않으면 지도 이동이 대기 상태로 남을 수 있습니다. 시간 제한을 두는 것이 좋습니다.
- 공유 프로모션은 `IS_PROMOTION_TEST_PHASE = true`(테스트 코드)이고 운영 코드 자리는 `REPLACE_WITH_PRODUCTION_PROMOTION_CODE`로 비어 있습니다.
- 공유 시트를 취소해도 `shareText`가 `'shared'`를 돌려줘 프로모션 지급 대상이 됩니다. 프로모션 조건에 맞는지 확인이 필요합니다.
