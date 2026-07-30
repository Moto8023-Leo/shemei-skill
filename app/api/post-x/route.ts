// app/api/post-x/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { postToX } from '@/lib/playwright-x';
import { postToFeishu } from '@/lib/feishu';   // 后续创建

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      content,     // 要发布的文字内容
      imagePath,   // 本地图片路径（可选）
      topic,       // 用于飞书记录
      originalPost // 原始 GeneratedPost（可选）
    } = body;

    if (!content) {
      return NextResponse.json(
        { success: false, error: '缺少发布内容' },
        { status: 400 }
      );
    }

    // 执行 X 发布（浏览器自动化）
    const result = await postToX(content, imagePath);

    // 记录到飞书
    await postToFeishu({
      topic: topic || '未命名主题',
      platform: 'x',
      title: content.substring(0, 80),
      content: content,
      xResult: result,
      status: result.success ? '成功' : '失败'
    });

    return NextResponse.json({
      success: result.success,
      data: result,
      message: result.success ? 'X 发布成功' : 'X 发布失败'
    });

  } catch (error: any) {
    console.error('X 发布接口错误:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'X 发布失败（浏览器自动化错误）'
    }, { status: 500 });
  }
}