import { LoadingSpinner } from "@/components";

/**
 * Global loading page for Next.js route transitions.
 * Shows while page content is being loaded.
 */
export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-canvas">
      <LoadingSpinner size="lg" text="Rolling the boulder..." />
    </div>
  );
}
