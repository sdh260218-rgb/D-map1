const BAR_COLORS = ['#1B4FD8', '#3B6FE0', '#5B8FE8', '#8FB0EE', '#C7D9F8', '#DCE6FB'];

function niceMax(v) {
  if (v <= 0) return 4;
  const step = Math.max(2, Math.ceil(v / 4 / 2) * 2);
  return step * 4;
}

export default function BarChart({ breakdown }) {
  const sorted = [...breakdown].sort((a, b) => b.contribution - a.contribution);
  const chartMax = niceMax(Math.max(...sorted.map((b) => b.contribution), 0));
  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round(chartMax - (chartMax / tickCount) * i)
  );

  return (
    <div className="bar-chart">
      <div className="y-axis">
        {ticks.map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
      <div className="bars">
        {sorted.map((b, i) => (
          <div className="bar-col" key={b.keyword} title={`${b.keyword}: ${b.contribution}점 (${b.count}개)`}>
            <div
              className="bar"
              style={{
                height: `${Math.max((b.contribution / chartMax) * 100, 2)}%`,
                background: BAR_COLORS[i % BAR_COLORS.length],
              }}
            />
            <div className="bar-label">{b.keyword}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
