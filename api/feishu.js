export default async function handler(req, res) {
    const APP_ID = process.env.FEISHU_APP_ID;
    const APP_SECRET = process.env.FEISHU_APP_SECRET;
    const APP_TOKEN = 'QFrowVpL3iIMAYkCE2PcaZCEnJe'; 
    const TABLE_ID = 'tblTZTeXWry93slq';

    try {
        const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET })
        });
        const tokenData = await tokenRes.json();
        if (tokenData.code !== 0) throw new Error('Token获取失败');
        
        const recordsRes = await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${tokenData.tenant_access_token}`,
                'Content-Type': 'application/json'
            }
        });
        const recordsData = await recordsRes.json();
        if (recordsData.code !== 0) throw new Error('数据读取失败');

        res.status(200).json({ success: true, records: recordsData.data.items });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}