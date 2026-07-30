const fs = require('fs');
const path = require('path');

console.log('=============================================');
console.log('🩺 Shemei Skill 项目深度体检报告 (Dr. VS Code)');
console.log('=============================================\n');

const rootDir = __dirname;

// 辅助函数：检查文件/文件夹是否存在
function checkExists(targetPath) {
    return fs.existsSync(path.join(rootDir, targetPath));
}

// 辅助函数：读取文件内容
function readFile(targetPath) {
    if (checkExists(targetPath)) {
        return fs.readFileSync(path.join(rootDir, targetPath), 'utf-8');
    }
    return null;
}

// 辅助函数：粗略计算文件夹大小 (MB)
function getFolderSize(dirPath) {
    let totalSize = 0;
    if (!fs.existsSync(dirPath)) return 0;
    
    function calculate(currentPath) {
        const stats = fs.statSync(currentPath);
        if (stats.isFile()) {
            totalSize += stats.size;
        } else if (stats.isDirectory()) {
            const files = fs.readdirSync(currentPath);
            files.forEach(file => calculate(path.join(currentPath, file)));
        }
    }
    try { calculate(dirPath); } catch (e) { /* 忽略权限错误 */ }
    return (totalSize / (1024 * 1024)).toFixed(2);
}

// 1. 【望】整体架构扫描
console.log('👀 [望] 整体架构扫描...');
const isNextJs = checkExists('package.json') && readFile('package.json').includes('next');
console.log(`  - 项目类型: ${isNextJs ? '✅ Next.js 工程' : '⚠️ 非标准 Next.js 工程'}`);
console.log(`  - app 目录 (App Router): ${checkExists('app') ? '✅ 存在' : '❌ 缺失 (建议使用 App Router)'}`);
console.log(`  - lib 目录 (核心逻辑): ${checkExists('lib') ? '✅ 存在' : '❌ 缺失'}`);

// 2. 【闻】依赖包与体积探测
console.log('\n👂 [闻] 体积与依赖探测...');
console.log(`  - 项目总依赖体积 (node_modules): ${getFolderSize(path.join(rootDir, 'node_modules'))} MB`);
console.log(`  - Next.js 编译缓存 (.next): ${getFolderSize(path.join(rootDir, '.next'))} MB`);
const pkg = readFile('package.json');
if (pkg) {
    console.log(`  - 核心依赖: Playwright (${pkg.includes('playwright') ? '✅' : '❌'}), OpenAI/DeepSeek (${pkg.includes('openai') ? '✅' : '❌'}), Axios (${pkg.includes('axios') ? '✅' : '❌'})`);
}

// 3. 【问】安全与防坑配置检查
console.log('\n💬 [问] 安全与 Git 检查...');
const gitignore = readFile('.gitignore');
if (gitignore) {
    console.log(`  - Git 忽略依赖 (node_modules): ${gitignore.includes('node_modules') ? '✅ 已拦截' : '❌ 危险 (会导致 Vercel 报错)'}`);
    console.log(`  - Git 忽略密钥 (.env.local): ${gitignore.includes('.env.local') || gitignore.includes('.env') ? '✅ 已拦截' : '❌ 危险 (极易泄露密钥)'}`);
} else {
    console.log('  - .gitignore 文件: ❌ 缺失 (极其危险，258MB 会全部推送到 GitHub)');
}

const hasEnv = checkExists('.env.local') || checkExists('.env');
console.log(`  - 环境变量文件 (.env.local): ${hasEnv ? '✅ 存在 (安全检查完毕)' : '⚠️ 缺失 (如果未配置，API 将无法调用)'}`);

// 4. 【切】核心 API 路由检查
console.log('\n✋ [切] 核心 API 路由检查...');
console.log(`  - 页面主入口 (page.tsx/js): ${checkExists('app/page.tsx') || checkExists('app/page.js') ? '✅ 存在' : '❌ 缺失'}`);
console.log(`  - AI 文案路由 (api/generate): ${checkExists('app/api/generate/route.ts') || checkExists('api/generate.js') ? '✅ 存在' : '⚠️ 缺失'}`);
console.log(`  - Meta 发布路由 (api/post-meta): ${checkExists('app/api/post-meta/route.ts') || checkExists('api/post-meta.js') ? '✅ 存在' : '⚠️ 缺失'}`);

console.log('\n=============================================');
console.log('🎉 体检完成！请将以上报告复制给您的 AI 助手进行会诊。');
console.log('=============================================\n');