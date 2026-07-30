/**
 * POST API 安全诊断 — 通过 Playwright Chrome 网络栈直连 Vercel
 * 仅测试生成类接口 + 发布类参数校验层（不触发真实发布）
 */
import { chromium } from 'playwright';

const BASE = 'https://shemei-skill.vercel.app';

async function testPost(page, label, path, body, timeoutMs = 90_000) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 ${label}`);
  console.log(`   POST ${path}`);
  try {
    const result = await page.evaluate(
      async ({ url, body, timeoutMs }) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: ctrl.signal,
          });
          const ct = resp.headers.get('content-type') || '';
          let text = '';
          if (ct.includes('text/event-stream')) {
            const reader = resp.body?.getReader();
            if (reader) {
              const decoder = new TextDecoder();
              let chunks = 0;
              while (chunks < 6) {
                const { done, value } = await reader.read();
                if (done) break;
                text += decoder.decode(value, { stream: true });
                chunks++;
              }
              reader.cancel();
            }
          } else {
            text = await resp.text();
          }
          return { ok: resp.ok, status: resp.status, statusText: resp.statusText, text, isSSE: ct.includes('text/event-stream') };
        } finally {
          clearTimeout(timer);
        }
      },
      { url: `${BASE}${path}`, body, timeoutMs }
    );

    console.log(`   ⬅ HTTP ${result.status} ${result.statusText}`);

    if (result.isSSE) {
      console.log(`   📡 SSE stream (${result.text.length} chars):`);
      console.log('   ' + result.text.slice(0, 600).replace(/\n/g, '\n   '));
    } else {
      try {
        const j = JSON.parse(result.text);
        console.log('   📦 ' + JSON.stringify(j, null, 2).slice(0, 800).replace(/\n/g, '\n   '));
      } catch {
        console.log('   📄 ' + result.text.slice(0, 500));
      }
    }
    return result;
  } catch (e) {
    console.log(`   ❌ FAILED: ${e.message}`);
    return { ok: false, status: 0, text: e.message };
  }
}

(async () => {
  console.log('🚀 Shemei Skill Vercel POST API 安全诊断');
  console.log(`   Target: ${BASE}`);
  console.log(`   Time: ${new Date().toISOString()}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 预热连接
    console.log('\n🔗 Warming up...');
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    console.log('   Connected OK');

    // ═══════════════════════════════════════════
    // 测试组 1: AI 生成接口（无副作用）
    // ═══════════════════════════════════════════

    // 1a. Creative Brief — 正常请求
    await testPost(
      page,
      '生成文案 — Creative Brief（正常 idea）',
      '/api/generate?action=brief',
      { idea: 'Summer afternoon city ride campaign for iENYRID electric scooter', brandId: 'ienyrid' },
      90_000
    );

    // 1b. Creative Brief — 空 idea（校验层）
    await testPost(
      page,
      '生成文案 — 空 idea（应返回 400）',
      '/api/generate?action=brief',
      { idea: '', brandId: 'ienyrid' }
    );

    // 1c. Creative Brief — 缺少 idea 字段
    await testPost(
      page,
      '生成文案 — 缺少 idea 字段（参数校验）',
      '/api/generate?action=brief',
      { brandId: 'ienyrid' }
    );

    // 1d. SSE 流式内容生成
    await testPost(
      page,
      '生成文案 — SSE 流式内容生成',
      '/api/generate?action=stream',
      {
        brief: {
          campaignTheme: 'Afternoon City Cruise',
          market: { country: 'US', language: 'en' },
          audience: ['Urban commuters'],
          painPoints: ['Last mile anxiety'],
          productBenefits: ['Portable folding', 'Long range'],
          messageAngle: 'Cruise Your City',
          emotionalDirection: ['Confident'],
          tone: ['Energetic', 'Friendly'],
          visualDirection: 'iENYRID scooter on sunny downtown street',
          offer: { label: '', verified: false },
          avoid: [],
        },
        assets: ['facebook', 'instagram', 'x', 'image_prompt'],
      },
      90_000
    );

    // 1e. SSE — 缺少 brief（校验层）
    await testPost(
      page,
      '生成文案 — SSE 缺少 brief（应返回 400）',
      '/api/generate?action=stream',
      {}
    );

    // ═══════════════════════════════════════════
    // 测试组 2: 发布接口 — 仅测参数校验层
    // ═══════════════════════════════════════════

    // 2a. 缺少 text（应返回 400）
    await testPost(
      page,
      '发布社媒 — 空 text（应返回 400）',
      '/api/publish?action=submit',
      { text: '', brand: 'ienyrid' }
    );

    // 2b. 缺少 text 字段
    await testPost(
      page,
      '发布社媒 — 缺少 text 字段（应返回 400）',
      '/api/publish?action=submit',
      { brand: 'ienyrid' }
    );

    // 2c. 缺少 image_url 的 IG 单独发布
    await testPost(
      page,
      '发布社媒 — IG 无 image_url（应返回 400）',
      '/api/publish?action=ig',
      { text: 'test post' }
    );

    // 2d. 非法 action（应返回 400）
    await testPost(
      page,
      '发布社媒 — 非法 action（应返回 400）',
      '/api/publish?action=invalid',
      { text: 'test' }
    );

    // 2e. GET 请求 POST 端点（应返回 405）
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 发布社媒 — GET 请求 POST 端点（应返回 405）`);
    console.log(`   GET /api/publish?action=submit`);
    try {
      const resp = await page.evaluate(async (url) => {
        const r = await fetch(url);
        return { ok: r.ok, status: r.status, text: await r.text() };
      }, `${BASE}/api/publish?action=submit`);
      console.log(`   ⬅ HTTP ${resp.status}`);
      console.log('   📦 ' + JSON.stringify(JSON.parse(resp.text), null, 2).slice(0, 300));
    } catch (e) {
      console.log(`   ❌ ${e.message}`);
    }

    // 2f. generate 端点 GET 请求（应返回 405）
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 生成文案 — GET 请求 POST 端点（应返回 405）`);
    console.log(`   GET /api/generate?action=brief`);
    try {
      const resp = await page.evaluate(async (url) => {
        const r = await fetch(url);
        return { ok: r.ok, status: r.status, text: await r.text() };
      }, `${BASE}/api/generate?action=brief`);
      console.log(`   ⬅ HTTP ${resp.status}`);
      console.log('   📦 ' + JSON.stringify(JSON.parse(resp.text), null, 2).slice(0, 300));
    } catch (e) {
      console.log(`   ❌ ${e.message}`);
    }

  } finally {
    await browser.close();
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ 安全诊断完成。');
  console.log('💡 发布类写操作（FB/IG 真实发布、飞书写回）因涉及生产环境未直接触发，');
  console.log('   仅测试了参数校验层。如需测试完整发布链路，请确认后单独执行。');
})();
