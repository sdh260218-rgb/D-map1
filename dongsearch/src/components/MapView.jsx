import { useEffect, useRef, useState } from 'react';
import { CITY_HALL_CENTER } from '../data/regions.js';

const CATEGORY_COLORS = ['#1B4FD8', '#059669', '#D97706', '#DB2777', '#7C3AED', '#0891B2'];

function scoreColor(ratio) {
  // 연두(#A7F3D0) → 진초록(#059669), 점수 높을수록 진하게
  const palette = ['#A7F3D0', '#6EE7B7', '#34D399', '#10B981', '#059669'];
  const idx = Math.min(palette.length - 1, Math.floor(ratio * palette.length));
  return palette[idx];
}

export default function MapView({
  sdkReady,
  sdkError,
  phase, // 'search' | 'results' | 'detail'
  districts,
  onDistrictCentersResolved,
  results, // R-03용: 점수 산출된 동 목록 (centroid 포함)
  selectedResult, // D-01: 상세 화면에서 선택된 동
  onLocate,
  onMapErrorRetry,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]); // circles / custom overlays 정리용
  const markersRef = useRef([]); // 핀 마커 정리용
  const clustererRef = useRef(null);
  const [localMapError, setLocalMapError] = useState(false);
  const [locating, setLocating] = useState(false);

  // 지도 최초 생성 + 현재 위치 요청 (M-01)
  useEffect(() => {
    if (!sdkReady || !containerRef.current || mapRef.current) return;

    try {
      const kakao = window.kakao.maps;
      const map = new kakao.Map(containerRef.current, {
        center: new kakao.LatLng(CITY_HALL_CENTER.lat, CITY_HALL_CENTER.lng),
        level: 8,
      });
      mapRef.current = map;

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            map.setCenter(new kakao.LatLng(latitude, longitude));
            map.setLevel(6); // 대략 줌 레벨 13(웹 표준)에 대응하는 Kakao 레벨
          },
          () => {
            // 예외 1: 위치 권한 거부 → 서울시청 중심 (이미 기본값)
          },
          { timeout: 8000 }
        );
      }
      // 예외 2: Geolocation 미지원 브라우저 → 서울시청 중심 + 콘솔 경고
      if (!navigator.geolocation) {
        // eslint-disable-next-line no-console
        console.warn('이 브라우저는 Geolocation을 지원하지 않습니다. 서울시청 중심으로 표시합니다.');
      }
    } catch (e) {
      setLocalMapError(true);
    }
  }, [sdkReady]);

  // 구 선택 시: 각 구를 지오코딩해 지도가 선택 구 전체를 보이도록 fit (M-02)
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps?.services) return;
    if (districts.length === 0) return;

    const kakao = window.kakao.maps;
    const geocoder = new kakao.services.Geocoder();
    let cancelled = false;
    const centers = [];

    Promise.all(
      districts.map(
        (gu) =>
          new Promise((resolve) => {
            geocoder.addressSearch(gu, (result, status) => {
              if (status === kakao.services.Status.OK && result[0]) {
                resolve({ gu, lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) });
              } else {
                resolve(null);
              }
            });
          })
      )
    ).then((resolved) => {
      if (cancelled) return;
      const valid = resolved.filter(Boolean);
      if (valid.length === 0) return;
      const bounds = new kakao.LatLngBounds();
      valid.forEach((c) => {
        // 구 하나의 대략적 범위를 시뮬레이션하기 위해 중심점 주변으로 bounds 확장
        bounds.extend(new kakao.LatLng(c.lat + 0.02, c.lng + 0.02));
        bounds.extend(new kakao.LatLng(c.lat - 0.02, c.lng - 0.02));
      });
      mapRef.current.setBounds(bounds);
      onDistrictCentersResolved?.(valid);
    });

    return () => {
      cancelled = true;
    };
  }, [districts]); // eslint-disable-line react-hooks/exhaustive-deps

  // R-03 히트맵(근사): 결과 화면일 때 동별 원형 오버레이 표시
  useEffect(() => {
    if (!mapRef.current) return;
    const kakao = window.kakao.maps;

    // 이전 오버레이 정리
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    if (phase !== 'results' || !results || results.length === 0) return;

    const maxScore = Math.max(...results.map((r) => r.score), 1);

    results.forEach((r) => {
      if (!r.centroid) return; // 검색된 시설이 없어 좌표를 알 수 없는 동은 표시 생략 (R-03 예외에 대응)
      const ratio = r.score / maxScore;
      const circle = new kakao.Circle({
        center: new kakao.LatLng(r.centroid.lat, r.centroid.lng),
        radius: 350,
        strokeWeight: 1,
        strokeColor: '#059669',
        strokeOpacity: 0.4,
        fillColor: scoreColor(ratio),
        fillOpacity: 0.55,
      });
      circle.setMap(mapRef.current);

      const overlayContent = document.createElement('div');
      overlayContent.style.cssText =
        'background:#111318;color:#fff;font-size:11px;padding:3px 8px;border-radius:6px;white-space:nowrap;transform:translateY(-140%);pointer-events:none;';
      overlayContent.textContent = `${r.dong} · ${r.score}점`;
      const label = new kakao.CustomOverlay({
        position: new kakao.LatLng(r.centroid.lat, r.centroid.lng),
        content: overlayContent,
        yAnchor: 1,
      });

      kakao.event.addListener(circle, 'mouseover', () => label.setMap(mapRef.current));
      kakao.event.addListener(circle, 'mouseout', () => label.setMap(null));

      overlaysRef.current.push(circle, label);
    });
  }, [phase, results]);

  // D-01: 상세 화면 - 선택 동의 시설 핀 마커 (클러스터링)
  useEffect(() => {
    if (!mapRef.current) return;
    const kakao = window.kakao.maps;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (clustererRef.current) {
      clustererRef.current.clear();
    }

    if (phase !== 'detail' || !selectedResult) return;

    const categories = [...new Set((selectedResult.points || []).map((p) => p.category))];
    const colorFor = (cat) => CATEGORY_COLORS[categories.indexOf(cat) % CATEGORY_COLORS.length];

    const infowindow = new kakao.InfoWindow({ removable: true });
    const markers = (selectedResult.points || []).map((p) => {
      const marker = new kakao.Marker({
        position: new kakao.LatLng(p.lat, p.lng),
      });
      kakao.event.addListener(marker, 'click', () => {
        infowindow.setContent(
          `<div style="padding:6px 10px;font-size:12px;">
            <strong>${p.place_name || p.category}</strong><br/>
            <span style="color:${colorFor(p.category)};">${p.category}</span>
          </div>`
        );
        infowindow.open(mapRef.current, marker);
      });
      return marker;
    });

    markersRef.current = markers;

    if (kakao.MarkerClusterer && markers.length > 0) {
      clustererRef.current =
        clustererRef.current ||
        new kakao.MarkerClusterer({ map: mapRef.current, averageCenter: true, minLevel: 5 });
      clustererRef.current.clear();
      clustererRef.current.addMarkers(markers);
    } else {
      markers.forEach((m) => m.setMap(mapRef.current));
    }

    if (selectedResult.centroid) {
      mapRef.current.setCenter(new kakao.LatLng(selectedResult.centroid.lat, selectedResult.centroid.lng));
      mapRef.current.setLevel(5);
    }
  }, [phase, selectedResult]);

  function handleLocate() {
    if (!mapRef.current) return;
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const kakao = window.kakao.maps;
        mapRef.current.setCenter(new kakao.LatLng(pos.coords.latitude, pos.coords.longitude));
        mapRef.current.setLevel(6);
        setLocating(false);
        onLocate?.();
      },
      () => setLocating(false)
    );
  }

  const showError = sdkError || localMapError;

  return (
    <main className="map-area">
      {!showError && <div className="map-canvas" ref={containerRef} />}

      {showError && (
        <div className="map-error">
          <div className="map-error-inner">
            <svg className="alert" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p>지도를 불러오지 못했어요.<br />새로고침 해주세요.</p>
            <button
              className="refresh-link"
              onClick={() => {
                setLocalMapError(false);
                onMapErrorRetry?.();
                window.location.reload();
              }}
            >
              새로고침
            </button>
          </div>
        </div>
      )}

      {phase === 'results' && results && results.length > 0 && (
        <div className="score-legend">
          <p className="score-legend-title">점수 범례</p>
          <div className="score-legend-swatches">
            <div className="swatch-col"><div className="swatch" style={{ background: '#A7F3D0' }} /><span>낮음</span></div>
            <div className="swatch-col"><div className="swatch" style={{ background: '#6EE7B7' }} /><span>&nbsp;</span></div>
            <div className="swatch-col"><div className="swatch" style={{ background: '#34D399' }} /><span>&nbsp;</span></div>
            <div className="swatch-col"><div className="swatch" style={{ background: '#10B981' }} /><span>&nbsp;</span></div>
            <div className="swatch-col"><div className="swatch" style={{ background: '#059669' }} /><span>높음</span></div>
          </div>
        </div>
      )}

      {!showError && (
        <button className="locate-btn" title="현재 위치" onClick={handleLocate} disabled={locating}>
          {locating ? (
            <span className="spinner small" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
          )}
        </button>
      )}
    </main>
  );
}
