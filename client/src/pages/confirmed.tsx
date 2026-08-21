import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Clock, Calendar, Mail, Loader2 } from "lucide-react";
import { gbp, formatDate } from "@/lib/format";
import config from "@/lib/tenant";
import { useBrand } from "@/lib/brand";
import { CancellationPolicy } from "@/components/cancellation-policy";
import type { Booking } from "@shared/schema";

const { business } = config;

export default function Confirmed() {
  const { id } = useParams<{ id: string }>();
  const b = useBrand();
  const { data: booking } = useQuery<Booking>({
    queryKey: ["/api/public/bookings", id],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/public/bookings/${id}`);
      return r.json();
    },
  });
  if (!booking) return <div className="min-h-screen grid place-items-center"><Loader2 className="size-6 animate-spin" /></div>;

  const isConfirmed = booking.status === "confirmed";

  return (
    <div className="min-h-screen bg-background py-10 px-4 flex items-start justify-center">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto size-16 rounded-full bg-primary/10 grid place-items-center mb-5">
          {isConfirmed ? <CheckCircle2 className="size-9 text-primary" /> : <Clock className="size-9 text-primary" />}
        </div>
        {isConfirmed ? (
          <>
            <h1 className="font-display text-3xl font-bold text-foreground">You're booked in.</h1>
            <p className="text-muted-foreground mt-2">A confirmation has been emailed to <strong>{booking.customerEmail}</strong>. {b.ownerName} has been notified and your slot is locked.</p>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl font-bold text-foreground">Request received.</h1>
            <p className="text-muted-foreground mt-2">{b.ownerName} will review and confirm your appointment shortly. We'll email <strong>{booking.customerEmail}</strong> as soon as it's locked in.</p>
          </>
        )}

        <Card className="p-5 text-left mt-6 bg-card">
          <h2 className="font-display font-bold text-lg mb-4">Booking details</h2>
          <dl className="space-y-2.5 text-sm">
            <Row label="Occasion" value={booking.eventType} />
            <Row label="Party size" value={String(booking.partySize)} />
            <Row label="Date" value={formatDate(booking.date)} />
            <Row label="Time" value={`${booking.startTime} – ${booking.endTime}`} />
            <Row label="Venue" value={`${business.address.line1}, ${business.address.city} ${business.address.postcode}`} />
            <div className="pt-3 mt-3 border-t border-card-border space-y-2">
              <Row label="Deposit" value={gbp(booking.depositAmount)} />
            </div>
          </dl>
        </Card>

        <div className="grid sm:grid-cols-2 gap-3 mt-5">
          <Button variant="outline" data-testid="button-add-calendar"><Calendar className="size-4 mr-2" /> Add to calendar</Button>
          <Button variant="outline" asChild data-testid="button-email-receipt"><a href={`mailto:${booking.customerEmail}`}><Mail className="size-4 mr-2" /> Email receipt</a></Button>
        </div>

        <CancellationPolicy className="mt-5 text-left" />

        <Link href="/" className="inline-block mt-6 text-sm text-primary hover:underline" data-testid="link-back-home">← Back to {b.brandName}</Link>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={`text-xs uppercase tracking-wider ${muted ? "text-muted-foreground/60" : "text-muted-foreground"}`}>{label}</dt>
      <dd className={muted ? "text-muted-foreground text-right" : "font-medium text-foreground text-right"}>{value}</dd>
    </div>
  );
}
