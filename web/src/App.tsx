import { useEffect } from 'react';
import { useFormStore } from './store/useFormStore';
import FormPanel from './components/FormPanel';
import PreviewPanel from './components/PreviewPanel';
import './App.css';

export default function App() {
  const loadBrands = useFormStore(s => s.loadBrands);
  const selectedBrand = useFormStore(s => s.selectedBrand);
  const loadModels = useFormStore(s => s.loadModels);

  useEffect(() => {
    loadBrands();
    loadModels();
  }, [loadBrands, loadModels]);

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>{selectedBrand} Social Auto-Poster</h1>
        <span className="app-version">v2.0</span>
      </header>
      <main className="app-main">
        <aside className="app-sidebar">
          <FormPanel />
        </aside>
        <section className="app-content">
          <PreviewPanel />
        </section>
      </main>
      <footer className="app-footer">
        <span>DeepSeek AI + Facebook Graph API + Instagram Graph API + X Chrome Automation</span>
      </footer>
    </div>
  );
}
