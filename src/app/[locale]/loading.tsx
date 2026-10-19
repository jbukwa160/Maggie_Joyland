import { Bow } from "@/components/shop/Decorations";

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Loading">
      <Bow className="w-20 animate-pulse text-primary-300" />
    </div>
  );
}
