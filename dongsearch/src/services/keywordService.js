// M-04 키워드 변환
//
// 닫힌 카테고리 목록(taxonomy): Kakao Map 카테고리 그룹 코드 내에서만 선택.
export const TAXONOMY = [
  { code: 'HP8', label: '병원' },
  { code: 'PM9', label: '약국' },
  { code: 'PS3', label: '어린이집·유치원' },
  { code: 'SC4', label: '학교' },
  { code: 'AC5', label: '학원' },
  { code: 'CT1', label: '문화시설' },
  { code: 'SW8', label: '지하철역' },
  { code: 'MT1', label: '대형마트' },
];

// 실제 서비스에서는 OpenAI Structured Outputs(JSON 스키마 모드)로 아래와 동일한 형태를 반환하는
// 백엔드(/api/convert-keywords 등)를 두고 VITE_KEYWORD_API_URL 로 지정합니다.
// (OpenAI API 키는 프론트엔드에 절대 노출하면 안 되므로, 브라우저에서 직접 호출하지 않습니다.)
//
// 백엔드가 없을 때는 아래 규칙 기반 로컬 추론으로 자동 폴백합니다. (데모/오프라인 동작용)
const RULES = [
  {
    test: /육아|아이|초등|유치원|어린이집/,
    categories: [
      { code: 'PS3', label: '유치원', keyword: '유치원', weight: 3 },
      { code: 'SC4', label: '초등학교', keyword: '초등학교', weight: 3 },
      { code: 'HP8', label: '소아과', keyword: '소아과', weight: 2 },
      { code: 'CT1', label: '공원', keyword: '공원', weight: 1 },
    ],
  },
  {
    test: /노년|노인|요양|어르신|경로당/,
    categories: [
      { code: 'HP8', label: '요양병원', keyword: '요양병원', weight: 3 },
      { code: 'CT1', label: '경로당', keyword: '경로당', weight: 3 },
      { code: 'PM9', label: '약국', keyword: '약국', weight: 2 },
      { code: 'CT1', label: '공원', keyword: '공원', weight: 1 },
    ],
  },
  {
    test: /반려|강아지|고양이|펫/,
    categories: [
      { code: 'HP8', label: '동물병원', keyword: '동물병원', weight: 4 },
      { code: 'CT1', label: '애견카페', keyword: '애견카페', weight: 3 },
      { code: 'CT1', label: '공원', keyword: '공원', weight: 2 },
    ],
  },
];

const DEFAULT_CATEGORIES = [
  { code: 'CT1', label: '공원', keyword: '공원', weight: 2 },
  { code: 'SW8', label: '지하철역', keyword: '지하철역', weight: 2 },
  { code: 'MT1', label: '대형마트', keyword: '대형마트', weight: 1 },
];

function localExtract(query) {
  for (const rule of RULES) {
    if (rule.test.test(query)) {
      return { categories: rule.categories, unmapped: [] };
    }
  }
  return { categories: DEFAULT_CATEGORIES, unmapped: [] };
}

// P-07: 실패 시 최대 2회 재시도
async function withRetry(fn, retries = 2) {
  let lastErr;
  for (let i = 0; i <= retries; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export async function convertQueryToKeywords(query) {
  const backendUrl = import.meta.env.VITE_KEYWORD_API_URL;

  if (backendUrl) {
    const data = await withRetry(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // P-02: 10초 타임아웃
      try {
        const res = await fetch(backendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, taxonomy: TAXONOMY }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('keyword-api-failed');
        const json = await res.json();
        if (!json.categories || json.categories.length === 0) {
          throw new Error('empty-categories');
        }
        return json;
      } finally {
        clearTimeout(timeout);
      }
    });
    return data;
  }

  // 백엔드 미설정 시 로컬 폴백 (네트워크 호출 없음 → 재시도 불필요)
  return localExtract(query);
}
