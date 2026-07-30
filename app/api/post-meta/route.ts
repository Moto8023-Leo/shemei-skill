// app/api/post-meta/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MetaPoster } from '@/lib/meta-api';
import { postToFeishu } from '@/lib/feishu';   // 后续会创建

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      message,           // Facebook 正文
      caption,           // Instagram 正文（可与 message 相同）
      imageUrl,          // 图片 URL（必填用于 INS）
      topic,             // 用于飞书记录
      originalPost       // 原始生成的 GeneratedPost 对象（可选）
    } = body;

    if (!message) {
      return NextResponse.json(
        { success: false, error: '缺少发布内容' },
        { status: 400 }
      );
    }

    const poster = new MetaPoster();
    const results = await poster.postToBoth(message, caption || message, imageUrl);

    // 记录到飞书表格
    await postToFeishu({
      topic: topic || '未命名主题',
      platform: 'facebook,instagram',
      title: message.substring(0, 100),
      content: message,
      fbResult: results.fbResult,
      igResult: results.igResult,
      status: results.fbResult.success || results.igResult.success ? '成功' : '部分失败'
    });

    return NextResponse.json({
      success: true,
      data: {
        facebook: results.fbResult,
        instagram: results.igResult,
      },
      message: 'Meta 平台发布完成'
    });

  } catch (error: any) {
    console.error('Meta 发布接口错误:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '发布失败'
    }, { status: 500 });
  }
}