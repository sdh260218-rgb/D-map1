// R-01 시설 데이터 조회
//
// 실제 서비스라면 "① 공공데이터 사전 저장 DB → ② Kakao 키워드 검색 보완" 순서가 되어야 하지만,
// 이 프로젝트에는 공공데이터 DB가 없으므로 Kakao Map JS SDK(services.Places)로 실시간 검색하고,
// 검색된 각 시설의 좌표를 좌표→행정동 역지오코딩(services.Geocoder.coord2RegionCode)으로
// 실제 "동" 단위에 배정합니다. (프로덕션에서는 이 역지오코딩 결과를 DB에 캐싱해 호출량을 줄이세요.)

const RETRY_LIMIT = 2; // P-07: 최대 2회 자동 재시도
const SEARCH_RADIUS = 3000; // meters, 구 중심 기준 검색 반경
const MAX_FACILITIES_PER_CATEGORY = 15; // 과도한 역지오코딩 호출 방지용 상한

function withRetry(taskFn) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const attempt = () => {
      taskFn()
        .then(resolve)
        .catch((err) => {
          attempts += 1;
          if (attempts <= RETRY_LIMIT) attempt();
          else reject(err);
        });
    };
    attempt();
  });
}

function getKakao() {
  if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
    throw new Error('kakao-sdk-not-loaded');
  }
  return window.kakao.maps;
}

export function geocodeGu(city, gu) {
  return withRetry(
    () =>
      new Promise((resolve, reject) => {
        const kakao = getKakao();
        const geocoder = new kakao.services.Geocoder();
        geocoder.addressSearch(`${city} ${gu}`, (result, status) => {
          if (status === kakao.services.Status.OK && result[0]) {
            resolve({ lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) });
          } else {
            reject(new Error('geocode-failed'));
          }
        });
      })
  );
}

export function searchFacilities({ keyword, categoryCode, center, radius = SEARCH_RADIUS }) {
  return withRetry(
    () =>
      new Promise((resolve, reject) => {
        const kakao = getKakao();
        const places = new kakao.services.Places();
        const baseOptions = {
          location: new kakao.LatLng(center.lat, center.lng),
          radius,
          sort: kakao.services.SortBy.DISTANCE,
        };
        const callback = (data, status) => {
          if (status === kakao.services.Status.OK) {
            resolve(data);
          } else if (status === kakao.services.Status.ZERO_RESULT) {
            resolve([]);
          } else {
            reject(new Error('places-search-failed'));
          }
        };
        if (keyword) {
          places.keywordSearch(
            keyword,
            callback,
            categoryCode ? { ...baseOptions, category_group_code: categoryCode } : baseOptions
          );
        } else if (categoryCode) {
          places.categorySearch(categoryCode, callback, baseOptions);
        } else {
          reject(new Error('no-search-term'));
        }
      })
  );
}

export function reverseGeocodeDong(lng, lat) {
  return withRetry(
    () =>
      new Promise((resolve, reject) => {
        const kakao = getKakao();
        const geocoder = new kakao.services.Geocoder();
        geocoder.coord2RegionCode(lng, lat, (result, status) => {
          if (status === kakao.services.Status.OK) {
            const h = result.find((r) => r.region_type === 'H') || result[0];
            resolve(h ? h.region_3depth_name : null);
          } else {
            reject(new Error('reverse-geocode-failed'));
          }
        });
      })
  );
}

// R-01 + R-02 파이프라인: 선택 구 × 변환된 카테고리별로 실시설 검색 → 동 단위 집계
// onProgress(message) 로 P-01 로딩 상태 텍스트를 갱신할 수 있습니다.
export async function collectFacilitiesByDong({ city, districts, categories, onProgress }) {
  const dongMap = {}; // { [dongName]: { gu, counts: {label: count}, points: [{lat,lng,category,place_name}] } }

  for (const gu of districts) {
    // eslint-disable-next-line no-await-in-loop
    const center = await geocodeGu(city, gu);

    for (const cat of categories) {
      onProgress?.(`${gu} · ${cat.label} 검색 중`);
      // eslint-disable-next-line no-await-in-loop
      const places = await searchFacilities({
        keyword: cat.keyword || cat.label,
        categoryCode: cat.code,
        center,
      });

      const limited = places.slice(0, MAX_FACILITIES_PER_CATEGORY);
      for (const p of limited) {
        const lng = parseFloat(p.x);
        const lat = parseFloat(p.y);
        // eslint-disable-next-line no-await-in-loop
        const dong = await reverseGeocodeDong(lng, lat).catch(() => null);
        if (!dong) continue; // R-02 예외: 특정 시설 배정 실패는 건너뜀 (전체 중단 X)

        if (!dongMap[dong]) {
          dongMap[dong] = { gu, counts: {}, points: [] };
        }
        const key = cat.label;
        dongMap[dong].counts[key] = (dongMap[dong].counts[key] || 0) + 1;
        dongMap[dong].points.push({ lat, lng, category: key, place_name: p.place_name });
      }
    }
  }

  return dongMap;
}
