// VisualDNA — visual style parameter pool management
import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

export default function VisualDNA() {
  const showToast = useAppStore(s => s.showToast);
  const [pools, setPools] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/visual/style-pool?language=zh')
      .then(r => r.json())
      .then(data => setPools(data.pools || {}))
      .catch(() => showToast('加载视觉池失败', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const labels: Record<string, string> = {
    scenes: '场景', times: '时段', weather: '天气', angles: '角度',
    people: '人物', placements: '位置', whitespace: '留白', lighting: '灯光',
  };

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div className="panel-heading">
        <div>
          <h2>视觉风格 DNA</h2>
          <p>AI 生图视觉维度参数池管理（中英文双语）</p>
        </div>
      </div>

      {loading ? (
        <div className="empty-workspace"><div className="generation-orbit">◇</div><p>加载中...</p></div>
      ) : (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
          {Object.entries(pools).map(([key, values]) => (
            <div key={key} className="rail-card" style={{ padding: 14 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--blue)' }}>{labels[key] || key}</h4>
              <div className="chip-group">
                {values.map((v: string) => (
                  <span key={v} className="select-chip" style={{ cursor: 'default' }}>{v}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="primary-generate" style={{ width: 'fit-content', padding: '0 24px', marginTop: 16 }} onClick={() => showToast('编辑功能开发中', 'info')}>
        ✎ 编辑参数池
      </button>
    </div>
  );
}
