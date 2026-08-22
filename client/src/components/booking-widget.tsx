import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { gbp, formatDuration, formatDate, formatDateShort, todayIso, addDays } from "@/lib/format";
import { Sparkles, Clock, ArrowRight, ArrowLeft, Calendar as CalIcon, CreditCard, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useBrand } from "@/lib/brand";
import config from "@/lib/tenant";

type Step = "datetime" | "details" | "review";

export function BookingWidget({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast();
  const b = useBrand();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>("datetime");
  const [date, setDate] = useState<string>(todayIso());
  const [startTime, setStartTime] = useState<string>("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    eventType: "",
    partySize: "",
    notes: "",
    shoutOuts: "",
  });

  const { data: studio } = useQuery<{
    studioName: string;
    acceptingBookings: boolean;
    minNoticeHours: number;
    maxAdvanceDays: number;
    sessionDurationMinutes: number;
    depositAmount: number;
  }>({
    queryKey: ["/api/public/studio"],
  });

  const { data: avail, isLoading: loadingSlots } = useQuery<{ slots: string[]; durationMinutes: number }>({
    queryKey: ["/api/public/availability", { date }],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/public/availability?date=${date}`);
      return r.json();
    },
    enabled: step === "datetime",
  });

  const createBooking = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/public/bookings", {
        customerName: form.name,
        customerEmail: form.email,
        customerPhone: form.phone,
        eventType: form.eventType,
        partySize: Number(form.partySize),
        notes: form.notes,
        shoutOuts: form.shoutOuts,
        date,
        startTime,
      });
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/public/availability"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/availability-range"] });
      setLocation(data.depositAmount > 0 ? `/pay/${data.bookingId}` : `/confirmed/${data.bookingId}`);
    },
    onError: (err: Error) => {
      toast({ title: "Could not book", description: err.message, variant: "destructive" });
    },
  });

  // Build the date strip out to the venue's actual advance-booking window
  // (Admin > Settings), not a fixed number of days.
  const maxAdvanceDays = studio?.maxAdvanceDays ?? 90;
  const dateStrip = useMemo(
    () => Array.from({ length: maxAdvanceDays }).map((_, i) => addDays(todayIso(), i)),
    [maxAdvanceDays]
  );

  // Bulk Y/N so the date strip can grey out fully-booked days upfront,
  // instead of making people tap each date to find out.
  const rangeTo = dateStrip[dateStrip.length - 1];
  const { data: rangeAvail } = useQuery<{ unavailable: string[] }>({
    queryKey: ["/api/public/availability-range", { from: todayIso(), to: rangeTo }],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/public/availability-range?from=${todayIso()}&to=${rangeTo}`);
      return r.json();
    },
    enabled: step === "datetime" && !!rangeTo,
  });
  const unavailableDates = useMemo(() => new Set(rangeAvail?.unavailable ?? []), [rangeAvail]);

  const canContinueDateTime = !!date && !!startTime;
  const partySizeNum = Number(form.partySize);
  const canContinueDetails =
    !!form.name && !!form.email && !!form.phone && !!form.eventType &&
    !!form.partySize && partySizeNum >= 1;

  const depositAmount = studio?.depositAmount ?? 0;
  const sessionDurationMinutes = studio?.sessionDurationMinutes ?? avail?.durationMinutes ?? 0;

  if (studio && !studio.acceptingBookings) {
    return (
      <Wrapper embedded={embedded}>
        <div className="text-center py-12 px-6">
          <h3 className="font-display text-2xl font-bold mb-2 text-foreground">Bookings paused</h3>
          <p className="text-muted-foreground">We're not taking new bookings right now. Please email <a className="underline" href={`mailto:${b.email}`}>{b.email}</a> for enquiries.</p>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper embedded={embedded}>
      {/* Header */}
      <header className="px-6 pt-6 pb-4 sm:px-8 sm:pt-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-primary font-semibold flex items-center gap-1.5">
              <Sparkles className="size-3" /> Book the room
            </p>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mt-0.5" data-testid="text-widget-title">
              {b.brandName}
            </h2>
          </div>
          <Stepper step={step} />
        </div>
      </header>

      <div className="px-6 sm:px-8 pb-8">
        {/* STEP 1 — Date & time */}
        {step === "datetime" && (
          <div className="space-y-5">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5 mb-3">
                <CalIcon className="size-3.5" /> Pick a date
              </Label>
              <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-thin">
                {dateStrip.map((d) => {
                  const dt = new Date(d + "T00:00:00");
                  const isSelected = date === d;
                  const isUnavailable = unavailableDates.has(d);
                  return (
                    <button
                      key={d}
                      data-testid={`button-date-${d}`}
                      onClick={() => { if (isUnavailable) return; setDate(d); setStartTime(""); }}
                      disabled={isUnavailable}
                      aria-label={isUnavailable ? `${dt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} — fully booked` : undefined}
                      className={`shrink-0 w-16 sm:w-[72px] py-2.5 rounded-xl border-2 transition-all ${
                        isUnavailable
                          ? "border-card-border bg-card text-muted-foreground/40 opacity-50 cursor-not-allowed"
                          : `hover-elevate ${isSelected ? "border-primary bg-primary text-primary-foreground" : "border-card-border bg-card text-foreground"}`
                      }`}
                    >
                      <div className="text-[10px] uppercase tracking-wider opacity-80">{dt.toLocaleDateString("en-GB", { weekday: "short" })}</div>
                      <div className={`font-display text-xl font-bold mt-0.5 ${isUnavailable ? "line-through" : ""}`}>{dt.getDate()}</div>
                      <div className="text-[10px] opacity-80">{dt.toLocaleDateString("en-GB", { month: "short" })}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5 mb-3">
                <Clock className="size-3.5" /> Available start times
              </Label>
              {loadingSlots ? (
                <div className="h-11 rounded-lg bg-muted animate-pulse" />
              ) : avail && avail.slots.length > 0 ? (
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger className="h-11" data-testid="select-start-time">
                    <SelectValue placeholder="Choose a start time" />
                  </SelectTrigger>
                  <SelectContent>
                    {avail.slots.map((t) => (
                      <SelectItem key={t} value={t} data-testid={`option-time-${t}`}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Card className="p-4 bg-muted/40 border-dashed text-sm text-muted-foreground text-center">
                  No openings on {formatDateShort(date)}. Try another date.
                </Card>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                disabled={!canContinueDateTime}
                onClick={() => setStep("details")}
                data-testid="button-continue-details"
              >
                Continue to your details <ArrowRight className="size-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2 — Your details */}
        {step === "details" && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <strong className="text-foreground">{formatDate(date)}</strong> at <strong className="text-foreground">{startTime}</strong>
            </div>

            <div className="grid gap-3">
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" data-testid="input-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" data-testid="input-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@example.com" />
                </div>
                <div>
                  <Label htmlFor="phone">Mobile number</Label>
                  <Input id="phone" type="tel" data-testid="input-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="07…" />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="eventType">What's the occasion?</Label>
                  <Input id="eventType" data-testid="input-event-type" value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })} placeholder="Birthday, hen do, work do…" />
                </div>
                <div>
                  <Label htmlFor="partySize">Party size</Label>
                  <Input id="partySize" type="number" min={1} data-testid="input-party-size" value={form.partySize} onChange={(e) => setForm({ ...form, partySize: e.target.value })} placeholder="e.g. 12" />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Anything we should know? <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea id="notes" data-testid="input-notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Bringing your own buffet, a kissogram, allergies, timings…" />
              </div>

              <div>
                <Label htmlFor="shoutOuts">Shout-outs for the DJ <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea id="shoutOuts" data-testid="input-shout-outs" rows={2} value={form.shoutOuts} onChange={(e) => setForm({ ...form, shoutOuts: e.target.value })} placeholder="Songs to play, birthday shout-outs, first dance…" />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("datetime")} data-testid="button-back-datetime">
                <ArrowLeft className="size-4 mr-1" /> Back
              </Button>
              <Button
                className="flex-1"
                disabled={!canContinueDetails}
                onClick={() => setStep("review")}
                data-testid="button-continue-review"
              >
                Review booking <ArrowRight className="size-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3 — Review & Pay */}
        {step === "review" && (
          <div className="space-y-4">
            <Card className="p-5 bg-card border-card-border">
              <h3 className="font-display text-lg font-bold mb-4">Booking summary</h3>
              <dl className="space-y-2.5 text-sm">
                <Row label="Date" value={formatDate(date)} />
                <Row label="Time" value={startTime} />
                {sessionDurationMinutes > 0 && <Row label="Duration" value={formatDuration(sessionDurationMinutes)} />}
                <Row label="Name" value={form.name} />
                <Row label="Contact" value={`${form.email} · ${form.phone}`} />
                <Row label="Occasion" value={form.eventType} />
                <Row label="Party size" value={form.partySize} />
                {form.shoutOuts && <Row label="DJ shout-outs" value={form.shoutOuts} muted />}
                <div className="pt-3 mt-3 border-t border-card-border space-y-2.5">
                  <Row label="Deposit to secure" value={gbp(depositAmount)} highlight />
                </div>
              </dl>
            </Card>

            <div className="rounded-lg bg-secondary/10 border border-secondary/30 p-4 text-sm text-foreground/80">
              <div className="flex items-start gap-2.5">
                <CreditCard className="size-4 mt-0.5 text-secondary shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">Reserve the room</p>
                  <p className="text-xs mt-0.5">
                    Submit your request and {b.ownerName} will email a secure payment link for the <strong>{gbp(depositAmount)} deposit</strong> — this comes straight back to you {config.room.depositRefundDescription}.
                    The room is held exclusively once your deposit is paid.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("details")} data-testid="button-back-details">
                <ArrowLeft className="size-4 mr-1" /> Back
              </Button>
              <Button
                className="flex-1"
                onClick={() => createBooking.mutate()}
                disabled={createBooking.isPending}
                data-testid="button-pay-deposit"
              >
                {createBooking.isPending ? <Loader2 className="size-4 mr-1 animate-spin" /> : <CreditCard className="size-4 mr-1" />}
                Request booking
              </Button>
            </div>
          </div>
        )}
      </div>
    </Wrapper>
  );
}

function Wrapper({ children, embedded }: { children: React.ReactNode; embedded: boolean }) {
  return (
    <div className={`bg-card text-card-foreground rounded-md border border-card-border shadow-xl overflow-hidden ${embedded ? "" : "max-w-xl mx-auto"}`}>
      {children}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: Step[] = ["datetime", "details", "review"];
  const idx = steps.indexOf(step);
  return (
    <div className="flex items-center gap-1">
      {steps.map((_, i) => (
        <div key={i} className={`h-1.5 rounded-full transition-all ${i <= idx ? "bg-primary w-6" : "bg-muted w-3"}`} />
      ))}
    </div>
  );
}

function Row({ label, value, highlight, muted }: { label: string; value: string; highlight?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={`text-xs uppercase tracking-wider ${muted ? "text-muted-foreground/60" : "text-muted-foreground"}`}>{label}</dt>
      <dd className={`text-right ${highlight ? "font-display text-lg font-bold text-primary" : muted ? "text-muted-foreground" : "font-medium text-foreground"}`}>{value}</dd>
    </div>
  );
}
