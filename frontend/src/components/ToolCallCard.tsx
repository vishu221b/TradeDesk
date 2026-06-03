import { useState } from "react";
import type { ToolCall } from "../api/types";
import { Wrench } from "./icons";

export function ToolCallCard({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-edge-light text-xs dark:border-edge-dark">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 bg-black/[0.03] px-3 py-2 text-left font-mono text-accent dark:bg-white/[0.04]"
      >
        <Wrench className="h-3.5 w-3.5" />
        <span className="font-semibold">{call.name}</span>
        <span className="text-gray-400">({Object.keys(call.input).length} args)</span>
        <span className="ml-auto text-gray-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="space-y-2 px-3 py-2">
          <div>
            <div className="mb-1 font-semibold text-gray-500">Input</div>
            <pre className="overflow-x-auto rounded bg-black/5 p-2 font-mono dark:bg-white/5">
              {JSON.stringify(call.input, null, 2)}
            </pre>
          </div>
          {call.output !== undefined && call.output !== null && (
            <div>
              <div className="mb-1 font-semibold text-gray-500">Output</div>
              <pre className="max-h-48 overflow-auto rounded bg-black/5 p-2 font-mono dark:bg-white/5">
                {typeof call.output === "string"
                  ? call.output
                  : JSON.stringify(call.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
