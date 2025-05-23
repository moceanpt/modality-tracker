import { useState } from "react";

interface Props {
  defaultMin: number;                // fallback when user leaves input blank
  onChange: (seconds: number) => void;
}

export default function DurationPicker({ defaultMin, onChange }: Props) {
  const [value, setValue] = useState("");

  function start() {
    const min = parseInt(value, 10);
    onChange(isNaN(min) ? defaultMin * 60 : min * 60);
    setValue("");                     // clear after use
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        type="number"
        min={1}
        placeholder="min"
        className="w-16 rounded border px-1 py-0.5 text-center"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && start()}
      />
      <button
        onClick={start}
        className="rounded bg-indigo-600 px-3 py-1 text-white text-sm"
      >
        ▶︎ Start
      </button>
    </div>
  );
}