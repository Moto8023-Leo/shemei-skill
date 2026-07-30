import { chromium } from 'playwright';

console.log('🚀 正在启动自动化网络探针，准备诊断 Vercel 线上环境...');

(async () => {
    // 启动无头浏览器
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    let hasErrors = false;

    // 核心：拦截并分析所有后端 API 请求
    page.on('response', async (response) => {
        const request = response.request();
        const resourceType = request.resourceType();
        
        // 过滤掉图片、CSS 等静态资源，只抓取 fetch/xhr 接口请求
        if (resourceType === 'fetch' || resourceType === 'xhr') {
            const url = response.url();
            const status = response.status();
            
            console.log(`\n📡 [拦截到接口响应] ${url}`);
            console.log(`   ➤ 状态码: ${status}`);
            
            // 抓取异常报错
            if (status >= 400) {
                hasErrors = true;
                try {
                    const body = await response.text();
                    console.log(`   ❌ 错误详情: ${body.substring(0, 500)}`);
                } catch (error) {
                    console.log('   ❌ 无法解析错误响应体');
                }
            } else {
                console.log('   ✅ 接口请求成功');
            }
        }
    });

    try {
        console.log('\n🌐 正在访问 Vercel 线上环境: https://shemei-skill.vercel.app/');
        await page.goto('https://shemei-skill.vercel.app/', { waitUntil: 'networkidle' });

        console.log('\n👀 正在扫描页面，尝试自动触发 API 交互...');
        const buttons = await page.$$('button');
        let clicked = false;

        // 寻找带有特征文字的按钮并模拟点击
        for (const btn of buttons) {
            const text = await btn.textContent();
            if (text && (text.includes('生成') || text.includes('发布') || text.includes('发帖') || text.includes('提交'))) {
                console.log(`🖱️ 发现目标按钮 [${text.trim()}]，正在模拟真实用户点击...`);
                await btn.click();
                clicked = true;
                break; // 点击一次主流程按钮即可
            }
        }

        if (!clicked) {
            console.log('⚠️ 未找到明显的触发按钮，探针将只收集页面加载时的初始 API 请求。');
        }

        console.log('⏳ 正在等待接口返回数据 (10秒)...');
        await page.waitForTimeout(10000);

    } catch (error) {
        console.error('\n❌ 自动化测试遇到异常:', error.message);
    } finally {
        await browser.close();
        console.log('\n=============================================');
        if (hasErrors) {
            console.log('🚨 诊断结束：已捕获到 API 异常，请将上面的 ❌ 错误详情发给主治 AI。');
        } else {
            console.log('🟢 诊断结束：未捕获到接口报错，网络通讯似乎正常。');
        }
        console.log('=============================================');
    }
})();