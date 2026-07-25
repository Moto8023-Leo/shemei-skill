// Sidebar — navigation + brand lockup + operator card
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';

const SIDEBAR_ICONS: Record<string, React.JSX.Element> = {
  workbench: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  tasks: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  ),
  calendar: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  products: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><line x1="12" y1="22" x2="12" y2="12" /><line x1="3" y1="7" x2="12" y2="12" /><line x1="21" y1="7" x2="12" y2="12" />
    </svg>
  ),
  brand: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /><path d="M2 12h20" />
    </svg>
  ),
  visualDna: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
    </svg>
  ),
  publish: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  analytics: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  automation: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" />
    </svg>
  ),
};

const NAV_ITEMS: { path: string; iconKey: string; label: string }[] = [
  { path: '/', iconKey: 'workbench', label: '工作台' },
  { path: '/tasks', iconKey: 'tasks', label: '内容任务' },
  { path: '/calendar', iconKey: 'calendar', label: '日历与活动' },
  { path: '/products', iconKey: 'products', label: '产品库' },
  { path: '/brand', iconKey: 'brand', label: '品牌管理' },
  { path: '/visual-dna', iconKey: 'visualDna', label: '视觉风格 DNA' },
  { path: '/publish-records', iconKey: 'publish', label: '发布记录' },
  { path: '/analytics', iconKey: 'analytics', label: '数据分析' },
  { path: '/automation', iconKey: 'automation', label: '自动化配置' },
  { path: '/settings', iconKey: 'settings', label: '系统设置' },
];

export default function Sidebar({ currentPath }: { currentPath: string }) {
  const navigate = useNavigate();
  const bootstrap = useAppStore(s => s.bootstrap);
  const brand = bootstrap?.brands?.[0];
  const mode = bootstrap?.mode || 'demo';

  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <div className="brand-wordmark">{brand?.name || 'iENYRID'}</div>
        <div className="brand-subline">
          <span>社媒智能工作台</span>
          <b>v3.0</b>
        </div>
      </div>
      <nav className="side-nav" aria-label="主导航">
        {NAV_ITEMS.map(item => (
          <button
            key={item.path}
            className={`side-nav-item${currentPath === item.path ? ' active' : ''}`}
            type="button"
            onClick={() => navigate(item.path)}
          >
            <i>{SIDEBAR_ICONS[item.iconKey]}</i>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="brand-switcher">
          <span>当前品牌</span>
          <strong>{brand?.name || 'iENYRID'}</strong>
        </div>
        <div className="operator-card">
          <div className="avatar">管</div>
          <div>
            <strong>管理员</strong>
            <span>{mode === 'live' ? '正式模式' : '演示模式'}</span>
          </div>
        </div>
        <small>© 2026 iENYRID<br />All rights reserved.</small>
      </div>
    </aside>
  );
}
