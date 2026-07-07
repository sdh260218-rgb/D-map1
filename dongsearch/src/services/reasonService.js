// D-02 선정 이유 문장 생성
// 실제 서비스에서는 동 점수·시설 데이터를 OpenAI API에 전달하는 백엔드(VITE_REASON_API_URL)를 호출합니다.
// 백엔드가 없으면 로컬 템플릿으로 폴백합니다.

const cache = new Map(); // D-02 최적화: 동일 동 재클릭 시 캐싱된 문장 재사용

function localReason(dong, breakdownSorted) {
  const top = breakdownSorted.filter((b) => b.count > 0).slice(0, 2);
  if (top.length === 0) {
    return `${dong}은(는) 선택하신 조건에 해당하는 시설이 많지 않아요.`;
  }
  const parts = top.map((b) => `${b.keyword} ${b.count}곳`).join(', ');
  return `${dong}은(는) ${parts}이 밀집해 있어 조건에 부합하는 생활 인프라가 우수합니다. 주요 시설이 도보권 내에 위치해 있어 일상 편의성이 높습니다.`;
}

export async function generateReason(dong, breakdownSorted) {
  if (cache.has(dong)) return cache.get(dong);

  const backendUrl = import.meta.env.VITE_REASON_API_URL;
  if (backendUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // P-02
      const res = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dong, breakdown: breakdownSorted }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
      if (!res.ok) throw new Error('reason-api-failed');
      const data = await res.json();
      const text = data.reason || localReason(dong, breakdownSorted);
      cache.set(dong, text);
      return text;
    } catch (e) {
      // 예외: 생성 실패 → 점수 데이터만 표시 + 안내 (호출부에서 처리)
      throw e;
    }
  }

  const text = localReason(dong, breakdownSorted);
  cache.set(dong, text);
  return text;
}
