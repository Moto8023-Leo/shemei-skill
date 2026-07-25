// ParameterPanel — left column form (brand, product, country, campaign, visual, upload)
import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useStudioStore } from '../../store/useStudioStore';
import { useCalendarStore } from '../../store/useCalendarStore';

const TONES = ['热情有力', '专业可信', '轻松友好', '克制高级'];
const CTAS = [
  { value: 'SHOP NOW', label: '立即购买 · SHOP NOW' },
  { value: 'LEARN MORE', label: '了解更多 · LEARN MORE' },
  { value: 'DISCOVER MORE', label: '探索更多 · DISCOVER MORE' },
];
const OVERLAY_TEMPLATES = ['促销', '极简', '卖点'];
const OVERLAY_POSITIONS = ['左侧', '右侧', '底部'];
const SCENES = ['受控随机', '城市通勤', '欧洲街区', '校园周边', '户外探索', '棚拍电商'];

export default function ParameterPanel() {
  const bootstrap = useAppStore(s => s.bootstrap);
  const showToast = useAppStore(s => s.showToast);
  const state = useStudioStore();
  const setCountry = useCalendarStore(s => s.setCountry);
  const fetchEvents = useCalendarStore(s => s.fetchEvents);

  const brand = bootstrap?.brands?.find(b => b.id === state.selectedBrand);
  const products = (bootstrap?.products || []).filter(p => (p.brandId || '').toLowerCase() === (state.selectedBrand || '').toLowerCase());
  const currentCountry = bootstrap?.countries?.find(c => c.code === state.selectedCountry);

  // Update country-dependent fields when country changes
  useEffect(() => {
    if (currentCountry) {
      state.setField('language', currentCountry.language);
      state.setField('currency', currentCountry.currency);
      setCountry(currentCountry.code);
      fetchEvents(currentCountry.code);
    }
  }, [state.selectedCountry]);

  const handleBrandChange = (brandId: string) => {
    state.setField('selectedBrand', brandId);
    const brandProducts = (bootstrap?.products || []).filter(p => (p.brandId || '').toLowerCase() === brandId.toLowerCase());
    if (brandProducts.length > 0) {
      state.setField('selectedProduct', brandProducts[0].model);
    }
  };

  const handleProductImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      showToast('仅支持 PNG、JPG、WebP 图片', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      state.setProductImage(
        reader.result as string,
        file.name,
        `${Math.round(file.size / 1024)} KB`
      );
    };
    reader.readAsDataURL(file);
  };

  const handleLogoImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.setLogoImage(
        reader.result as string,
        file.name,
        `${Math.round(file.size / 1024)} KB`
      );
    };
    reader.readAsDataURL(file);
  };

  return (
    <section className="parameter-panel">
      <div className="panel-heading">
        <div>
          <h2>内容参数</h2>
          <p>选择产品、市场和活动策略</p>
        </div>
        <button className="icon-ghost" type="button" title="重置" onClick={state.resetForm}>↻</button>
      </div>

      <div className="form-stack">
        {/* Brand */}
        <label className="field">
          <span>品牌</span>
          <div className="select-wrap">
            <select value={state.selectedBrand} onChange={e => handleBrandChange(e.target.value)}>
              {(bootstrap?.brands || []).map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <i>⌄</i>
          </div>
        </label>

        {/* Product */}
        <label className="field">
          <span>产品型号</span>
          <div className="select-wrap">
            <select value={state.selectedProduct} onChange={e => state.setField('selectedProduct', e.target.value)}>
              {products.map(p => (
                <option key={p.id || p.model} value={p.model}>{p.model}</option>
              ))}
            </select>
            <i>⌄</i>
          </div>
        </label>

        {/* Country */}
        <label className="field">
          <span>国家 / 市场</span>
          <div className="select-wrap">
            <select value={state.selectedCountry} onChange={e => state.setField('selectedCountry', e.target.value)}>
              {(bootstrap?.countries || []).map(c => (
                <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
              ))}
            </select>
            <i>⌄</i>
          </div>
        </label>

        {/* Language + Currency */}
        <div className="two-col">
          <label className="field">
            <span>内容语言</span>
            <div className="select-wrap">
              <select value={state.language} onChange={e => state.setField('language', e.target.value)}>
                <option>English</option>
                <option>Deutsch</option>
                <option>Français</option>
                <option>Español</option>
                <option>Italiano</option>
                <option>Nederlands</option>
              </select>
              <i>⌄</i>
            </div>
          </label>
          <label className="field">
            <span>货币</span>
            <div className="select-wrap">
              <select value={state.currency} onChange={e => state.setField('currency', e.target.value)}>
                <option>EUR</option>
                <option>GBP</option>
                <option>USD</option>
              </select>
              <i>⌄</i>
            </div>
          </label>
        </div>

        {/* Campaign Mode */}
        <label className="field">
          <span>活动匹配</span>
          <div className="select-wrap">
            <select value={state.campaignMode} onChange={e => state.setField('campaignMode', e.target.value)}>
              <option value="auto">自动匹配当前活动</option>
              <option value="manual">手动指定活动</option>
              <option value="evergreen">常规内容（不使用活动）</option>
            </select>
            <i>⌄</i>
          </div>
        </label>
        {state.campaignMode === 'manual' && (
          <label className="field">
            <span>手动活动名称</span>
            <input value={state.manualCampaign} onChange={e => state.setField('manualCampaign', e.target.value)} placeholder="例如：返校季、夏季促销" />
          </label>
        )}

        {/* Discount + Code */}
        <div className="two-col">
          <label className="field">
            <span>优惠力度</span>
            <input value={state.discount} onChange={e => state.setField('discount', e.target.value)} placeholder="10% OFF" />
          </label>
          <label className="field">
            <span>优惠码</span>
            <input value={state.discountCode} onChange={e => state.setField('discountCode', e.target.value)} placeholder="OFF40" />
          </label>
        </div>

        {/* CTA */}
        <label className="field">
          <span>行动号召 CTA</span>
          <div className="select-wrap">
            <select value={state.cta} onChange={e => state.setField('cta', e.target.value)}>
              {CTAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <i>⌄</i>
          </div>
        </label>

        {/* Tone */}
        <label className="field">
          <span>文案语气</span>
          <div className="select-wrap">
            <select value={state.tone} onChange={e => state.setField('tone', e.target.value)}>
              {TONES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <i>⌄</i>
          </div>
        </label>

        {/* Visual DNA */}
        <div className="field">
          <span>视觉风格 DNA</span>
          <div className="chip-group">
            {['城市通勤', '性能机械', '明亮科技', '高级极简', '户外探索'].map(tag => (
              <button
                key={tag}
                className={`select-chip${state.visualDna.includes(tag) ? ' active' : ''}`}
                type="button"
                onClick={() => state.toggleVisualDna(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Scene */}
        <label className="field">
          <span>场景偏好</span>
          <div className="select-wrap">
            <select value={state.scenePreference} onChange={e => state.setField('scenePreference', e.target.value)}>
              {SCENES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <i>⌄</i>
          </div>
        </label>

        {/* Overlay Template + Position */}
        <div className="two-col">
          <label className="field">
            <span>叠字模板</span>
            <div className="select-wrap">
              <select value={state.overlayTemplate} onChange={e => state.setField('overlayTemplate', e.target.value)}>
                {OVERLAY_TEMPLATES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <i>⌄</i>
            </div>
          </label>
          <label className="field">
            <span>文字位置</span>
            <div className="select-wrap">
              <select value={state.overlayPosition} onChange={e => state.setField('overlayPosition', e.target.value)}>
                {OVERLAY_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <i>⌄</i>
            </div>
          </label>
        </div>

        {/* Platforms */}
        <div className="field">
          <span>发布平台</span>
          <div className="platform-switches">
            {(['facebook', 'instagram', 'x'] as const).map(p => (
              <button
                key={p}
                className={state.platforms.includes(p) ? 'active' : ''}
                type="button"
                onClick={() => state.togglePlatform(p)}
              >
                {p === 'facebook' ? 'Facebook' : p === 'instagram' ? 'Instagram' : 'X'}
              </button>
            ))}
          </div>
        </div>

        {/* Product Image Upload */}
        <div className="upload-block">
          <div className="field-label-row">
            <label>产品参考图</label>
            {state.productImage && (
              <button className="icon-ghost" type="button" onClick={() => state.clearImage('product')}>×</button>
            )}
          </div>
          <label className={`upload-zone${state.productImage ? ' has-file' : ''}`}>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleProductImage} />
            <span className="upload-icon">▧</span>
            <div>
              <strong>{state.productImageName}</strong>
              <span>{state.productImageSize}</span>
            </div>
          </label>
        </div>

        {/* Logo Upload */}
        <div className="upload-block">
          <div className="field-label-row">
            <label>品牌 Logo（可选）</label>
            {state.logoImage && (
              <button className="icon-ghost" type="button" onClick={() => state.clearImage('logo')}>×</button>
            )}
          </div>
          <label className={`upload-zone${state.logoImage ? ' has-file' : ''}`}>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoImage} />
            <span className="upload-icon">▧</span>
            <div>
              <strong>{state.logoImageName}</strong>
              <span>{state.logoImageSize}</span>
            </div>
          </label>
        </div>

        {/* Extra Requirements */}
        <label className="field">
          <span>补充要求（选填）</span>
          <textarea
            rows={3}
            placeholder="例如：突出续航与折叠便携，避免夜景和雨天"
            value={state.extraRequirements}
            onChange={e => state.setField('extraRequirements', e.target.value)}
          />
        </label>

        {/* Market Note */}
        {currentCountry && (
          <div className="market-note">
            <span>{currentCountry.flag}</span>
            <div>
              <strong>{currentCountry.name}本地化已启用</strong>
              <small>自动处理语言、货币、CTA 和活动语境</small>
            </div>
          </div>
        )}
      </div>

      <button className="primary-generate" type="button" onClick={state.generate} disabled={state.generating}>
        {state.generating ? '◌ 正在生成...' : '✦ 生成完整内容'}
      </button>
    </section>
  );
}
