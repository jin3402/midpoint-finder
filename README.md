# 🛣️ 중간지점 찾기 (WhichFinder)

친구들과 만날 때 "어디서 볼까?" 고민하지 마세요! 
**중간지점 찾기**는 앱인토스(Apps In Toss) 환경에서 동작하는 미니앱으로, 여러 명의 출발지를 입력받아 가장 공평한 중간 위치를 찾아주고 주변의 추천 장소까지 알려주는 서비스입니다.

## ✨ 주요 기능
* **다중 출발지 입력**: 최소 2명에서 최대 6명까지 친구들의 출발지 주소를 입력할 수 있습니다.
* **정확한 중간지점 계산**: 카카오 로컬 API(Geocoder)를 활용해 주소를 위도/경도로 변환하고, 정확한 무게중심(중간지점)을 계산합니다.
* **주변 핫플 추천**: 계산된 중간지점을 바탕으로 카카오 키워드 검색 API를 호출하여 주변 맛집과 카페를 추천해 줍니다.
* **TDS(Toss Design System) 적용**: 토스 앱과 이질감 없는 깔끔하고 직관적인 UI/UX를 제공합니다.

## 🛠 기술 스택
* **Framework**: React, Vite, TypeScript
* **Platform**: Apps In Toss (앱인토스) Web Framework
* **API**: Kakao Maps JavaScript SDK
* **Design**: Toss Design System (TDS) 기반 컴포넌트

