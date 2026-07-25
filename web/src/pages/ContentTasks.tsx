// ContentTasks — generated content history
import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

interface HistoryEntry {
  taskId: string; brandId: string; productId: string;
  title: string; facebookText: string; styleSummary: string;
  createdAt: string; mode?: string;
}

export default function ContentTasks() {
  const showToast = useAppStore(s => s.showToast);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/history?limit=50')
      .then(r => r.json())
      .then(data => setEntries(data.entries || []))
      .catch(() => showToast('历史加载失败', 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-workspace"><div className="generation-orbit">✦</div><h2>加载中...</h2></div>;

  return (
    <div className="parameter-panel" style={{ padding: 24, maxWidth: '100%' }}>
      <div className="panel-heading">
        <div><h2>内容任务</h2><p>已生成内容的历史记录</p></div>
      </div>
      {entries.length === 0 ? (
        <div className="empty-workspace">
          <div className="empty-illustration">▤</div>
          <p>暂无生成记录，请先在工作台生成内容</p>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
              <th style={{ padding: 8 }}>任务 ID</th>
              <th style={{ padding: 8 }}>标题</th>
              <th style={{ padding: 8 }}>品牌</th>
              <th style={{ padding: 8 }}>创建时间</th>
              <th style={{ padding: 8 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.taskId} style={{ borderBottom: '1px solid #edf0f4' }}>
                <td style={{ padding: 8, fontFamily: 'monospace', fontSize: 10 }}>{e.taskId}</td>
                <td style={{ padding: 8 }}>{e.title}</td>
                <td style={{ padding: 8 }}>{e.brandId}</td>
                <td style={{ padding: 8, color: '#8b93a3' }}>{new Date(e.createdAt).toLocaleString('zh-CN')}</td>
                <td style={{ padding: 8 }}>
                  <button className="select-chip" onClick={() => { navigator.clipboard.writeText(e.facebookText); showToast('已复制', 'success'); }}>复制文案</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
