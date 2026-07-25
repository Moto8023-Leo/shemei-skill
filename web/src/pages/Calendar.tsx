// Calendar — 2026 marketing calendar view
import { useEffect, useState } from 'react';
import { useCalendarStore } from '../store/useCalendarStore';
import { useAppStore } from '../store/useAppStore';

export default function Calendar() {
  const bootstrap = useAppStore(s => s.bootstrap);
  const { events, selectedCountry, loading, fetchEvents } = useCalendarStore();
  const [country, setCountry] = useState(selectedCountry);

  useEffect(() => { fetchEvents(country); }, [country]);

  return (
    <div className="parameter-panel" style={{ padding: 24, maxWidth: '100%' }}>
      <div className="panel-heading">
        <div>
          <h2>日历与活动</h2>
          <p>2026 营销节点与欧洲各国法定节日</p>
        </div>
      </div>

      <div style={{ marginBottom: 16 }} className="field">
        <span>选择国家</span>
        <div className="select-wrap" style={{ maxWidth: 260 }}>
          <select value={country} onChange={e => setCountry(e.target.value)}>
            {(bootstrap?.countries || []).map(c => (
              <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.nameEn})</option>
            ))}
          </select>
          <i>⌄</i>
        </div>
      </div>

      {loading ? (
        <div className="empty-workspace"><div className="generation-orbit">▣</div><p>加载日历...</p></div>
      ) : events.length === 0 ? (
        <div className="empty-workspace">
          <div className="empty-illustration">▣</div>
          <p>当前没有活动匹配</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {events.map(e => (
            <div key={e.id} className="event-card">
              <div className="event-card-top">
                <strong>{e.name}</strong>
                <span style={{ padding: '4px 8px', borderRadius: 999, fontSize: 9, background: e.phase === '预热' ? '#edf4ff' : e.phase === '最后机会' ? '#fff0ee' : '#e7f8f0', color: e.phase === '预热' ? '#246bfd' : e.phase === '最后机会' ? '#b42318' : '#0a8b5a' }}>
                  {e.phase}
                </span>
              </div>
              <small>{e.startDate} 至 {e.endDate} · {e.type}</small>
              <p>{e.recommendation}</p>
              {e.daysUntil > 0 && <b>距离活动开始还有 {e.daysUntil} 天</b>}
            </div>
          ))}
        </div>
      )}

      <p style={{ color: '#8b94a2', fontSize: 9, marginTop: 16 }}>
        {bootstrap?.calendarDisclaimer || '2026 节日数据用于营销规划参考；西班牙、德国、比利时等国家存在地区差异，发布前请按目标地区复核。'}
      </p>
    </div>
  );
}
