import BarChart from '../BarChart.jsx';

export default function DetailPanel({ result, reason, reasonLoading, reasonError, onBack }) {
  const sortedBreakdown = [...result.breakdown].sort((a, b) => b.contribution - a.contribution);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="results-header">
        <button type="button" className="back-btn" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <p className="title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{result.dong}</span>
            <span className="rank-pill">{result.rank}위</span>
          </p>
          <p className="subtitle">{result.gu} · {result.score}점</p>
        </div>
      </div>

      <div className="detail-body">
        <div className="detail-section">
          <label className="field-label">선정 이유</label>
          {reasonLoading ? (
            <div className="reason-box loading">선정 이유를 생성하는 중…</div>
          ) : reasonError ? (
            <div className="reason-box">이유를 불러오지 못했어요.</div>
          ) : (
            <div className="reason-box">{reason}</div>
          )}
        </div>

        <div className="detail-section">
          <label className="field-label">키워드별 기여 점수</label>
          <BarChart breakdown={result.breakdown} />
        </div>

        <div className="detail-section">
          <label className="field-label">시설 현황</label>
          <div className="facility-list">
            {sortedBreakdown.map((b) => (
              <div className="facility-row" key={b.keyword}>
                <span className="facility-name">{b.keyword}</span>
                <div className="facility-meta">
                  <span className="facility-count">{b.count}개</span>
                  <span className="facility-score">{b.contribution}점</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
