# 지역 검색 (Dong Search) — React 구현

기능명세서(정책 P-01~P-07, 화면 M-01~M-04 / R-01~R-04 / D-01~D-04)를 기반으로 만든 React + Vite 프로젝트입니다.

## 실행 방법

```bash
cd dongsearch
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 접속.

## Kakao Maps 설정 (중요)

`index.html` 에 아래 JS 키가 이미 적용되어 있습니다.

```
bd38e8d03335d607a71a4550c1b9f4e6
```

**Kakao Developers 콘솔 → 내 애플리케이션 → 플랫폼 → Web 에 서비스 도메인을 등록해야 합니다.**
로컬 개발 시에는 `http://localhost:5173` 을 등록하세요. 등록하지 않으면 지도가 "등록되지 않은 도메인" 에러로
렌더링되지 않고, 앱 화면에는 M-01 예외 3(지도를 불러오지 못했어요) 화면이 표시됩니다.

## 실제로 동작하는 부분 (Mock 아님)

- **M-01 지도 조회**: 실제 Kakao Map 렌더링, `navigator.geolocation`으로 현재 위치 중심 이동, 권한 거부/미지원 시 서울시청 기본 중심 폴백
- **M-02 지역 선택**: 시/도 → 구/군(최대 3개) 선택, 확정 시 각 구를 Kakao 지오코딩해 지도 자동 fit
- **R-01 시설 데이터 조회**: `kakao.maps.services.Places`로 실제 키워드/카테고리 검색 (선택 구 중심 반경 검색)
- **동 단위 집계**: 검색된 각 시설 좌표를 `services.Geocoder.coord2RegionCode`로 실제 행정동에 역지오코딩하여 집계
- **R-02 점수 산출**: Σ(가중치 × 시설 수), 순위 정렬
- **R-04 / D-01 / D-03**: 실제 데이터 기반 리스트, 핀 마커(+클러스터링), 막대 그래프
- **D-04 점수 차이 비교**: 두 번째 동 선택 시 리스트에 (+n)/(-n) 배지 표시
- **P-01~P-07 정책**: 로딩 스피너, 에러 토스트(3초, 10초 타임아웃 + 최대 2회 재시도), 200자 제한, 구 미선택/최대 3개 경고, 빈 결과 안내, 1280px 기준 반응형(모바일은 지도 축소 + 패널 하단 배치)

## 실제 배포 전 반드시 교체해야 하는 부분

1. **M-04 자연어→키워드 변환 (OpenAI)**
   OpenAI API 키는 절대 프론트엔드에 넣으면 안 되므로, 이 프로젝트는 `VITE_KEYWORD_API_URL` 환경변수로
   지정한 백엔드를 호출하도록 만들어져 있습니다 (`src/services/keywordService.js`).
   백엔드는 `{ query, taxonomy }`를 받아 스펙의 JSON 스키마(`{ categories, unmapped }`)를 반환하면 됩니다.
   **환경변수를 설정하지 않으면 규칙 기반 로컬 폴백(육아/노년/반려동물 등)으로 동작합니다.**

2. **D-02 선정 이유 생성 (OpenAI)**
   동일한 이유로 `VITE_REASON_API_URL` 환경변수로 백엔드를 연결하세요 (`src/services/reasonService.js`).
   미설정 시 로컬 템플릿 문장으로 폴백합니다.

   `.env` 예시:
   ```
   VITE_KEYWORD_API_URL=https://your-backend.com/api/convert-keywords
   VITE_REASON_API_URL=https://your-backend.com/api/generate-reason
   ```

3. **R-02 경계 보정(버퍼 방식) / R-03 히트맵 폴리곤**
   스펙대로라면 실제 "동 폴리곤 GeoJSON"이 있어야 `turf.buffer` + `turf.booleanPointInPolygon`으로
   정확한 500m 버퍼 카운팅과 폴리곤 히트맵을 그릴 수 있습니다. 이 프로젝트에는 동 경계 데이터 소스가
   연결되어 있지 않아, 현재는:
   - 점수 계산: 역지오코딩으로 판정된 동 이름 기준 단순 집계 (버퍼 없음)
   - 히트맵 표시: 동 폴리곤 대신 검색된 시설 좌표의 평균 위치에 원형(circle) 오버레이로 근사 표시

   `src/services/scoring.js`의 `scoreDongWithBuffer(polygon, points, categories, bufferKm)` 함수가
   스펙 그대로 구현되어 있으니, 동 경계 GeoJSON(예: SGIS 행정동 경계, VWorld 등)을 확보하면 이 함수와
   `kakao.maps.Polygon` 렌더링으로 그대로 교체할 수 있습니다.

4. **R-01 공공데이터 사전 저장 DB**
   스펙은 "① 공공데이터 DB 우선 → ② Kakao 키워드 검색 보완" 순서를 요구합니다. 이 프로젝트는 ②만
   구현되어 있으므로, 실제 서비스에서는 공공데이터 DB 조회를 `facilityService.collectFacilitiesByDong`
   앞단에 추가하세요.

5. **호출량 최적화**
   현재는 구×키워드마다 실시간으로 Kakao Places 검색 + 결과 시설마다 역지오코딩을 호출합니다(카테고리당
   최대 15개로 제한). 실제 서비스에서는 이 결과를 서버/DB에 캐싱해 반복 호출을 줄이는 것을 권장합니다.

## 폴더 구조

```
src/
  data/regions.js            # M-02 시/도-구/군 목록
  hooks/useKakaoLoader.js     # Kakao SDK 로드
  services/keywordService.js  # M-04
  services/facilityService.js # R-01
  services/scoring.js         # R-02 (+ 버퍼 함수)
  services/reasonService.js   # D-02
  components/MapView.jsx      # M-01, R-03, D-01
  components/Sidebar/*        # M-02/M-03, R-04, D-02~D-04
  App.jsx                     # 화면 전환 + P-01~P-07
```
