// Toast — notification overlay
import { useAppStore } from '../../store/useAppStore';

export default function Toast() {
  const toast = useAppStore(s => s.toast);
  const dismiss = useAppStore(s => s.dismissToast);

  if (!toast) return null;

  return (
    <div className={`toast ${toast.kind}`} onClick={dismiss}>
      {toast.message}
    </div>
  );
}
