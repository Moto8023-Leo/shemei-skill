/**
 * Vercel Dashboard — 强制无缓存 Redeploy
 * 通过 TT Bridge 接管 Chrome，操作 Vercel 控制台
 */
import { chromium } from 'playwright';

(async () => {
  console.log('🌐 正在通过 TT Bridge 接管浏览器…');

  // Connect to running Chrome via TT Bridge
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19826/cdp');
  console.log('   CDP 连接成功');

  const pages = browser.contexts()[0]?.pages() || [];
  let page = pages.find(p => p.url().includes('vercel.com'));

  if (!page) {
    console.log('   📄 打开 Vercel Deployments…');
    page = await browser.contexts()[0].newPage();
    await page.goto('https://vercel.com/moto8023-leo/shemei-skill/deployments', { waitUntil: 'domcontentloaded', timeout: 15000 });
  } else {
    console.log('   📄 复用已有 Vercel 标签页');
    await page.goto('https://vercel.com/moto8023-leo/shemei-skill/deployments', { waitUntil: 'domcontentloaded', timeout: 15000 });
  }

  await page.waitForTimeout(3000);

  // Find the latest deployment row containing the fix commit
  console.log('\n🔍 查找最新部署记录…');
  const rows = await page.$$('tr[data-testid="deployment-row"], [data-deployment-id], a[href*="/deployments/"]');
  console.log(`   找到 ${rows.length} 个行元素`);

  // Print page title for debugging
  const title = await page.title();
  console.log(`   页面标题: ${title}`);

  // Try clicking the "..." menu on the first deployment row
  console.log('\n🖱️ 尝试点击最新部署的菜单按钮 (⋮)…');

  // Vercel uses a button with aria-label for the menu
  const menuBtn = await page.$('button[aria-label="Open deployment menu"], button[aria-label*="menu"], [data-testid="deployment-menu"]');
  if (menuBtn) {
    await menuBtn.click();
    console.log('   ✅ 菜单已打开');
    await page.waitForTimeout(1000);

    // Look for Redeploy in the dropdown
    const redeployBtn = await page.$('text=Redeploy');
    if (redeployBtn) {
      await redeployBtn.click();
      console.log('   ✅ 已点击 Redeploy');
      await page.waitForTimeout(1500);

      // Uncheck "Use existing build cache"
      const cacheCheckbox = await page.$('input[type="checkbox"], [role="checkbox"]');
      const checkboxes = await page.$$('input[type="checkbox"]');
      for (const cb of checkboxes) {
        const isChecked = await cb.isChecked();
        if (isChecked) {
          console.log('   📦 取消勾选 "Use existing build cache"…');
          await cb.uncheck();
          break;
        }
      }
      await page.waitForTimeout(500);

      // Click Redeploy confirm button
      const confirmBtn = await page.$('button:has-text("Redeploy"):not(:has-text("Cancel"))');
      if (confirmBtn) {
        await confirmBtn.click();
        console.log('   🚀 Redeploy 已确认！');
      }
    } else {
      console.log('   ⚠️ 找不到 Redeploy 菜单项');
    }
  } else {
    console.log('   ⚠️ 找不到菜单按钮，截图调试…');
    await page.screenshot({ path: 'vercel-debug.png' });
    console.log('   截图保存到 vercel-debug.png');
  }

  await page.waitForTimeout(3000);
  const newTitle = await page.title();
  console.log(`\n📊 当前页面: ${newTitle}`);
  console.log('✅ 操作完成。请检查 Vercel 控制台确认部署状态。');

  // Don't close — keep browser open for user to verify
})();
