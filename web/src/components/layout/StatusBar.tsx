// StatusBar — task info, auto-retry, creator
import { useStudioStore } from '../../store/useStudioStore';

export default function StatusBar() {
  const content = useStudioStore(s => s.content);

  return (
    <footer className="statusbar">
      <span>任务 ID：{content?.taskId || '尚未生成'}</span>
      <span>✓ 自动重试已启用</span>
      <span>创建时间：{content?.createdAt ? new Date(content.createdAt).toLocaleString('zh-CN') : '--'}</span>
      <span>创建人：管理员</span>
    </footer>
  );
}
