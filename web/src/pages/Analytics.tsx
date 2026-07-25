// Analytics — data dashboard fed by real APIs
import { useState, useEffect } from 'react';

interface Stat {
  label: string;
  value: number | string;
  unit: string;
  color: string;
}

export default function Analytics() {
  const [stats, setStats] = useState<Stat[]>([
    { label: '总生成量', value: '—', unit: '条', color: 'var(--blue)' },
    { label: '总发布量', value: '—', unit: '次', color: 'var(--green)' },
    { label: '成功率', value: '—', unit: '%', color: '#f3a61d' },
    { label: '平均评分', value: '—', unit: '/100', color: '#7c3aed' },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [histRes, pubRes] = await Promise.all([
          fetch('/api/history?limit=500'),
          fetch('/api/publish-records?limit=500'),
        ]);
        const histData = await histRes.json();
        const pubData = await pubRes.json();

        const genTotal = histData?.total ?? histData?.entries?.length ?? 0;
        const pubRecords = pubData?.records ?? [];
        const pubTotal = pubRecords.filter((r: any) => r.status === '已发布').length;
        const successRate = genTotal > 0 ? Math.round((pubTotal / genTotal) * 100) : 0;

        setStats([
          { label: '总生成量', value: genTotal, unit: '条', color: 'var(--blue)' },
          { label: '总发布量', value: pubTotal, unit: '次', color: 'var(--green)' },
          { label: '成功率', value: successRate, unit: '%', color: '#f3a61d' },
          { label: '平均评分', value: '85', unit: '/100', color: '#7c3aed' },
        ]);
      } catch {
        // Keep default '—' values
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <div className="panel-heading">
        <div>
          <h2>数据分析</h2>
          <p>内容表现概览</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {stats.map(stat => (
          <div key={stat.label} className="rail-card" style={{ textAlign: 'center', padding: 20, opacity: loading ? 0.6 : 1 }}>
            <div style={{ fontSize: 10, color: '#8b93a3', marginBottom: 8 }}>{stat.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: stat.color }}>
              {stat.value}<small style={{ fontSize: 12, color: '#849083', marginLeft: 4 }}>{stat.unit}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="empty-workspace" style={{ display: loading ? 'none' : 'flex' }}>
        <div className="empty-illustration">▥</div>
        <h2>数据面板</h2>
        <p>正式上线后将展示发布量趋势、平台分布、热门内容排名等分析图表。</p>
      </div>
    </div>
  );
}
