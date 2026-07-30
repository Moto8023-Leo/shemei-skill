// lib/playwright-x.ts
import { chromium, Browser, Page } from 'playwright';

export interface XPostResult {
  success: boolean;
  postUrl?: string;
  error?: string;
}

/**
 * X（Twitter）浏览器自动化发布
 * 推荐在本地开发环境运行（已登录浏览器更稳定）
 */
export class XPoster {
  private username: string;

  constructor() {
    this.username = process.env.X_USERNAME || '';
  }

  /**
   * 使用已登录的浏览器上下文发布（最推荐）
   */
  async postWithExistingLogin(
    content: string,
    imagePath?: string
  ): Promise<XPostResult> {
    let browser: Browser | null = null;

    try {
      // 启动浏览器（headless: false 方便调试）
      browser = await chromium.launch({ headless: false });
      const context = await browser.newContext({
        // 加载已登录的用户数据（重要！）
        userDataDir: './.playwright-userdata', // 首次运行会要求手动登录一次
      });

      const page = await context.newPage();
      
      await page.goto('https://x.com', { waitUntil: 'networkidle' });

      // 检查是否已登录
      const isLoggedIn = await page.locator('textarea[data-testid="tweetTextarea_0"]').isVisible().catch(() => false);

      if (!isLoggedIn) {
        console.log('请在打开的浏览器窗口中手动登录 X，然后关闭窗口重新运行');
        await new Promise(r => setTimeout(r, 30000)); // 等待30秒手动登录
      }

      // 点击发帖按钮
      await page.click('div[data-testid="tweetButtonInline"]');
      await page.waitForTimeout(1000);

      // 输入内容
      const textarea = page.locator('div[data-testid="tweetTextarea_0"] div[contenteditable="true"]');
      await textarea.fill(content);

      // 上传图片（如果有）
      if (imagePath) {
        const fileInput = page.locator('input[type="file"]').first();
        await fileInput.setInputFiles(imagePath);
        await page.waitForTimeout(3000); // 等待上传
      }

      // 点击发布
      await page.click('button[data-testid="tweetButton"]');
      await page.waitForTimeout(4000);

      // 获取最新推文链接（简化处理）
      const postUrl = `https://x.com/${this.username}/status/xxx`; // 实际可通过页面提取

      console.log('✅ X 发布成功');
      return { success: true, postUrl };

    } catch (error: any) {
      console.error('X 发布失败:', error);
      return { success: false, error: error.message };
    } finally {
      if (browser) await browser.close();
    }
  }

  /**
   * 简单版：直接用账号密码登录（安全性较低，不推荐长期使用）
   */
  async postWithCredentials(
    content: string,
    password: string,   // 仅本地测试时使用
    imagePath?: string
  ): Promise<XPostResult> {
    // ... 类似上面逻辑，但增加登录步骤
    // 此方法风险较高，建议优先使用 postWithExistingLogin
    console.log('⚠️  建议使用 postWithExistingLogin 方法');
    return { success: false, error: '请优先使用已登录的浏览器上下文' };
  }
}

// 导出单例方便使用
export const xPoster = new XPoster();

/**
 * 便捷发布函数
 */
export async function postToX(content: string, imagePath?: string) {
  return xPoster.postWithExistingLogin(content, imagePath);
}