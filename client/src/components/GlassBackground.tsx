/**
 * The soft violet gradient mesh sitting behind glass surfaces — login page, app shell chrome.
 * Pure CSS radial gradients (no image asset), so it never needs replacing and costs nothing to
 * load. Sits absolutely behind its parent (which must be `position: relative`) at z-0.
 */
export function GlassBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div
        className="absolute -left-1/4 -top-1/4 h-[70%] w-[70%] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, #8B5CF6 0%, transparent 70%)" }}
      />
      <div
        className="absolute -bottom-1/3 -right-1/4 h-[80%] w-[80%] rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #6D28D9 0%, transparent 70%)" }}
      />
      <div
        className="absolute left-1/3 top-1/2 h-[50%] w-[50%] -translate-y-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #C4B5FD 0%, transparent 70%)" }}
      />
    </div>
  );
}
