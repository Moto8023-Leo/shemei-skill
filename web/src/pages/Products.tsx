// Products — product model management
import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useStudioStore } from '../store/useStudioStore';
import type { ProductRef } from '../store/useAppStore';

export default function Products() {
  const bootstrap = useAppStore(s => s.bootstrap);
  const showToast = useAppStore(s => s.showToast);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [brand, setBrand] = useState('ienyrid');

  useEffect(() => {
    if (bootstrap?.products) {
      setProducts(bootstrap.products.filter(p => (p.brandId || '').toLowerCase() === brand.toLowerCase()));
    }
  }, [brand, bootstrap]);

  const handleUpload = async (model: string, file: File) => {
    const formData = new FormData();
    formData.append('brand', brand);
    formData.append('model', model);
    formData.append('file', file);
    try {
      const resp = await fetch('/api/upload-image', { method: 'POST', body: formData });
      const data = await resp.json();
      showToast(data.success ? '图片上传成功' : `上传失败: ${data.error}`, data.success ? 'success' : 'error');
    } catch {
      showToast('上传失败', 'error');
    }
  };

  return (
    <div className="parameter-panel" style={{ padding: 24, maxWidth: '100%' }}>
      <div className="panel-heading">
        <div><h2>产品库</h2><p>产品型号管理与规格查看</p></div>
      </div>

      <div style={{ marginBottom: 16, maxWidth: 260 }} className="field">
        <span>品牌</span>
        <div className="select-wrap">
          <select value={brand} onChange={e => setBrand(e.target.value)}>
            {(bootstrap?.brands || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <i>⌄</i>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
            <th style={{ padding: 8 }}>型号</th>
            <th style={{ padding: 8 }}>电机</th>
            <th style={{ padding: 8 }}>电池</th>
            <th style={{ padding: 8 }}>续航</th>
            <th style={{ padding: 8 }}>速度</th>
            <th style={{ padding: 8 }}>价格</th>
            <th style={{ padding: 8 }}>图片</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id || p.model} style={{ borderBottom: '1px solid #edf0f4' }}>
              <td style={{ padding: 8, fontWeight: 600 }}>{p.model}</td>
              <td style={{ padding: 8 }}>{p.motor}</td>
              <td style={{ padding: 8 }}>{p.battery}</td>
              <td style={{ padding: 8 }}>{p.range}</td>
              <td style={{ padding: 8 }}>{p.topSpeed}</td>
              <td style={{ padding: 8 }}>{p.price}{p.currency || 'EUR'}</td>
              <td style={{ padding: 8 }}>
                {p.hasImage ? '📸' : (
                  <label style={{ cursor: 'pointer', color: 'var(--blue)', fontSize: 9 }}>
                    上传
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(p.model, f); }} />
                  </label>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
