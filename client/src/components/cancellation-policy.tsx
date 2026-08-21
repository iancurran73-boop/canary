/**
 * client/src/components/cancellation-policy.tsx
 * ──────────────────────────────────────────────
 * Lightweight native disclosure showing the admin-managed cancellation policy.
 * The [N] placeholder in the policy body is replaced with the live notice hours.
 */

import { useBrand } from "@/lib/brand";

export function CancellationPolicy({ className = "" }: { className?: string }) {
  const { policy } = useBrand();
  const body = policy.body.replace(/\[N\]/g, String(policy.cancellationNoticeHours));

  return (
    <details className={`rounded-xl border border-card-border bg-card/60 px-4 py-3 ${className}`} data-testid="details-cancellation-policy">
      <summary className="cursor-pointer text-sm font-semibold text-foreground select-none">
        Cancellation policy
      </summary>
      <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
        {body}
      </p>
    </details>
  );
}
