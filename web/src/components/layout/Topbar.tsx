// Topbar — page title, connection state, actions
import { useAppStore } from '../../store/useAppStore';

interface Props {
  title: string;
  subtitle: string;
  online: boolean;
  mode: string;
}

export default function Topbar({ title, subtitle, online, mode }: Props) {
  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="topbar-actions">
        <span className={`connection-state ${online ? 'online' : 'offline'}`}>
          {online ? '● 服务正常' : '● 连接中断'}
        </span>
        <button className="header-icon" type="button" title="帮助">?</button>
        <button className="header-icon notice" type="button" title="通知">
          ♢<i>0</i>
        </button>
        <button className="language-button" type="button">简体中文 ⌄</button>
        <div className="admin-mini">
          <span>管</span>
          <strong>管理员</strong>
        </div>
      </div>
    </header>
  );
}
