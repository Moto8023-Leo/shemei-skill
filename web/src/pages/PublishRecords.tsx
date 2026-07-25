// PublishRecords — publishing history and status tracking
import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

interface PublishRecord {
  record_id: string;
  title: string;
  platform: string;
  status: string;
  url: string;
  model: string;
  schedule_time: number;
  brand: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  FB: 'Facebook', IG: 'Instagram', X: 'X',
  fb: 'Facebook', ig: 'Instagram', x: 'X',
};

function formatPlatform(raw: string): string[] {
  if (!raw) return ['—'];
  return raw.replace(/\+/g, ' ').split(/[,\s]+/).filter(Boolean).map(p => PLATFORM_LABELS[p] || p);
}

function formatTime(ms: number): string {
  if (!ms || ms <= 0) return '—';
  try {
    return new Date(ms).toLocaleString('zh-CN');
  } catch {
    return String(ms);
  }
}

export default function PublishRecords() {
  const showToast = useAppStore(s => s.showToast);
  const [records, setRecords] = useState<PublishRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/publish-records?limit=100')
      .then(r => r.json())
      .then(data => setRecords(data.records || []))
      .catch(() => showToast('发布记录加载失败', 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="parameter-panel" style={{ padding: 24, maxWidth: '100%' }}>
        <div className="empty-workspace">
          <div className="generation-orbit">◉</div>
          <h2>加载中...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="parameter-panel" style={{ padding: 24, maxWidth: '100%' }}>
      <div className="panel-heading">
        <div>
          <h2>发布记录</h2>
          <p>社媒发布历史与状态追踪</p>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="empty-workspace">
          <div className="empty-illustration">◉</div>
          <h2>暂无发布记录</h2>
          <p>发布记录从飞书排期表中读取。请先在工作台生成并发布内容。</p>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginTop: 16 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
              <th style={{ padding: 8 }}>标题</th>
              <th style={{ padding: 8 }}>型号</th>
              <th style={{ padding: 8 }}>平台</th>
              <th style={{ padding: 8 }}>状态</th>
              <th style={{ padding: 8 }}>结果</th>
              <th style={{ padding: 8 }}>发布时间</th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => {
              const platforms = formatPlatform(r.platform);
              return (
                <tr key={r.record_id} style={{ borderBottom: '1px solid #edf0f4' }}>
                  <td style={{ padding: 8, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.title || '—'}
                  </td>
                  <td style={{ padding: 8 }}>{r.model || '—'}</td>
                  <td style={{ padding: 8 }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {platforms.map(p => (
                        <span
                          key={p}
                          style={{
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 9,
                            background: p === 'Facebook' ? '#edf4ff' : p === 'Instagram' ? '#fff0f7' : '#f5f5f5',
                            color: p === 'Facebook' ? '#246bfd' : p === 'Instagram' ? '#e1306c' : '#333',
                          }}
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: 8 }}>
                    <span className={`publish-status${r.status === '已发布' ? ' success' : r.status === '失败' ? ' failed' : ' manual'}`}>
                      {r.status || '待发布'}
                    </span>
                  </td>
                  <td style={{ padding: 8, fontSize: 9, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.url ? (
                      <a href={r.url.startsWith('http') ? r.url : '#'} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }}>
                        {r.url.length > 60 ? r.url.slice(0, 60) + '…' : r.url}
                      </a>
                    ) : '—'}
                  </td>
                  <td style={{ padding: 8, color: '#8b93a3', fontSize: 10, whiteSpace: 'nowrap' }}>
                    {formatTime(r.schedule_time)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p style={{ color: '#8b94a2', fontSize: 9, marginTop: 16 }}>
        共 {records.length} 条记录 · 数据来源：飞书排期表
      </p>
    </div>
  );
}
