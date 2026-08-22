/**
 * client/src/pages/pay.tsx
 * ─────────────────────────
 * Post-booking screen. Behaviour depends on the server-controlled payments mode:
 *
 *  "mvp"   — Shows contact-owner screen with mailto/tel links.
 *            All copy is driven by tenant config (ownerName, contactWindow, etc.)
 *
 *  "sumup" — Redirects the customer to SumUp's hosted checkout to pay the deposit.
 */

import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mail, Phone, Clock, CheckCircle2, Loader2, Copy, CreditCard, AlertCircle } from "lucide-react";
import { gbp, formatDate } from "@/lib/format";
import { useState } from "react";
import type { Booking } from "@shared/schema";
import config from "@/lib/tenant";
import { useBrand } from "@/lib/brand";
import { CancellationPolicy } from "@/components/cancellation-policy";

type BookingDetails = Booking & { reference?: string };

const CONTACT_WINDOW = config.payments.contactWindow;

export default function Pay() {
  const { id } = useParams<{ id: string }>();
  const b = useBrand();
  const [copied, setCopied] = useState<"email" | "ref" | null>(null);

  const { data: booking, isLoading } = useQuery<BookingDetails>({
    queryKey: ["/api/public/bookings", id],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/public/bookings/${id}`);
      return r.json();
    },
  });

  // Server-side payments mode — lets the admin toggle SumUp on/off without a redeploy.
  const { data: paymentsMode } = useQuery<{ mode: "mvp" | "sumup" }>({
    queryKey: ["/api/public/payments-mode"],
    queryFn: async () => (await apiRequest("GET", "/api/public/payments-mode")).json(),
  });

  if (isLoading || !booking) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  // ── SumUp mode (server-controlled) ────────────────────────────────────────
  if (paymentsMode?.mode === "sumup" && booking.status === "pending") {
    return <SumupPaySection booking={booking} />;
  }

  // ── MVP mode (default) ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-2xl">
        <Card className="p-6 sm:p-10 bg-card text-card-foreground">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="size-14 rounded-full bg-primary/10 grid place-items-center mb-4">
              <CheckCircle2 className="size-7 text-primary" />
            </div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary font-bold">Booking received</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold mt-2 leading-tight">
              Thank you, {booking.customerName.split(" ")[0]}.
            </h1>
            <p className="text-muted-foreground mt-3 max-w-md">
              The room has been provisionally held. To secure the booking, please contact {b.ownerName} within{" "}
              {CONTACT_WINDOW} and they'll send you a payment link for the deposit.
            </p>
          </div>

          <BookingSummary booking={booking} copied={copied} setCopied={setCopied} />
          <MvpContactSection booking={booking} copied={copied} setCopied={setCopied} />

          <CancellationPolicy className="mt-6" />

          {b.phone && (
            <p className="text-xs text-muted-foreground text-center mt-6 leading-relaxed">
              If you don't hear back within {CONTACT_WINDOW}, please call {b.ownerName} directly on {b.phone}.
            </p>
          )}

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-primary font-semibold hover:underline" data-testid="link-back-home">
              ← Back to {b.brandName}
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function BookingSummary({
  booking,
  copied,
  setCopied,
}: {
  booking: BookingDetails;
  copied: "email" | "ref" | null;
  setCopied: (v: "email" | "ref" | null) => void;
}) {
  const reference = booking.reference || `BK-${String(booking.id).padStart(5, "0")}`;

  function copy(value: string, which: "email" | "ref") {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div className="rounded-lg bg-muted/50 border border-border p-4 sm:p-5 space-y-2 text-sm">
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-border">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Reference</span>
        <button
          onClick={() => copy(reference, "ref")}
          className="font-mono font-semibold text-foreground inline-flex items-center gap-1.5 hover-elevate active-elevate-2 px-2 py-1 rounded -mr-2"
          data-testid="button-copy-reference"
        >
          {reference}
          <Copy className="size-3.5 opacity-60" />
          {copied === "ref" && <span className="text-xs text-primary ml-1">Copied</span>}
        </button>
      </div>
      <Row label="Occasion" value={booking.eventType} />
      <Row label="Party size" value={String(booking.partySize)} />
      <Row label="Date" value={formatDate(booking.date)} />
      <Row label="Time" value={booking.startTime} />
      <div className="border-t border-border pt-2 mt-2 space-y-1.5">
        <Row label="Deposit" value={gbp(booking.depositAmount)} highlight />
      </div>
    </div>
  );
}

function MvpContactSection({
  booking,
  copied,
  setCopied,
}: {
  booking: BookingDetails;
  copied: "email" | "ref" | null;
  setCopied: (v: "email" | "ref" | null) => void;
}) {
  const b = useBrand();
  const ownerName = b.ownerName;
  const email = b.email || "";
  const phone = b.phone || "";
  const reference = booking.reference || `BK-${String(booking.id).padStart(5, "0")}`;

  const subject = encodeURIComponent(`Booking request ${reference} — ${booking.customerName}`);
  const bodyLines = [
    `Hi ${ownerName},`,
    ``,
    `I've just submitted a booking request through the website. My details:`,
    ``,
    `Reference: ${reference}`,
    `Occasion: ${booking.eventType}`,
    `Party size: ${booking.partySize}`,
    `Date: ${formatDate(booking.date)}`,
    `Time: ${booking.startTime}`,
    `Deposit: ${gbp(booking.depositAmount)}`,
    ``,
    `Please send me a payment link for the deposit when you have a moment.`,
    ``,
    `Thanks,`,
    booking.customerName,
  ].join("\n");
  const mailto = `mailto:${email}?subject=${subject}&body=${encodeURIComponent(bodyLines)}`;

  function copy(value: string, which: "email" | "ref") {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div className="mt-6 rounded-lg border-2 border-primary/30 bg-primary/5 p-5">
      <div className="flex items-start gap-3">
        <Clock className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-display font-bold text-base text-foreground">Next step — within {CONTACT_WINDOW}</p>
          <p className="text-sm text-foreground/80 mt-1">
            {email
              ? <>Email {ownerName} quoting reference <strong className="font-mono">{reference}</strong>. </>
              : <>Quote your reference <strong className="font-mono">{reference}</strong> when you get in touch. </>}
            They'll reply with a secure payment link for your deposit. Until the deposit is paid,
            the room is only provisionally held.
          </p>
        </div>
      </div>

      {email || phone ? (
        <>
          <div className="mt-5 grid sm:grid-cols-2 gap-3">
            {email && (
              <Button asChild size="lg" className="w-full" data-testid="button-email-owner">
                <a href={mailto}>
                  <Mail className="size-4 mr-2" /> Email {ownerName}
                </a>
              </Button>
            )}
            {phone && (
              <Button asChild variant="outline" size="lg" className="w-full" data-testid="button-call-owner">
                <a href={`tel:${phone}`}>
                  <Phone className="size-4 mr-2" /> Call {phone}
                </a>
              </Button>
            )}
          </div>

          {email && (
            <button
              onClick={() => copy(email, "email")}
              className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5"
              data-testid="button-copy-email"
            >
              <Copy className="size-3" />
              {copied === "email" ? "Email copied" : `Copy email · ${email}`}
            </button>
          )}
        </>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground text-center">Contact details coming soon</p>
      )}
    </div>
  );
}

function SumupPaySection({ booking }: { booking: BookingDetails }) {
  const b = useBrand();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiRequest("POST", `/api/public/bookings/${booking.id}/sumup-checkout`);
      const data = await r.json();
      if (!r.ok || !data.hostedCheckoutUrl) {
        throw new Error(data.error || "Could not start payment");
      }
      window.location.href = data.hostedCheckoutUrl;
    } catch (e: any) {
      setError(String(e?.message || e));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-2xl">
        <Card className="p-6 sm:p-10 bg-card text-card-foreground">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="size-14 rounded-full bg-primary/10 grid place-items-center mb-4">
              <CreditCard className="size-7 text-primary" />
            </div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary font-bold">Pay your deposit</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold mt-2 leading-tight">
              Thank you, {booking.customerName.split(" ")[0]}.
            </h1>
            <p className="text-muted-foreground mt-3 max-w-md">
              The room is being held. Pay the {gbp(booking.depositAmount)} deposit to confirm — you'll be redirected to SumUp's secure payment page. It comes straight back to you {config.room.depositRefundDescription}.
            </p>
          </div>

          <BookingSummary booking={booking} copied={null} setCopied={() => {}} />

          <div className="mt-6">
            <Button
              size="lg"
              className="w-full"
              onClick={startCheckout}
              disabled={loading}
              data-testid="button-sumup-pay"
            >
              {loading ? (
                <><Loader2 className="size-4 mr-2 animate-spin" /> Redirecting to SumUp…</>
              ) : (
                <><CreditCard className="size-4 mr-2" /> Pay {gbp(booking.depositAmount)} deposit</>
              )}
            </Button>
            {error && (
              <div className="mt-3 flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="size-4 mt-0.5 shrink-0" />
                <div>{error}</div>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center mt-6 leading-relaxed">
            Payments are processed securely by SumUp. Cancellations {b.policy.cancellationNoticeHours}h+ in advance are refunded in full.
          </p>

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-primary font-semibold hover:underline" data-testid="link-back-home">
              ← Back to {config.brand.name}
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, highlight, muted }: { label: string; value: string; highlight?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={`text-xs uppercase tracking-wider ${muted ? "text-muted-foreground/60" : "text-muted-foreground"}`}>{label}</span>
      <span className={highlight ? "font-display text-lg font-bold text-primary" : muted ? "text-muted-foreground" : "font-medium text-foreground text-right"}>{value}</span>
    </div>
  );
}
