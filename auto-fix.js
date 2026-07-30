const fs = require('fs');
const path = require('path');

console.log('🚀 正在启动 VS Code 全自动修复引擎...\n');

const rootDir = __dirname;

// 1. 修复 Vercel 路由配置 (解决 API 失联和 404 错误)
const vercelJsonPath = path.join(rootDir, 'vercel.json');
const vercelConfig = {
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.py" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
};
fs.writeFileSync(vercelJsonPath, JSON.stringify(vercelConfig, null, 2));
console.log('✅ [vercel.json] 修复完成：前后端路由桥梁已建立。');

// 2. 修复 Python 依赖配置 (解决后端服务 500 崩溃错误)
const reqPath = path.join(rootDir, 'requirements.txt');
if (!fs.existsSync(reqPath)) {
    const reqs = "fastapi\npython-multipart\nrequests\nopenai\npydantic\n";
    fs.writeFileSync(reqPath, reqs);
    console.log('✅ [requirements.txt] 修复完成：已生成云端运行必需的依赖清单。');
} else {
    console.log('⚡ [requirements.txt] 检测到已有配置：安全跳过，保留原有依赖。');
}

// 3. 修复 Git 上传拦截网 (隔离 258MB 的超大文件夹)
const gitignorePath = path.join(rootDir, '.gitignore');
const ignoreContent = "node_modules/\n.next/\n.env\n.env.local\n__pycache__/\n*.pyc\n";
fs.writeFileSync(gitignorePath, ignoreContent);
console.log('✅ [.gitignore] 修复完成：已拉起防护网，拦截超大文件和私密密钥上传。');

// 4. 生成云端环境变量对照表
const envExamplePath = path.join(rootDir, '.env.example');
const envTemplate = "DEEPSEEK_API_KEY=\nFEISHU_APP_ID=\nFEISHU_APP_SECRET=\nMETA_ACCESS_TOKEN=\nFB_PAGE_ID=\nIG_USER_ID=\nFEISHU_SPREADSHEET_TOKEN=\n";
fs.writeFileSync(envExamplePath, envTemplate);
console.log('✅ [.env.example] 生成完成：云端密钥对照模板已生成。');

console.log('\n=============================================');
console.log('🎉 VS Code 自动化基础架构修复已完毕！');
console.log('=============================================');