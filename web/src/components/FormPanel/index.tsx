import { useFormStore } from '../../store/useFormStore';
import type { ProductModel } from '../../store/useFormStore';
import BrandSelector from '../BrandSelector';
import ImageUpload from '../ImageUpload';
import './FormPanel.css';

const PAIN_POINTS = ['续航焦虑', '爬坡无力', '刹车不安全', '减震差', '太重不便携', '无痛点'];
const AD_TYPES = ['单品推广', '品牌推广', '促销推广', '新品推广'];
const SCENES = ['城市通勤', '户外探险', '校园代步', '雨天出行', '夜间', '展示棚拍'];
const DISCOUNTS = ['无活动', '夏季促销', '黑五', '新品上市', '限时优惠', '年终大促'];
const PROMOTIONS = ['无促销', '5%折扣', '8%折扣', '10%折扣', '15%折扣', '包邮'];
const CTAS = ['立即购买', '了解更多', '限时抢购', '立即升级', '查看详情'];
const TONES = ['亲和有趣', '专业自信', '激情澎湃', '简洁直接'];

export default function FormPanel() {
  const state = useFormStore();

  const currentModel = state.models.find(m => m.name === state.selectedModel);

  return (
    <div className="form-panel">
      <BrandSelector />
      <h2>Ad Parameters</h2>

      <div className="form-group">
        <label>Product Model</label>
        <select className="form-select" value={state.selectedModel}
          onChange={e => state.setField('selectedModel', e.target.value)}>
          {state.models.map(m => (
            <option key={m.name} value={m.name}>{m.name} ({m.brand})</option>
          ))}
        </select>
      </div>

      {currentModel && (
        <div className="model-specs">
          <span>{currentModel.motor}</span>
          <span>{currentModel.range}</span>
          <span>{currentModel.speed}</span>
          <span>{currentModel.price}</span>
          {currentModel.has_image && <span className="has-img">📸</span>}
        </div>
      )}

      <ImageUpload />

      <div className="form-group">
        <label>Pain Point</label>
        <select className="form-select" value={state.painPoint}
          onChange={e => state.setField('painPoint', e.target.value)}>
          {PAIN_POINTS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Ad Type</label>
        <select className="form-select" value={state.adType}
          onChange={e => state.setField('adType', e.target.value)}>
          {AD_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Scene Style</label>
        <select className="form-select" value={state.sceneStyle}
          onChange={e => state.setField('sceneStyle', e.target.value)}>
          {SCENES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Discount</label>
        <select className="form-select" value={state.discount}
          onChange={e => state.setField('discount', e.target.value)}>
          {DISCOUNTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Promotion</label>
        <select className="form-select" value={state.promotion}
          onChange={e => state.setField('promotion', e.target.value)}>
          {PROMOTIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>💲 Discount Code</label>
        <input
          type="text"
          className="form-select"
          placeholder="e.g. SUMMER10, SAVE20..."
          value={state.discountCode}
          onChange={e => state.setField('discountCode', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>CTA</label>
        <select className="form-select" value={state.cta}
          onChange={e => state.setField('cta', e.target.value)}>
          {CTAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Tone</label>
        <select className="form-select" value={state.tone}
          onChange={e => state.setField('tone', e.target.value)}>
          {TONES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <button className="btn btn-primary btn-block"
        onClick={state.generate}
        disabled={state.generating}>
        {state.generating ? 'Generating...' : '🤖 Generate Content'}
      </button>
    </div>
  );
}
