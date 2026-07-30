// lib/deepseek.ts
import OpenAI from 'openai';

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});

export interface GeneratedPost {
  title: string;
  content: string;
  hashtags: string[];
  image_prompt?: string;
  platform_suggestions?: string[];
}

/**
 * 使用 DeepSeek 生成社媒文案
 * @param topic 主题 / 关键词
 * @param platforms 目标平台数组，例如 ["facebook", "instagram", "x"]
 * @param tone 语气风格
 * @param extraRequirements 额外要求
 */
export async function generatePostWithDeepSeek(
  topic: string,
  platforms: string[] = ['facebook', 'instagram', 'x'],
  tone: string = '专业且吸引人',
  extraRequirements: string = ''
): Promise<GeneratedPost> {
  try {
    const platformStr = platforms.join('、');

    const prompt = `
你是一位专业的社媒文案专家。请根据以下信息生成**高质量**的社媒文案。

主题/内容：${topic}
目标平台：${platformStr}
语气风格：${tone}
额外要求：${extraRequirements || '自然、吸引互动、适合转发'}

请严格按照以下 JSON 格式返回（不要输出任何其他内容）：

{
  "title": "简短吸睛的标题（适合做卡片标题）",
  "content": "完整的正文内容，适合直接发帖，控制在适合各平台长度",
  "hashtags": ["tag1", "tag2", "tag3"],
  "image_prompt": "如果需要配图，给出一句详细的AI画图提示词（英文更好）",
  "platform_suggestions": ["针对每个平台的轻微调整建议"]
}

要求：
- 内容积极正面、真实自然
- 加入适当的互动引导（提问、呼吁行动）
- Hashtags 相关且不过度
`;

    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-chat',        // 或 deepseek-reasoner 如果需要更强推理
      messages: [
        { role: 'system', content: '你是一个严格遵守JSON格式的社媒文案助手。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1200,
      response_format: { type: 'json_object' }
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('DeepSeek 返回内容为空');

    const parsed = JSON.parse(content) as GeneratedPost;

    return {
      title: parsed.title || topic,
      content: parsed.content || '',
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
      image_prompt: parsed.image_prompt,
      platform_suggestions: parsed.platform_suggestions,
    };

  } catch (error: any) {
    console.error('DeepSeek 生成失败:', error);
    throw new Error(`文案生成失败: ${error.message || '未知错误'}`);
  }
}

// 测试用（开发时可删除）
export async function testDeepseek() {
  const result = await generatePostWithDeepSeek(
    'AI 如何改变内容创作',
    ['instagram', 'x'],
    '活泼专业',
    '加入数据或案例'
  );
  console.log(result);
}