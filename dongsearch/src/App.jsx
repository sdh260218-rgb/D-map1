import { useCallback, useRef, useState } from 'react';
import { useKakaoLoader } from './hooks/useKakaoLoader.js';
import { convertQueryToKeywords } from './services/keywordService.js';
import { collectFacilitiesByDong } from './services/facilityService.js';
import { aggregateScores } from './services/scoring.js';
import { generateReason } from './services/reasonService.js';

import SearchPanel from './components/Sidebar/SearchPanel.jsx';
import ResultsPanel from './components/Sidebar/ResultsPanel.jsx';
import DetailPanel from './components/Sidebar/DetailPanel.jsx';
import MapView from './components/MapView.jsx';
import Toast from './components/Toast.jsx';

const ERROR_MESSAGE = '일시적인 오류가 발생했습니다. 다시 시도해주세요.'; // P-02

export default function App() {
  const { ready: sdkReady, error: sdkError } = useKakaoLoader();

  const [city, setCity] = useState('');
  const [districts, setDistricts] = useState([]);
  const [query, setQuery] = useState('');

  const [guError, setGuError] = useState(false);
  const [queryError, setQueryError] = useState(false);

  const [phase, setPhase] = useState('search'); // search | results | detail
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const [categories, setCategories] = useState([]);
  const [results, setResults] = useState([]);

  const [selectedResult, setSelectedResult] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonLoading, setReasonLoading] = useState(false);
  const [reasonError, setReasonError] = useState(false);

  const [toast, setToast] = useState({ show: false, message: '' });
  const toastTimer = useRef(null);
  const historyRef = useRef([]); // D-04: 최근 클릭한 동 방문 기록
  const [compareDiff, setCompareDiff] = useState(null);

  const showToast = useCallback((message) => {
    setToast({ show: true, message });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ show: false, message: '' }), 3000); // P-02: 3초
  }, []);

  async function handleSearch() {
    // M-02 유효성 1
    if (districts.length === 0) {
      setGuError(true);
      return;
    }
    setGuError(false);

    // M-03 유효성 1
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setQueryError(true);
      return;
    }
    setQueryError(false);

    setLoading(true); // P-01
    setLoadingMessage('조건을 분석하는 중…');

    try {
      // M-04: 자연어 → 카테고리/키워드/가중치 변환
      const converted = await convertQueryToKeywords(trimmed);
      if (!converted.categories || converted.categories.length === 0) {
        showToast('조건을 이해하지 못했어요. 다시 입력해주세요.');
        setLoading(false);
        return;
      }
      if (converted.unmapped && converted.unmapped.length > 0) {
        showToast('이 조건은 일부 반영하지 못했어요.');
      }
      setCategories(converted.categories);

      // R-01: 실시설 검색 + 동 단위 집계
      const dongMap = await collectFacilitiesByDong({
        city,
        districts,
        categories: converted.categories,
        onProgress: setLoadingMessage,
      });

      // R-02: 동별 점수 산출
      const scored = aggregateScores(dongMap, converted.categories).filter((r) => r.score > 0);

      setResults(scored); // 0건이면 ResultsPanel이 P-05 안내를 표시
      historyRef.current = [];
      setCompareDiff(null);
      setPhase('results');
    } catch (e) {
      showToast(ERROR_MESSAGE); // P-02, 직전 상태 유지
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectResult(result) {
    // D-04: 방문 기록 갱신 및 점수 차이 계산
    historyRef.current = [...historyRef.current, result].slice(-2);
    if (historyRef.current.length === 2) {
      const [prev, curr] = historyRef.current;
      setCompareDiff({ dong: curr.dong, value: curr.score - prev.score });
    }

    setSelectedResult(result);
    setPhase('detail');
    setReason('');
    setReasonError(false);
    setReasonLoading(true);

    try {
      const sorted = [...result.breakdown].sort((a, b) => b.contribution - a.contribution);
      const text = await generateReason(result.dong, sorted);
      setReason(text);
    } catch (e) {
      setReasonError(true); // D-02 예외: 생성 실패 → 점수 데이터만 표시 + 안내
    } finally {
      setReasonLoading(false);
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        {phase === 'search' && (
          <>
            <SearchPanel
              city={city}
              districts={districts}
              query={query}
              onCityChange={setCity}
              onDistrictsChange={setDistricts}
              onQueryChange={setQuery}
              onSearch={handleSearch}
              loading={loading}
              guError={guError}
              queryError={queryError}
              onToast={showToast}
            />
            {loading && (
              <div className="loading-inline">
                <span className="spinner small" />
                {loadingMessage}
              </div>
            )}
          </>
        )}

        {phase === 'results' && (
          <ResultsPanel
            results={results}
            categories={categories}
            onBack={() => setPhase('search')}
            onSelect={handleSelectResult}
            selectedDong={selectedResult?.dong}
            compareDiff={compareDiff}
          />
        )}

        {phase === 'detail' && selectedResult && (
          <DetailPanel
            result={selectedResult}
            reason={reason}
            reasonLoading={reasonLoading}
            reasonError={reasonError}
            onBack={() => setPhase('results')}
          />
        )}
      </aside>

      <MapView
        sdkReady={sdkReady}
        sdkError={sdkError}
        phase={phase}
        districts={districts}
        results={results}
        selectedResult={phase === 'detail' ? selectedResult : null}
      />

      <Toast message={toast.message} show={toast.show} />
    </div>
  );
}
