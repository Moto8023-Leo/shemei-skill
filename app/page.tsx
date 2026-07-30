// app/page.tsx
'use client';

import React, { useState } from 'react';
import { Send, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface GeneratedPost {
  title: string;
  content: string;
  hashtags: string[];
  image_prompt?: string;
}

export default function ShemeiSkill() {
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('专业且吸引人');
  const [platforms, setPlatforms] = useState<string[]>(['facebook', 'instagram', 'x']);
  const [extra, setExtra] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedPost | null>(null);
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishStatus, setPublishStatus] = useState<any>(null);

  const togglePlatform = (plat: string) => {
    if (platforms.includes(plat)) {
      setPlatforms(platforms.filter(p => p !== plat));
    } else {
      setPlatforms([...platforms, plat]);
    }
  };

  const generate = async () => {
    if (!topic) return alert('请输入主题');
    setLoading(true);
    setResult(null);
    setPublishStatus(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, platforms, tone, extraRequirements: extra }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      } else {
        alert(data.error || '生成失败');
      }
    } catch (err) {
      alert('请求失败');
    } finally {
      setLoading(false);
    }
  };

  const publish = async () => {
    if (!result) return;
    setPublishLoading(true);

    try {
      // Meta (FB + INS)
      if (platforms.includes('facebook') || platforms.includes('instagram')) {
        await fetch('/api/post-meta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `${result.title}\n\n${result.content}\n\n${result.hashtags.join(' ')}`,
            caption: `${result.title}\n\n${result.content}\n\n${result.hashtags.join(' ')}`,
            topic: topic,
            imageUrl: '', // 后续可接入图片生成
          }),
        });
      }

      // X
      if (platforms.includes('x')) {
        await fetch('/api/post-x', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `${result.title}\n\n${result.content}\n\n${result.hashtags.join(' ')}`,
            topic: topic,
          }),
        });
      }

      setPublishStatus({ success: true, message: '✅ 已触发发布！请查看飞书表格记录' });
    } catch (err) {
      setPublishStatus({ success: false, message: '发布请求失败' });
    } finally {
      setPublishLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-2">Shemei Skill</h1>
        <p className="text-center text-gray-600 mb-8">DeepSeek 驱动 · 多平台智能发布</p>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* 输入区域 */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">输入主题 / 关键词</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例如：AI 如何帮助中小企业营销"
                className="w-full p-4 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">语气风格</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full p-4 border rounded-xl"
                >
                  <option value="专业且吸引人">专业且吸引人</option>
                  <option value="活泼有趣">活泼有趣</option>
                  <option value="励志正能量">励志正能量</option>
                  <option value="简洁干货">简洁干货</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">目标平台</label>
                <div className="flex gap-3 flex-wrap">
                  {['facebook', 'instagram', 'x'].map(p => (
                    <button
                      key={p}
                      onClick={() => togglePlatform(p)}
                      className={`px-5 py-2 rounded-full border ${platforms.includes(p) ? 'bg-blue-600 text-white' : 'bg-white'}`}
                    >
                      {p === 'facebook' ? 'FB' : p === 'instagram' ? 'INS' : 'X'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">额外要求（可选）</label