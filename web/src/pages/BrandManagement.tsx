// BrandManagement — multi-brand configuration
import { useAppStore } from '../store/useAppStore';

export default function BrandManagement() {
  const bootstrap = useAppStore(s => s.bootstrap);
  const showToast = useAppStore(s => s.showToast);

  return (
    <div style={{ padding: 24, display: 'grid', gap: 16, maxWidth: 800 }}>
      <div className="panel-heading">
        <div>
          <h2>品牌管理</h2>
          <p>多品牌配置与定位管理</p>
        </div>
      </div>

      {(bootstrap?.brands || []).map(brand => (
        <div key={brand.id} className="rail-card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 18, fontStyle: 'italic' }}>{brand.name}</h3>
          <div className="form-stack">
            <label className="field"><span>品牌网站</span><input value={brand.website} readOnly /></label>
            <label className="field"><span>默认语调</span><input value={brand.tone} readOnly /></label>
            <div className="field">
              <span>品牌定位</span>
              <div className="chip-group">
                {brand.positioning.map(pos => <span key={pos} className="select-chip active">{pos}</span>)}
              </div>
            </div>
            <div className="field">
              <span>目标受众</span>
              <div className="chip-group">
                {brand.audiences.map(a => <span key={a} className="select-chip active">{a}</span>)}
              </div>
            </div>
            <div className="field">
              <span>视觉 DNA</span>
              <div className="chip-group">
                {brand.visualDna.map(d => <span key={d} className="select-chip active">{d}</span>)}
              </div>
            </div>
            <button className="btn btn-outline" style={{ width: 'fit-content' }} onClick={() => showToast('品牌编辑功能开发中', 'info')}>
              ✎ 编辑品牌
            </button>
          </div>
        </div>
      ))}

      <button className="primary-generate" style={{ width: 'fit-content', padding: '0 24px' }} onClick={() => showToast('新增品牌功能开发中', 'info')}>
        + 新增品牌
      </button>
    </div>
  );
}
