// server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { generatePostWithDeepSeek } from './lib/deepseek.ts';
import { MetaPoster } from './lib/meta-api.ts';
import { postToX } from './lib/playwright-x.ts';
import { postToFeishu } from './lib/feishu.ts';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/generate', async (req, res) => {
  try {
    const { topic, platforms, tone, extraRequirements } = req.body;
    const post = await generatePostWithDeepSeek(topic, platforms, tone, extraRequirements);
    res.json({ success: true, data: post });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/post-meta', async (req, res) => {
  try {
    const poster = new MetaPoster();
    const { message, caption, imageUrl, topic } = req.body;
    const results = await poster.postToBoth(message, caption || message, imageUrl);
    await postToFeishu({ topic, platform: 'facebook,instagram', ...req.body, fbResult: results.fbResult, igResult: results.igResult, status: '已处理' });
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/post-x', async (req, res) => {
  try {
    const { content, topic } = req.body;
    const result = await postToX(content);
    await postToFeishu({ topic, platform: 'x', ...req.body, xResult: result, status: result.success ? '成功' : '失败' });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`后端服务器已启动: http://localhost:${PORT}`);
});