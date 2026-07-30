// app/api/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generatePostWithDeepSeek, GeneratedPost } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      topic,
      platforms = ['facebook', 'instagram', 'x'],
      tone = '专业且吸引人',
      extraRequirements = ''
    } = body;

    if (!topic || typeof topic !== 'string') {
      return NextResponse.json(
        { success: false, error: '请输入有效的主题' },
        { status: 400 }
      );
    }

    // 调用 DeepSeek 生成文案
    const post: GeneratedPost = await generatePostWithDeepSeek(
      topic,
      platforms,
      tone,
      extraRequirements
    );

    return NextResponse.json({
      success: true,
      data: post,
      message: '文案生成成功'
    });

  } catch (error: any) {
    console.error('生成接口错误:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '生成文案失败，请稍后重试'
    }, { status: 500 });
  }
}