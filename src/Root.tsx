import { useState } from 'react';
import App from './App';
import ArchApp from './ArchApp';

export default function Root() {
  const [tab, setTab] = useState<'beam' | 'arch'>('beam');
  const btn = (active: boolean) => ({
    padding: '8px 16px',
    marginRight: 6,
    cursor: 'pointer',
    fontWeight: active ? 700 : 400,
  });
  return (
    <div>
      <div style={{ padding: '12px 20px 0' }}>
        <button style={btn(tab === 'beam')} onClick={() => setTab('beam')}>
          Balok
        </button>
        <button style={btn(tab === 'arch')} onClick={() => setTab('arch')}>
          Busur
        </button>
      </div>
      {tab === 'beam' ? <App /> : <ArchApp />}
    </div>
  );
}