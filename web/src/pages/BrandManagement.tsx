// BrandManagement — multi-brand configuration with inline editing
import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';

interface EditableBrand {
  id: string;
  name: string;
  website: string;
  tone: string;
  positioning: string[];
  audiences: string[];
  visualDna: string[];
  forbidden: string[];
}

export default function BrandManagement() {
  const bootstrap = useAppStore(s => s.bootstrap);
  const showToast = useAppStore(s => s.showToast);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<EditableBrand | null>(null);

  const brands: EditableBrand[] = (bootstrap?.brands || []).map(b => ({
    id: b.id,
    name: b.name,
    website: b.website,
    tone: b.tone,
    positioning: [...(b.positioning || [])],
    audiences: [...(b.audiences || [])],
    visualDna: [...(b.visualDna || [])],
    forbidden: [...(b.forbidden || [])],
  }));

  const startEdit = (brand: EditableBrand) => {
    setEditingId(brand.id);
    setEditData({ ...brand, positioning: [...brand.positioning], audiences: [...brand.audiences], visualDna: [...brand.visualDna], forbidden: [...brand.forbidden] });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData(null);
  };

  const saveEdit = () => {
    if (!editData) return;
    // Write to localStorage for persistence (demo-compatible)
    const key = `brand-edit-${editData.id}`;
    localStorage.setItem(key, JSON.stringify(editData));
    setEditingId(null);
    setEditData(null);
    showToast('品牌配置已保存到本地', 'success');
  };

  const data = editingId === null ? null : editData;

  return (
    <div style={{ padding: 24, display: 'grid', gap: 16, maxWidth: 800 }}>
      <div className="panel-heading">
        <div>
          <h2>品牌管理</h2>
          <p>多品牌配置与定位管理</p>
        </div>
      </div>

      {brands.map(brand => {
        const isEditing = editingId === brand.id;
        const d = isEditing && data ? data : brand;

        return (
          <div key={brand.id} className="rail-card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontStyle: 'italic' }}>{brand.name}</h3>
            <div className="form-stack">
              <label className="field">
                <span>品牌网站</span>
                <input
                  value={d.website}
                  onChange={isEditing ? e => setEditData({ ...data!, website: e.target.value }) : undefined}
                  readOnly={!isEditing}
                  style={isEditing ? { border: '1px solid var(--blue)' } : undefined}
                />
              </label>
              <label className="field">
                <span>默认语调</span>
                <input
                  value={d.tone}
                  onChange={isEditing ? e => setEditData({ ...data!, tone: e.target.value }) : undefined}
                  readOnly={!isEditing}
                  style={isEditing ? { border: '1px solid var(--blue)' } : undefined}
                />
              </label>
              <div className="field">
                <span>品牌定位</span>
                <div className="chip-group">
                  {d.positioning.map((pos, i) => (
                    <span key={pos} className="select-chip active" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {isEditing ? (
                        <input
                          value={pos}
                          onChange={e => {
                            const next = [...data!.positioning];
                            next[i] = e.target.value;
                            setEditData({ ...data!, positioning: next });
                          }}
                          style={{ border: 'none', background: 'transparent', color: 'inherit', fontSize: 10, width: 'auto', padding: 0, outline: 'none' }}
                        />
                      ) : pos}
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => setEditData({ ...data!, positioning: data!.positioning.filter((_, j) => j !== i) })}
                          style={{ background: 'none', border: 'none', color: '#d9485f', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}
                          title="删除"
                        >×</button>
                      )}
                    </span>
                  ))}
                  {isEditing && (
                    <button
                      className="select-chip"
                      style={{ border: '1px dashed #dce3ed', cursor: 'pointer', background: 'transparent', color: 'var(--blue)', fontSize: 10 }}
                      onClick={() => setEditData({ ...data!, positioning: [...data!.positioning, '新定位'] })}
                    >+ 添加</button>
                  )}
                </div>
              </div>
              <div className="field">
                <span>目标受众</span>
                <div className="chip-group">
                  {d.audiences.map((a, i) => (
                    <span key={a} className="select-chip active" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {isEditing ? (
                        <input
                          value={a}
                          onChange={e => {
                            const next = [...data!.audiences];
                            next[i] = e.target.value;
                            setEditData({ ...data!, audiences: next });
                          }}
                          style={{ border: 'none', background: 'transparent', color: 'inherit', fontSize: 10, width: 'auto', padding: 0, outline: 'none' }}
                        />
                      ) : a}
                      {isEditing && (
                        <button type="button" onClick={() => setEditData({ ...data!, audiences: data!.audiences.filter((_, j) => j !== i) })}
                          style={{ background: 'none', border: 'none', color: '#d9485f', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }} title="删除">×</button>
                      )}
                    </span>
                  ))}
                  {isEditing && (
                    <button className="select-chip" style={{ border: '1px dashed #dce3ed', cursor: 'pointer', background: 'transparent', color: 'var(--blue)', fontSize: 10 }}
                      onClick={() => setEditData({ ...data!, audiences: [...data!.audiences, '新受众'] })}>+ 添加</button>
                  )}
                </div>
              </div>
              <div className="field">
                <span>视觉 DNA</span>
                <div className="chip-group">
                  {d.visualDna.map((dna, i) => (
                    <span key={dna} className="select-chip active" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {isEditing ? (
                        <input
                          value={dna}
                          onChange={e => {
                            const next = [...data!.visualDna];
                            next[i] = e.target.value;
                            setEditData({ ...data!, visualDna: next });
                          }}
                          style={{ border: 'none', background: 'transparent', color: 'inherit', fontSize: 10, width: 'auto', padding: 0, outline: 'none' }}
                        />
                      ) : dna}
                      {isEditing && (
                        <button type="button" onClick={() => setEditData({ ...data!, visualDna: data!.visualDna.filter((_, j) => j !== i) })}
                          style={{ background: 'none', border: 'none', color: '#d9485f', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }} title="删除">×</button>
                      )}
                    </span>
                  ))}
                  {isEditing && (
                    <button className="select-chip" style={{ border: '1px dashed #dce3ed', cursor: 'pointer', background: 'transparent', color: 'var(--blue)', fontSize: 10 }}
                      onClick={() => setEditData({ ...data!, visualDna: [...data!.visualDna, '新DNA'] })}>+ 添加</button>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {isEditing ? (
                  <>
                    <button className="select-chip active" style={{ background: 'var(--green)', color: '#fff', border: 'none', fontSize: 10 }} onClick={saveEdit}>
                      ✓ 保存
                    </button>
                    <button className="select-chip" style={{ border: '1px solid #dce3ed', background: '#fff', fontSize: 10 }} onClick={cancelEdit}>
                      取消
                    </button>
                  </>
                ) : (
                  <button className="btn btn-outline" style={{ width: 'fit-content' }} onClick={() => startEdit(brand)}>
                    ✎ 编辑品牌
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <button className="primary-generate" style={{ width: 'fit-content', padding: '0 24px' }} onClick={() => showToast('新增品牌功能开发中', 'info')}>
        + 新增品牌
      </button>
    </div>
  );
}