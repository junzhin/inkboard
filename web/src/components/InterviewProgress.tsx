const PHASES = [
  { id: 1, label: "Scope", icon: "1" },
  { id: 2, label: "Requirements", icon: "2" },
  { id: 3, label: "Architecture", icon: "3" },
  { id: 4, label: "Draft", icon: "4" },
  { id: 5, label: "Review", icon: "5" },
];

interface InterviewProgressProps {
  currentPhase: number;
  questionCount: number;
}

export function InterviewProgress({
  currentPhase,
  questionCount,
}: InterviewProgressProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center gap-1 max-w-2xl mx-auto">
        {PHASES.map((phase, i) => {
          const isActive = phase.id === currentPhase;
          const isDone = phase.id < currentPhase;

          return (
            <div key={phase.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1 flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    isDone
                      ? "bg-green-500 text-white"
                      : isActive
                        ? "bg-ink-600 text-white ring-2 ring-ink-200"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {isDone ? "✓" : phase.icon}
                </div>
                <span
                  className={`text-[10px] ${
                    isActive
                      ? "text-ink-700 font-medium"
                      : "text-gray-400"
                  }`}
                >
                  {phase.label}
                </span>
              </div>
              {i < PHASES.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-1 rounded ${
                    isDone ? "bg-green-300" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="text-center mt-1 text-xs text-gray-400">
        {questionCount} questions answered
      </div>
    </div>
  );
}
