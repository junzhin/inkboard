import { useStore } from "../store";

export function MarkdownReview() {
  const { planContent, planFilePath } = useStore();

  if (!planContent) return null;

  const sections = planContent.split(/^(#{1,3}\s.+)$/gm);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Plan Review</h2>
        <span className="text-xs text-gray-400 font-mono">{planFilePath}</span>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="prose prose-sm max-w-none p-6">
          {sections.map((section, i) => {
            const isHeading = /^#{1,3}\s/.test(section);
            const isDecision = section.includes("<!-- DECISION:");

            if (isHeading) {
              const level = section.match(/^(#+)/)?.[1].length ?? 1;
              const text = section.replace(/^#+\s/, "");
              const Tag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements;
              return (
                <Tag key={i} className="text-gray-900 mt-6 first:mt-0">
                  {text}
                </Tag>
              );
            }

            if (isDecision) {
              const decisions = [
                ...section.matchAll(
                  /<!-- DECISION:(\w[\w-]*)=(.*?) -->/g
                ),
              ];
              return (
                <div key={i} className="my-3 space-y-1">
                  {decisions.map((match, di) => (
                    <div
                      key={di}
                      className="inline-flex items-center gap-2 mr-2 px-2 py-1 bg-ink-50 border border-ink-200 rounded text-xs"
                    >
                      <span className="font-medium text-ink-700">
                        {match[1]}
                      </span>
                      <span className="text-ink-500">=</span>
                      <span className="text-ink-900">{match[2]}</span>
                    </div>
                  ))}
                </div>
              );
            }

            if (!section.trim()) return null;

            return (
              <div key={i} className="text-gray-700 text-sm whitespace-pre-wrap">
                {section}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
