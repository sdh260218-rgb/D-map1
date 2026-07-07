import { useEffect, useState } from 'react';
import { REGIONS, CITY_LIST, MAX_GU } from '../../data/regions.js';

const PRESET_QUERIES = {
  육아: '유치원, 초등학교, 소아과가 가까운 육아 친화 환경',
  노년: '공원, 요양병원, 경로당이 가까운 노인 생활 편의 지역',
  반려동물: '동물병원, 애견카페, 공원이 많은 반려동물 친화 지역',
};

export default function SearchPanel({
  city,
  districts,
  query,
  onCityChange,
  onDistrictsChange,
  onQueryChange,
  onSearch,
  loading,
  guError,
  queryError,
  onToast,
}) {
  const [guPanelOpen, setGuPanelOpen] = useState(false);
  const [activePreset, setActivePreset] = useState(null);

  useEffect(() => {
    if (city && districts.length === 0) setGuPanelOpen(true);
  }, [city]); // eslint-disable-line react-hooks/exhaustive-deps

  const guList = REGIONS[city] || [];

  function handleCityChange(e) {
    const value = e.target.value;
    onCityChange(value);
    onDistrictsChange([]); // 예외: 시 변경 시 선택된 구 초기화
    setGuPanelOpen(!!value);
  }

  function toggleGu(d) {
    if (districts.includes(d)) {
      onDistrictsChange(districts.filter((x) => x !== d));
      return;
    }
    if (districts.length >= MAX_GU) {
      onToast?.(`최대 ${MAX_GU}개까지 선택 가능합니다.`); // M-02 유효성 2
      return;
    }
    onDistrictsChange([...districts, d]);
  }

  function handlePreset(key) {
    setActivePreset(key);
    onQueryChange(PRESET_QUERIES[key]);
  }

  return (
    <div className="sidebar-body-wrap" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="sidebar-header">
        <div className="icon-box">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <div>
          <p className="title">지역 검색</p>
          <p className="subtitle">조건에 맞는 동네를 찾아드려요</p>
        </div>
      </div>

      <div className="sidebar-body">
        {/* M-02: 시/도 */}
        <div>
          <label className="field-label">시 / 도</label>
          <div className="select-wrap">
            <select className="city-select" value={city} onChange={handleCityChange} disabled={loading}>
              <option value="">시 / 도 선택</option>
              {CITY_LIST.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <svg className="chevron" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </div>

        {/* M-02: 구 / 군 멀티 선택 */}
        {city && guPanelOpen && (
          <div>
            <div className="gu-header">
              <label className="field-label" style={{ marginBottom: 0 }}>구 / 군</label>
              <span className={`gu-count${districts.length >= MAX_GU ? ' maxed' : ''}`}>
                {districts.length}/{MAX_GU}
              </span>
            </div>
            <div className={`gu-grid-wrap${guError ? ' error' : ''}`}>
              <div className="gu-grid">
                {guList.map((d) => {
                  const selected = districts.includes(d);
                  const disabled = !selected && districts.length >= MAX_GU;
                  return (
                    <button
                      type="button"
                      key={d}
                      className={`gu-item${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}`}
                      onClick={() => toggleGu(d)}
                      disabled={loading}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
            {guError && (
              <div className="field-error">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                구를 1개 이상 선택해주세요.
              </div>
            )}
            {districts.length > 0 && (
              <button type="button" className="confirm-btn" onClick={() => setGuPanelOpen(false)}>
                지도에 표시 →
              </button>
            )}
          </div>
        )}

        {/* 선택된 구 칩 */}
        {city && !guPanelOpen && districts.length > 0 && (
          <div>
            <label className="field-label">선택된 구역</label>
            <div className="selected-chip-row">
              {districts.map((d) => (
                <span className="selected-chip" key={d}>
                  {d}
                  <button type="button" onClick={() => toggleGu(d)} aria-label={`${d} 삭제`}>
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </span>
              ))}
              {districts.length < MAX_GU && (
                <button type="button" className="add-chip-btn" onClick={() => setGuPanelOpen(true)}>
                  + 추가
                </button>
              )}
            </div>
          </div>
        )}

        {/* M-03: 자연어 조건 입력 */}
        <div>
          <label className="field-label">조건 입력</label>
          <div className="chip-row">
            {Object.keys(PRESET_QUERIES).map((key) => (
              <button
                type="button"
                key={key}
                className={`chip${activePreset === key ? ' active' : ''}`}
                onClick={() => handlePreset(key)}
              >
                {key}
              </button>
            ))}
          </div>

          <div className="textarea-wrap">
            <textarea
              className="query-input"
              maxLength={200}
              placeholder="예) 요양병원이 많고 초등학교가 가까운 곳"
              value={query}
              disabled={loading}
              onChange={(e) => {
                setActivePreset(null);
                onQueryChange(e.target.value);
              }}
            />
            <span className="char-count">{query.length}/200</span>
          </div>
          {queryError && (
            <div className="field-error">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              검색 조건을 입력해주세요.
            </div>
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        <button className="search-btn" onClick={onSearch} disabled={loading}>
          {loading ? (
            <span className="spinner small" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          )}
          {loading ? '검색 중…' : '검색하기'}
        </button>
      </div>
    </div>
  );
}
