// A single quiet line rather than a scrolling strip: it says one thing, and
// it does not compete with the page for attention. Edited from admin.
export function AnnouncementBar({ text }: { text: string }) {
  return (
    <div className="bg-surface px-4 py-2.5 text-center text-xs text-muted">{text}</div>
  );
}
