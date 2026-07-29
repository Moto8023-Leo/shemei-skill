// VisualDNA — visual style parameter pool management
import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

interface PoolItem {
  key: string;
  label: string;
  description: string;
}

export default function VisualDNA() {
  const showToast = useAppStore(s => s.showToast);
  const [pools, setPools] = useState<PoolItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/visual/style-pool?language=zh')
      .then(r => r.json())
      .then(data => {
        const items = data.pools || [];
        setPools(Array.isArray(items) ? items : []);
      })
      .catch(() => showToast('加载视觉池失败', 'error'))
      .finally(() => setLoading(false));
  }, []);

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
      ) : pools.length === 0 ? (
        <div className="empty-workspace">
          <div className="empty-illustration">◇</div>
          <p>暂无视觉风格数据</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
          {pools.map((item) => (
            <div key={item.key} className="rail-card" style={{ padding: 14 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--blue)' }}>{item.label}</h4>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{item.description || '暂无描述'}</p>
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
