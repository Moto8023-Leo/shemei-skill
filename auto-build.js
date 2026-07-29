const fs = require('fs');
const path = require('path');

// 1. 准备前端页面的代码
const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>飞书多维表格实时数据</title>
    <style>
        body { font-family: system-ui; padding: 20px; max-width: 800px; margin: auto; }
        .data-box { border: 1px solid #ddd; padding: 15px; margin-top: 10px; border-radius: 8px; background: #f9f9f9; }
    </style>
</head>
<body>
    <h2>🚀 飞书数据看板</h2>
    <button onclick="fetchFeishuData()">🔄 刷新数据</button>
    <div id="result" class="data-box">等待加载...</div>

    <script>
        window.onload = fetchFeishuData;
        async function fetchFeishuData() {
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = '正在加载，请稍候...';
            try {
                const response = await fetch('/api/feishu');
                const data = await response.json();
                if (data.success) {
                    resultDiv.innerHTML = '<pre>' + JSON.stringify(data.records, null, 2) + '</pre>';
                } else {
                    resultDiv.innerHTML = '<p style="color: red;">获取失败: ' + data.error + '</p>';
                }
            } catch (error) {
                resultDiv.innerHTML = '<p style="color: red;">网络错误: ' + error.message + '</p>';
            }
        }
    </script>
</body>
</html>`;

// 2. 准备后端 API 的代码
const jsContent = `export default async function handler(req, res) {
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
        
        const recordsRes = await fetch(\`https://open.feishu.cn/open-apis/bitable/v1/apps/\${APP_TOKEN}/tables/\${TABLE_ID}/records\`, {
            method: 'GET',
            headers: {
                'Authorization': \`Bearer \${tokenData.tenant_access_token}\`,
                'Content-Type': 'application/json'
            }
        });
        const recordsData = await recordsRes.json();
        if (recordsData.code !== 0) throw new Error('数据读取失败');

        res.status(200).json({ success: true, records: recordsData.data.items });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}`;

// 3. 让电脑开始自动干活：创建文件夹
const apiDir = path.join(__dirname, 'api');
if (!fs.existsSync(apiDir)) {
    fs.mkdirSync(apiDir);
    console.log('✅ 已自动创建文件夹：api');
}

// 4. 让电脑自动干活：写入文件
fs.writeFileSync(path.join(__dirname, 'index.html'), htmlContent, 'utf8');
console.log('✅ 已自动生成文件：index.html');

fs.writeFileSync(path.join(apiDir, 'feishu.js'), jsContent, 'utf8');
console.log('✅ 已自动生成文件：api/feishu.js');

console.log('🎉 恭喜！所有所需文件和代码已一键生成完毕！您现在可以直接使用 Git 推送了。');