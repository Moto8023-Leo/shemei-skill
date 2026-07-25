// BootScreen — startup loading animation
interface Props {
  error: string;
}

export default function BootScreen({ error }: Props) {
  return (
    <div className="boot-screen">
      <div className="boot-logo">{error ? '⚠' : 'iENYRID'}</div>
      {!error && <div className="boot-spinner" />}
      <p>{error || '正在连接社媒智能工作台…'}</p>
    </div>
  );
}
