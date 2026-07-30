// lib/meta-api.ts
import axios from 'axios';

/**
 * Meta Graph API 工具类（Facebook + Instagram）
 */
export class MetaPoster {
  private accessToken: string;
  private pageId: string;
  private igUserId: string;

  constructor() {
    this.accessToken = process.env.META_ACCESS_TOKEN || '';
    this.pageId = process.env.FB_PAGE_ID || '';
    this.igUserId = process.env.IG_USER_ID || '';

    if (!this.accessToken) throw new Error('缺少 META_ACCESS_TOKEN');
  }

  /**
   * 发布到 Facebook Page
   */
  async postToFacebook(
    message: string,
    imageUrl?: string,
    link?: string
  ): Promise<{ success: boolean; postId?: string; url?: string; error?: string }> {
    try {
      const url = `https://graph.facebook.com/v22.0/${this.pageId}/feed`;

      const payload: any = {
        message,
        access_token: this.accessToken,
      };

      if (link) payload.link = link;
      if (imageUrl) payload.link = imageUrl; // 简单处理，实际可使用 /photos 接口

      const response = await axios.post(url, payload);

      const postId = response.data.id;
      const postUrl = `https://www.facebook.com/${postId.split('_')[1] || postId}`;

      return {
        success: true,
        postId,
        url: postUrl,
      };
    } catch (error: any) {
      console.error('Facebook 发布失败:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  /**
   * 发布到 Instagram（单图/视频/Reels 基础版）
   * 注意：Instagram 需要先创建 media container
   */
  async postToInstagram(
    caption: string,
    imageUrl: string,
    isReel: boolean = false
  ): Promise<{ success: boolean; postId?: string; url?: string; error?: string }> {
    try {
      if (!this.igUserId) throw new Error('缺少 IG_USER_ID');

      // Step 1: 创建 Media Container
      const containerUrl = `https://graph.facebook.com/v22.0/${this.igUserId}/media`;
      
      const containerPayload = {
        image_url: imageUrl,
        caption: caption,
        media_type: isReel ? 'REELS' : 'IMAGE',
        access_token: this.accessToken,
      };

      const containerRes = await axios.post(containerUrl, containerPayload);
      const creationId = containerRes.data.id;

      // Step 2: 发布 Container
      const publishUrl = `https://graph.facebook.com/v22.0/${this.igUserId}/media_publish`;
      const publishPayload = {
        creation_id: creationId,
        access_token: this.accessToken,
      };

      const publishRes = await axios.post(publishUrl, publishPayload);
      const postId = publishRes.data.id;

      return {
        success: true,
        postId,
        url: `https://www.instagram.com/p/${postId}/`, // 实际 ID 格式可能不同
      };
    } catch (error: any) {
      console.error('Instagram 发布失败:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  /**
   * 同时发布到 FB 和 INS
   */
  async postToBoth(
    message: string,
    caption: string,
    imageUrl?: string
  ) {
    const fbResult = await this.postToFacebook(message, imageUrl);
    const igResult = imageUrl 
      ? await this.postToInstagram(caption, imageUrl) 
      : { success: false, error: '无图片，跳过INS' };

    return { fbResult, igResult };
  }
}

// 测试用
export async function testMeta() {
  const poster = new MetaPoster();
  // const result = await poster.postToFacebook("测试发帖", undefined, "https://example.com");
  // console.log(result);
}