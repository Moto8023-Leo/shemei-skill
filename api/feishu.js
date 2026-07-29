export default async function handler(req, res) {
    // 1. 从 Vercel 环境变量读取密钥（确保安全，不暴露在代码中）
    const APP_ID = process.env.FEISHU_APP_ID;
    const APP_SECRET = process.env.FEISHU_APP_SECRET;
    
    // 2. 您的飞书多维表格参数
    const APP_TOKEN = 'QFrowVpL3iIMAYkCE2PcaZCEnJe'; 
    const TABLE_ID = 'tblTZTeXWry93slq';

    try {
        // 3. 第一步：向飞书服务器申请访问令牌 (Tenant Access Token)
        const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ 
                app_id: APP_ID, 
                app_secret: APP_SECRET 
            })
        });
        
        const tokenData = await tokenRes.json();
        
        // 检查 Token 是否获取成功
        if (tokenData.code !== 0) {
            throw new Error(`Token获取失败: ${tokenData.msg}`);
        }
        
        // 4. 第二步：携带令牌，去读取多维表格的具体数据
        const recordsRes = await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${tokenData.tenant_access_token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const recordsData = await recordsRes.json();
        
        // 检查数据是否读取成功
        if (recordsData.code !== 0) {
            throw new Error(`数据读取失败: ${recordsData.msg}`);
        }

        // 5. 第三步：将成功获取的数据打包返回给您的前端网页
        res.status(200).json({ 
            success: true, 
            records: recordsData.data.items 
        });

    } catch (error) {
        // 如果中间任何一步报错，把错误信息传给前端，方便排查
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
}