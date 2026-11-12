import { useState } from 'react';

type Props = {
  value: number;
  onChange: (v: number) => void;
  width?: number;
};

export default function NumInput({ value, onChange, width = 80 }: Props) {
  // null = tidak sedang diketik, tampilkan nilai asli
  const [text, setText] = useState<string | null>(null);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text ?? String(value)}
      style={{ width, padding: 4 }}
      onFocus={(e) => {
        setText(String(value));
        e.target.select();
      }}
      onBlur={() => setText(null)}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const n = Number(t.replace(',', '.'));
        if (t.trim() !== '' && Number.isFinite(n)) onChange(n);
      }}
    />
  );
}