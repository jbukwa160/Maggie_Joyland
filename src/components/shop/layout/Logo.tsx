import { Crown } from "../Decorations";

/** Text logo ("Maggie" + script "Joyland") unless a logo image is set in the admin. */
export function Logo({ siteName, logoUrl, className }: { siteName: string; logoUrl?: string; className?: string }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- logo may be an uploaded file of any size
    return <img src={logoUrl} alt={siteName} className={`h-12 w-auto sm:h-14 ${className ?? ""}`} />;
  }
  const [first, ...rest] = siteName.split(" ");
  return (
    <span className={`relative inline-flex flex-col items-center leading-none ${className ?? ""}`}>
      <Crown className="absolute -top-3.5 left-1/2 w-6 -translate-x-1/2 text-gold" />
      <span className="font-display text-[1.7rem] tracking-wide text-accent-500 sm:text-[2.1rem]">{first}</span>
      {rest.length > 0 && <span className="-mt-1 font-script text-xl text-ink-soft sm:text-2xl">{rest.join(" ")}</span>}
    </span>
  );
}
