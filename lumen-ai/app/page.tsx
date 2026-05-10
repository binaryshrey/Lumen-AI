import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-3 rounded-full bg-white px-8 py-4 text-base font-semibold text-black transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.15)]"
      >
        GO TO DASHBOARD
        <ArrowRight className="size-5" />
      </Link>
    </div>
  );
}
