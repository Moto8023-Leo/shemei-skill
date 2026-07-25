// Automation — scheduled tasks and auto-publish settings
import { useAppStore } from '../store/useAppStore';

export default function Automation() {
  const showToast = useAppStore(s => s.showToast);

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <div className="panel-heading">
        <div>
          <h2>自动化配置</h2>
          <p>定时任务与自动发布设置</p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div className="rail-card" style={{ padding: 20 }}>
          <h4 style={{ margin: '0 0 12px' }}>每日自动生成</h4>
          <div className="form-stack">
            <div className="field"><span>自动任务</span>
              <div className="select-wrap" style={{ maxWidth: 200 }}>
                <select defaultValue="off"><option value="on">开启</option><option value="off">关闭</option></select>
                <i>⌄</i>
              </div>
            </div>
            <div className="field"><span>每日生成时间（UTC+8）</span><input type="number" defaultValue={12} min={0} max={23} /></div>
          </div>
          <button className="select-chip active" style={{ marginTop: 12 }} onClick={() => showToast('已保存', 'success')}>保存设置</button>
        </div>

        <div className="rail-card" style={{ padding: 20 }}>
          <h4 style={{ margin: '0 0 12px' }}>每日自动发布</h4>
          <div className="form-stack">
            <div className="field"><span>发布时间（UTC+8）</span><input type="number" defaultValue={23} min={0} max={23} /></div>
            <div className="field"><span>发布间隔（分钟）</span><input type="number" defaultValue={35} min={5} max={120} /></div>
          </div>
          <button className="select-chip active" style={{ marginTop: 12 }} onClick={() => showToast('已保存', 'success')}>保存设置</button>
        </div>

        <div className="rail-card" style={{ padding: 20 }}>
          <h4 style={{ margin: '0 0 12px' }}>当前守护进程状态</h4>
          <p className="muted" style={{ margin: 0 }}>守护进程（daemon.py）负责内容工厂、图片监控和发布引擎三个循环。在 Windows 上可通过任务计划程序或手动运行。</p>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <span className="publish-status" style={{ fontSize: 10 }}>python scripts/daemon.py</span>
          </div>
        </div>
      </div>
    </div>
  );
}
