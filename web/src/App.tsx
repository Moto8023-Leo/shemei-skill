import { useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import CommandBar from './components/layout/CommandBar';
import StatusBar from './components/layout/StatusBar';
import Toast from './components/common/Toast';
import BootScreen from './components/common/BootScreen';
import Workbench from './pages/Workbench';
import ContentTasks from './pages/ContentTasks';
import Calendar from './pages/Calendar';
import Products from './pages/Products';
import BrandManagement from './pages/BrandManagement';
import VisualDNA from './pages/VisualDNA';
import PublishRecords from './pages/PublishRecords';
import Analytics from './pages/Analytics';
import Automation from './pages/Automation';
import Settings from './pages/Settings';
import 'tdesign-react/es/style/index.css';
import './App.css';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/': { title: '内容创作工作台', subtitle: '智能生成社媒文案和图片，自动匹配节日活动，提升营销效果' },
  '/tasks': { title: '内容任务', subtitle: '查看和管理已生成的内容任务' },
  '/calendar': { title: '日历与活动', subtitle: '2026 营销日历与欧洲各国节日' },
  '/products': { title: '产品库', subtitle: '产品型号管理与规格编辑' },
  '/brand': { title: '品牌管理', subtitle: '多品牌配置与定位' },
  '/visual-dna': { title: '视觉风格 DNA', subtitle: 'AI 生图视觉维度参数池管理' },
  '/publish-records': { title: '发布记录', subtitle: '社媒发布历史与状态追踪' },
  '/analytics': { title: '数据分析', subtitle: '内容表现概览' },
  '/automation': { title: '自动化配置', subtitle: '定时任务与自动发布设置' },
  '/settings': { title: '系统设置', subtitle: 'API 密钥与系统参数配置' },
};

function AppLayout() {
  const location = useLocation();
  const init = useAppStore(s => s.init);
  const booted = useAppStore(s => s.booted);
  const bootError = useAppStore(s => s.bootError);
  const online = useAppStore(s => s.online);
  const setOnline = useAppStore(s => s.setOnline);
  const bootstrap = useAppStore(s => s.bootstrap);

  useEffect(() => { init(); }, [init]);

  // Health monitor — skip in demo mode or before boot completes
  useEffect(() => {
    if (!booted || bootstrap?.mode === 'demo') return;
    const check = async () => {
      try {
        await fetch('/api/brands', { signal: AbortSignal.timeout(5000) });
        setOnline(true);
      } catch { setOnline(false); }
    };
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, [setOnline, booted, bootstrap?.mode]);

  if (!booted) {
    // 侧边栏和顶栏立即渲染（不阻塞在 /api/bootstrap），内容区显示加载动画
    return (
      <div className="app-shell">
        <Sidebar currentPath="/" />
        <div className="app-main">
          <Topbar title="社媒智能工作台" subtitle="正在连接…" online={online} mode="demo" />
          <BootScreen error={bootError} />
        </div>
        <Toast />
      </div>
    );
  }

  const currentPath = '/' + (location.pathname.split('/')[1] || '');
  const meta = pageTitles[currentPath] || pageTitles['/'];
  const mode = bootstrap?.mode || 'demo';

  return (
    <div className="app-shell">
      <Sidebar currentPath={currentPath} />
      <div className="app-main">
        <Topbar title={meta.title} subtitle={meta.subtitle} online={online} mode={mode} />
        <CommandBar mode={mode} currentPath={currentPath} />
        <Routes>
          <Route path="/" element={<Workbench />} />
          <Route path="/tasks" element={<ContentTasks />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/products" element={<Products />} />
          <Route path="/brand" element={<BrandManagement />} />
          <Route path="/visual-dna" element={<VisualDNA />} />
          <Route path="/publish-records" element={<PublishRecords />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/automation" element={<Automation />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
        <StatusBar />
      </div>
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppLayout />
    </HashRouter>
  );
}
