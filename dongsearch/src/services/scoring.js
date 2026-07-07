import * as turf from '@turf/turf';

// R-02: Σ(키워드 가중치 × 동 내 시설 수)
// dongMap: facilityService.collectFacilitiesByDong() 의 반환값
export function aggregateScores(dongMap, categories) {
  const rows = Object.entries(dongMap).map(([dong, info]) => {
    const breakdown = categories.map((c) => {
      const count = info.counts[c.label] || 0;
      return { keyword: c.label, weight: c.weight, count, contribution: c.weight * count };
    });
    const score = breakdown.reduce((s, b) => s + b.contribution, 0);
    const topKeywords = [...breakdown]
      .filter((b) => b.count > 0)
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3)
      .map((b) => b.keyword);

    // 표시(히트맵)용 근사 중심좌표: 해당 동에서 검색된 시설 좌표 평균
    const points = info.points || [];
    const centroid = points.length
      ? {
          lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
          lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
        }
      : null;

    return { dong, gu: info.gu, score, breakdown, topKeywords, centroid, points };
  });

  return rows
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

// R-02 "경계 보정(버퍼 방식)" — 스펙 그대로 구현.
// 실제 동 폴리곤 GeoJSON(예: turf Feature<Polygon|MultiPolygon>)을 확보하면 이 함수로 교체해
// dongMap 대신 폴리곤 기준 정확한 버퍼 카운팅을 사용할 수 있습니다.
//
// polygon: turf Feature (해당 동의 원본 경계)
// points: [{ lat, lng, category }] — 검색된 전체 시설 좌표(모든 구 포함)
// bufferKm: 기본 0.5km (도보 6~7분)
export function scoreDongWithBuffer(polygon, points, categories, bufferKm = 0.5) {
  const buffered = turf.buffer(polygon, bufferKm, { units: 'kilometers' });

  const inside = points.filter((p) =>
    turf.booleanPointInPolygon(turf.point([p.lng, p.lat]), buffered)
  );

  const breakdown = categories.map((c) => {
    const count = inside.filter((p) => p.category === c.label).length;
    return { keyword: c.label, weight: c.weight, count, contribution: c.weight * count };
  });

  const score = breakdown.reduce((s, b) => s + b.contribution, 0);
  return { score, breakdown };
}
