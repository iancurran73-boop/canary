/**
 * client/src/pages/pay-return.tsx
 * ───────────────────────────────
 * Customer lands here after SumUp's hosted checkout finishes (success or fail).
 * Polls /api/public/bookings/:id/payment-status every 2s for up to 30s.
 * If status = confirmed, redirects to /confirmed/:id. Otherwise shows
 * a retry option.
 */

import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import config from "@/lib/tenant";

type Status = { status: string; sumupStatus: string | null };

export default function PayReturn() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [attempts, setAttempts] = useState(0);

  const { data, refetch } = useQuery<Status>({
    queryKey: ["/api/public/bookings", id, "payment-status"],
    queryFn: async () => (await apiRequest("GET", `/api/public/bookings/${id}/payment-status`)).json(),
    refetchInterval: (q) => {
      const d = q.state.data as Status | undefined;
      if (d?.status === "confirmed" || d?.status === "completed") return false;
      if (attempts >= 15) return false; // ~30s of 2s polls
      return 2000;
    },
  });

  useEffect(() => {
    setAttempts((a) => a + 1);
  }, [data]);

  useEffect(() => {
    if (data?.status === "confirmed" || data?.status === "completed") {
      const t = setTimeout(() => setLocation(`/confirmed/${id}`), 1200);
      return () => clearTimeout(t);
    }
  }, [data?.status, id, setLocation]);

  const paid = data?.status === "confirmed" || data?.status === "completed";
  const failed = data?.sumupStatus && data.sumupStatus !== "PAID" && data.sumupStatus !== "PENDING";
  const timedOut = attempts >= 15 && !paid;

  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-xl">
        <Card className="p-6 sm:p-10 bg-card text-card-foreground text-center">
          {paid ? (
            <>
              <div className="size-14 rounded-full bg-primary/10 grid place-items-center mb-4 mx-auto">
                <CheckCircle2 className="size-7 text-primary" />
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">Payment received</h1>
              <p className="text-muted-foreground mt-3">
                Thanks — your booking is confirmed. Taking you to the confirmation page…
              </p>
            </>
          ) : failed || timedOut ? (
            <>
              <div className="size-14 rounded-full bg-destructive/10 grid place-items-center mb-4 mx-auto">
                <AlertCircle className="size-7 text-destructive" />
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">
                {failed ? "Payment didn't complete" : "Still waiting for confirmation"}
              </h1>
              <p className="text-muted-foreground mt-3 max-w-sm mx-auto">
                {failed
                  ? "It looks like the payment was cancelled or failed. You can try again — your slot is still being held."
                  : "We haven't heard back from SumUp yet. Try again, or check back in a few minutes."}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center mt-6">
                <Button onClick={() => setLocation(`/pay/${id}`)} data-testid="button-retry-pay">
                  <CreditCard className="size-4 mr-2" /> Try again
                </Button>
                <Button variant="outline" onClick={() => { setAttempts(0); refetch(); }} data-testid="button-refresh-status">
                  Refresh status
                </Button>
              </div>
            </>
          ) : (
            <>
              <Loader2 className="size-7 animate-spin text-primary mx-auto mb-4" />
              <h1 className="font-display text-2xl sm:text-3xl font-bold">Confirming your payment…</h1>
              <p className="text-muted-foreground mt-3">This usually takes a few seconds.</p>
            </>
          )}

          <div className="mt-8">
            <Link href="/" className="text-sm text-primary font-semibold hover:underline" data-testid="link-back-home">
              ← Back to {config.brand.name}
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
