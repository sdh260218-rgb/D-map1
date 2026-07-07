export default function ResultsPanel({ results, categories, onBack, onSelect, selectedDong, compareDiff }) {
  const maxScore = Math.max(...results.map((r) => r.score), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="results-header">
        <button type="button" className="back-btn" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <p className="title">검색 결과</p>
          <p className="subtitle">{results.length}개 동 순위 반환</p>
        </div>
      </div>

      <div className="keyword-summary">
        {categories.map((c) => (
          <span className="keyword-chip" key={c.label}>{c.label} ×{c.weight}</span>
        ))}
      </div>

      <div className="results-list">
        {results.length === 0 ? (
          // P-05 빈 결과
          <div className="empty-state">조건에 맞는 지역을 찾지 못했어요. 조건을 바꿔보세요.</div>
        ) : (
          results.map((r) => {
            const ratio = r.score / maxScore;
            const diff = compareDiff && compareDiff.dong === r.dong ? compareDiff.value : null;
            return (
              <div
                key={r.dong}
                className={`result-item${selectedDong === r.dong ? ' active' : ''}`}
                onClick={() => onSelect(r)}
              >
                <div className={`rank-badge${r.rank <= 3 ? ' top' : ''}`}>{r.rank}</div>
                <div className="result-content">
                  <div className="result-top-row">
                    <span className="dong-name">{r.dong}</span>
                    <span>
                      <span className="score">{r.score}점</span>
                      {diff !== null && (
                        <span className={`diff-badge ${diff >= 0 ? 'up' : 'down'}`}>
                          {diff >= 0 ? `+${diff}` : diff}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="gu-name">{r.gu}</div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.max(ratio * 100, 4)}%` }} />
                  </div>
                  <div className="keyword-pills">
                    {r.topKeywords.length === 0 ? (
                      <span>해당 없음</span>
                    ) : (
                      r.topKeywords.map((k) => <span key={k}>{k}</span>)
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
