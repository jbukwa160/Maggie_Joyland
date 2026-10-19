import { Bow } from "../Decorations";

export function AuthShell({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="relative rounded-[2.5rem] bg-surface p-6 shadow-card ring-1 ring-primary-100 sm:p-10">
        <Bow className="absolute -top-7 left-1/2 w-20 -translate-x-1/2 text-accent-400" />
        <h1 className="text-center font-display text-4xl">{title}</h1>
        <p className="mb-7 mt-2 text-center text-ink-soft">{text}</p>
        {children}
      </div>
    </div>
  );
}
