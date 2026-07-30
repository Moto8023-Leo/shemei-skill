// lib/feishu.ts
import axios from 'axios';

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const SPREADSHEET_TOKEN = process.env.FEISHU_SPREADSHEET_TOKEN;

let tenantToken: string | null = null;
let tokenExpireTime = 0;

/**
 * 获取飞书 tenant_access_token
 */
async function getTenantToken(): Promise<string> {
  if (tenantToken && Date.now() < tokenExpireTime) {
    return tenantToken;
  }

  if (!APP_ID || !APP_SECRET) {
    throw new Error('缺少飞书 APP_ID 或 APP_SECRET');
  }

  const res = await axios.post(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    {
      app_id: APP_ID,
      app_secret: APP_SECRET,
    }
  );

  if (res.data.code !== 0) {
    throw new Error(`飞书 Token 获取失败: ${res.data.msg}`);
  }

  tenantToken = res.data.tenant_access_token;
  tokenExpireTime = Date.now() + (res.data.expire * 1000 - 60000); // 提前1分钟过期

  return tenantToken!;
}

/**
 * 追加一行数据到飞书电子表格
 */
export async function postToFeishu(record: {
  topic: string;
  platform: string;
  title: string;
  content: string;
  status: string;
  fbResult?: any;
  igResult?: any;
  xResult?: any;
  imageUrl?: string;
}) {
  if (!SPREADSHEET_TOKEN) {
    console.warn('未配置 FEISHU_SPREADSHEET_TOKEN，跳过飞书记录');
    return;
  }

  try {
    const token = await getTenantToken();

    const now = new Date().toLocaleString('zh-CN');

    // 追加一行数据（根据你的表格列调整顺序）
    const values = [
      now,                          // 时间戳
      record.topic,
      record.platform,
      record.title,
      record.content.substring(0, 500), // 避免超长
      record.fbResult?.url || '',
      record.igResult?.url || '',
      record.xResult?.postUrl || '',
      record.status,
      record.fbResult?.error || record.igResult?.error || record.xResult?.error || ''
    ];

    const response = await axios.post(
      `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${SPREADSHEET_TOKEN}/values_append`,
      {
        valueRange: {
          range: "Sheet1!A:Z",   // 根据你的工作表名称修改
          values: [values]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      }
    );

    console.log('✅ 飞书记录成功');
    return response.data;
  } catch (error: any) {
    console.error('飞书记录失败:', error.response?.data || error.message);
    // 不抛出错误，避免影响主流程
  }
}