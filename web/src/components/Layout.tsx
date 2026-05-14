import { type ReactNode } from "react";
import { useStore } from "../store";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { connected, view, setView, planContent } = useStore();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">
              InkBoard
            </h1>
            <span className="text-xs text-gray-400">v0.1.0</span>
          </div>

          <div className="flex items-center gap-4">
            <nav className="flex gap-1">
              {(
                [
                  ["idle", "Home"],
                  ["question", "Questions"],
                  ["diff", "Diff"],
                  ["plan", "Plan"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  disabled={v === "plan" && !planContent}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    view === v
                      ? "bg-ink-100 text-ink-700 font-medium"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30"
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full ${
                  connected ? "bg-green-400" : "bg-red-400"
                }`}
              />
              <span className="text-xs text-gray-400">
                {connected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="py-6">{children}</main>
    </div>
  );
}
