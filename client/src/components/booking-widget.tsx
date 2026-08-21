import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { gbp, formatDuration, formatDate, formatDateShort, todayIso, addDays } from "@/lib/format";
import { Sparkles, Clock, ArrowRight, ArrowLeft, Check, Calendar as CalIcon, CreditCard, Loader2, Dog } from "lucide-react";
import type { Service } from "@shared/schema";
import { useLocation } from "wouter";
import config from "@/lib/tenant";
import { useBrand, isInServiceArea } from "@/lib/brand";
import { useContent } from "@/lib/content";
import { type DogSize, SIZE_LABELS, BREEDS_BY_SIZE, BREED_TO_SIZE } from "@/lib/breeds";

type Step = "dog" | "service" | "datetime" | "details" | "review";

/** Return the effective price for a service given a dog size (fallback to base price). */
function sizePrice(service: Service, size: DogSize | ""): number {
  if (!size) return service.price;
  const map: Record<DogSize, number | null | undefined> = {
    small: service.priceSmall,
    medium: service.priceMedium,
    large: service.priceLarge,
    xlarge: service.priceXLarge,
  };
  return map[size] ?? service.price;
}

export function BookingWidget({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast();
  const b = useBrand();
  const { c } = useContent();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>("dog");
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [date, setDate] = useState<string>(todayIso());
  const [startTime, setStartTime] = useState<string>("");
  const [dogSize, setDogSize] = useState<DogSize | "">("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
    dogName: "",
    dogBreed: "",
    addressLine1: "",
    postcode: "",
  });

  const { data: services = [], isLoading: loadingServices } = useQuery<Service[]>({
    queryKey: ["/api/public/services"],
  });
  const { data: studio } = useQuery<{ studioName: string; acceptingBookings: boolean; minNoticeHours: number; maxAdvanceDays: number }>({
    queryKey: ["/api/public/studio"],
  });

  const service = services.find((s) => s.id === serviceId);

  const { data: avail, isLoading: loadingSlots } = useQuery<{ slots: string[]; durationMinutes: number }>({
    queryKey: ["/api/public/availability", { date, serviceId }],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/public/availability?date=${date}&serviceId=${serviceId}`);
      return r.json();
    },
    enabled: !!serviceId && step === "datetime",
  });

  const createBooking = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/public/bookings", {
        serviceId,
        customerName: form.name,
        customerEmail: form.email,
        customerPhone: form.phone,
        notes: form.notes,
        date,
        startTime,
        addressLine1: form.addressLine1,
        postcode: form.postcode,
        dogName: form.dogName,
        dogBreed: form.dogBreed,
        dogSize,
      });
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/public/availability"] });
      // Every booking lands as "pending" now (deposit or not — see server).
      // With nothing to pay, there's no pay step to send them through, so go
      // straight to the status page; it shows "awaiting confirmation" until
      // the owner marks it confirmed.
      setLocation(data.depositAmount > 0 ? `/pay/${data.bookingId}` : `/confirmed/${data.bookingId}`);
    },
    onError: (err: Error) => {
      toast({ title: "Could not book", description: err.message, variant: "destructive" });
    },
  });

  // Build the date strip out to the business's actual advance-booking
  // window (Admin > Settings), not a fixed number of days — this used to be
  // hardcoded to 14 regardless of that setting, so customers could never
  // select or even see a date beyond two weeks out.
  const maxAdvanceDays = studio?.maxAdvanceDays ?? 60;
  const dateStrip = useMemo(
    () => Array.from({ length: maxAdvanceDays }).map((_, i) => addDays(todayIso(), i)),
    [maxAdvanceDays]
  );

  const canContinueDateTime = !!serviceId && !!date && !!startTime;

  // Breeds for the currently-selected size
  const breedsForSize: string[] = dogSize ? BREEDS_BY_SIZE[dogSize] : [];

  // When a breed is picked, auto-select its size if not already set
  function handleBreedChange(breed: string) {
    setForm((f) => ({ ...f, dogBreed: breed }));
    if (!dogSize && BREED_TO_SIZE[breed]) {
      setDogSize(BREED_TO_SIZE[breed]);
    }
  }

  // When size changes, reset breed if the current breed doesn't belong to new size
  function handleSizeChange(size: DogSize) {
    setDogSize(size);
    if (form.dogBreed && BREED_TO_SIZE[form.dogBreed] !== size) {
      setForm((f) => ({ ...f, dogBreed: "" }));
    }
  }

  const effectivePrice = service ? sizePrice(service, dogSize) : 0;

  // Soft service-area check on postcode. Warns but never blocks submission.
  const contactEmail = c("contact.email", b.email);
  const trimmedPostcode = form.postcode.trim();
  const looksLikeOutcode = /^[A-Z]{1,2}\d/i.test(trimmedPostcode.replace(/\s+/g, ""));
  const areaCheck = isInServiceArea(trimmedPostcode, b.serviceAreas);
  const showAreaWarning = trimmedPostcode.length >= 2 && looksLikeOutcode && !areaCheck.ok;

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
              <Sparkles className="size-3" /> Book your appointment
            </p>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mt-0.5" data-testid="text-widget-title">
              {b.brandName}
            </h2>
          </div>
          <Stepper step={step} />
        </div>
      </header>

      <div className="px-6 sm:px-8 pb-8">
        {/* STEP 1 — Dog details (name, size, breed) — captured FIRST so service prices reflect the dog's size */}
        {step === "dog" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Tell us about your dog so we can show the right price.</p>

            <div>
              <Label htmlFor="dogName">Dog's name</Label>
              <Input id="dogName" data-testid="input-dog-name" value={form.dogName} onChange={(e) => setForm({ ...form, dogName: e.target.value })} placeholder="e.g. Buddy" />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="dogSize">Dog's size</Label>
                <Select value={dogSize} onValueChange={(v) => handleSizeChange(v as DogSize)}>
                  <SelectTrigger id="dogSize" data-testid="select-dog-size">
                    <SelectValue placeholder="Select size…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(SIZE_LABELS) as [DogSize, string][]).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dogBreed">Dog's breed</Label>
                <Select
                  value={form.dogBreed}
                  onValueChange={handleBreedChange}
                  disabled={!dogSize}
                >
                  <SelectTrigger id="dogBreed" data-testid="select-dog-breed">
                    <SelectValue placeholder={dogSize ? "Select breed…" : "Pick size first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {breedsForSize.map((breed) => (
                      <SelectItem key={breed} value={breed}>{breed}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                disabled={!form.dogName || !dogSize || !form.dogBreed}
                onClick={() => setStep("service")}
                data-testid="button-continue-service"
              >
                Continue to services <ArrowRight className="size-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2 — Service — prices now shown for the dog's size */}
        {step === "service" && (
          <div className="space-y-3">
            <DogSummaryBar dogName={form.dogName} dogBreed={form.dogBreed} dogSize={dogSize} onChange={() => setStep("dog")} />
            <p className="text-sm text-muted-foreground">Choose what you'd like to book — prices shown are for <strong className="text-foreground">{dogSize ? SIZE_LABELS[dogSize] : "your dog"}</strong>.</p>
            {loadingServices && <SkeletonList />}
            <div className="grid gap-3">
              {services.map((s) => {
                // Show exact price for the dog's selected size
                const exactPrice = sizePrice(s, dogSize);
                return (
                  <button
                    key={s.id}
                    data-testid={`button-service-${s.id}`}
                    onClick={() => { setServiceId(s.id); setStep("datetime"); setStartTime(""); }}
                    className={`group text-left rounded-xl border-2 p-4 sm:p-5 transition-all hover-elevate ${serviceId === s.id ? "border-primary bg-primary/5" : "border-card-border bg-card"}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-base sm:text-lg font-bold text-foreground">{s.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
                        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="size-3.5" /> {formatDuration(s.durationMinutes)}</span>
                          <span className="text-foreground/40">•</span>
                          <span>{s.depositEnabled ? `${s.depositPercent}% booking fee to secure` : "No booking fee required"}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-display text-xl font-bold text-foreground">
                          {gbp(exactPrice)}
                        </div>
                        <ArrowRight className="size-4 text-primary mt-2 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2 — Date & time */}
        {step === "datetime" && service && (
          <div className="space-y-5">
            <SelectedServiceBar service={service} dogSize={dogSize} onChange={() => setStep("service")} />

            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5 mb-3">
                <CalIcon className="size-3.5" /> Pick a date
              </Label>
              <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-thin">
                {dateStrip.map((d) => {
                  const dt = new Date(d + "T00:00:00");
                  const isSelected = date === d;
                  return (
                    <button
                      key={d}
                      data-testid={`button-date-${d}`}
                      onClick={() => { setDate(d); setStartTime(""); }}
                      className={`shrink-0 w-16 sm:w-[72px] py-2.5 rounded-xl border-2 transition-all hover-elevate ${isSelected ? "border-primary bg-primary text-primary-foreground" : "border-card-border bg-card text-foreground"}`}
                    >
                      <div className="text-[10px] uppercase tracking-wider opacity-80">{dt.toLocaleDateString("en-GB", { weekday: "short" })}</div>
                      <div className="font-display text-xl font-bold mt-0.5">{dt.getDate()}</div>
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
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-11 rounded-lg bg-muted animate-pulse" />)}
                </div>
              ) : avail && avail.slots.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {avail.slots.map((t) => (
                    <button
                      key={t}
                      data-testid={`button-time-${t}`}
                      onClick={() => setStartTime(t)}
                      className={`h-11 rounded-lg border-2 font-medium transition-all hover-elevate text-sm ${startTime === t ? "border-primary bg-primary text-primary-foreground" : "border-card-border bg-card text-foreground"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              ) : (
                <Card className="p-4 bg-muted/40 border-dashed text-sm text-muted-foreground text-center">
                  No openings on {formatDateShort(date)}. Try another date.
                </Card>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("service")} data-testid="button-back-service">
                <ArrowLeft className="size-4 mr-1" /> Back
              </Button>
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

        {/* STEP 4 — Your contact details (dog already captured in step 1) */}
        {step === "details" && service && (
          <div className="space-y-4">
            <SelectedServiceBar service={service} dogSize={dogSize} onChange={() => setStep("datetime")} />
            <DogSummaryBar dogName={form.dogName} dogBreed={form.dogBreed} dogSize={dogSize} onChange={() => setStep("dog")} />
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

              <div>
                <Label htmlFor="addressLine1">Address line 1</Label>
                <Input id="addressLine1" data-testid="input-address" value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} placeholder="12 High Street" />
              </div>
              <div>
                <Label htmlFor="postcode">Postcode</Label>
                <Input id="postcode" data-testid="input-postcode" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} placeholder="NE23 1AB" />
                {showAreaWarning && (
                  <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-300" data-testid="text-area-warning">
                    Sorry, we don't currently cover {trimmedPostcode.toUpperCase()}. Get in touch at{" "}
                    <a className="underline font-medium" href={`mailto:${contactEmail}`}>{contactEmail}</a>{" "}
                    and we'll see what we can do.
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="notes">Anything we should know? <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea id="notes" data-testid="input-notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Allergies, special requests…" />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("datetime")} data-testid="button-back-datetime">
                <ArrowLeft className="size-4 mr-1" /> Back
              </Button>
              <Button
                className="flex-1"
                disabled={!form.name || !form.email || !form.phone || !form.addressLine1 || !form.postcode}
                onClick={() => setStep("review")}
                data-testid="button-continue-review"
              >
                Review booking <ArrowRight className="size-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4 — Review & Pay */}
        {step === "review" && service && (
          <div className="space-y-4">
            <Card className="p-5 bg-card border-card-border">
              <h3 className="font-display text-lg font-bold mb-4">Booking summary</h3>
              <dl className="space-y-2.5 text-sm">
                <Row label="Service" value={service.name} />
                <Row label="Duration" value={formatDuration(service.durationMinutes)} />
                <Row label="Date" value={formatDate(date)} />
                <Row label="Time" value={startTime} />
                <Row label="Name" value={form.name} />
                <Row label="Contact" value={`${form.email} · ${form.phone}`} />
                <Row label="Dog" value={`${form.dogName} (${form.dogBreed})`} />
                {dogSize && <Row label="Size" value={SIZE_LABELS[dogSize]} />}
                <Row label="Address" value={`${form.addressLine1}, ${form.postcode}`} />
                <div className="pt-3 mt-3 border-t border-card-border space-y-2.5">
                  <Row label="Total" value={gbp(effectivePrice)} />
                  {service.depositEnabled ? (
                    <>
                      <Row label={`Booking fee (${service.depositPercent}%)`} value={gbp(effectivePrice * service.depositPercent / 100)} highlight />
                      <Row label="Balance on the day" value={gbp(effectivePrice * (100 - service.depositPercent) / 100)} muted />
                    </>
                  ) : (
                    <Row label="Due on the day" value={gbp(effectivePrice)} highlight />
                  )}
                </div>
              </dl>
            </Card>

            <div className="rounded-lg bg-secondary/10 border border-secondary/30 p-4 text-sm text-foreground/80">
              <div className="flex items-start gap-2.5">
                <CreditCard className="size-4 mt-0.5 text-secondary shrink-0" />
                <div>
                  {service.depositEnabled ? (
                    <>
                      <p className="font-semibold text-foreground">Reserve your slot</p>
                      <p className="text-xs mt-0.5">Submit your request and {b.ownerName} will email a secure payment link for the <strong>{service.depositPercent}% booking fee</strong> within {config.payments.contactWindow}. Slot is held provisionally until the booking fee is paid. Cancellations 48h+ in advance refunded in full.</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-foreground">Request your slot</p>
                      <p className="text-xs mt-0.5">No booking fee is required for this service. Submit your request and {b.ownerName} will confirm your appointment shortly. Full payment of {gbp(effectivePrice)} is due on the day.</p>
                    </>
                  )}
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
    <div className={`bg-card text-card-foreground rounded-2xl border border-card-border shadow-xl overflow-hidden ${embedded ? "" : "max-w-xl mx-auto"}`}>
      {children}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: Step[] = ["dog", "service", "datetime", "details", "review"];
  const idx = steps.indexOf(step);
  return (
    <div className="flex items-center gap-1">
      {steps.map((_, i) => (
        <div key={i} className={`h-1.5 rounded-full transition-all ${i <= idx ? "bg-primary w-6" : "bg-muted w-3"}`} />
      ))}
    </div>
  );
}

function SelectedServiceBar({ service, dogSize, onChange }: { service: Service; dogSize: DogSize | ""; onChange: () => void }) {
  const price = sizePrice(service, dogSize);
  return (
    <Card className="p-3.5 flex items-center justify-between gap-3 bg-primary/5 border-primary/20">
      <div className="min-w-0">
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider mb-1 border-primary/30 text-primary">Service</Badge>
        <div className="font-display font-bold text-sm text-foreground truncate">{service.name}</div>
        <div className="text-xs text-muted-foreground">{formatDuration(service.durationMinutes)} · {gbp(price)}{dogSize ? ` (${SIZE_LABELS[dogSize]})` : ""}</div>
      </div>
      <Button variant="ghost" size="sm" onClick={onChange} data-testid="button-change-service">Change</Button>
    </Card>
  );
}

function DogSummaryBar({ dogName, dogBreed, dogSize, onChange }: { dogName: string; dogBreed: string; dogSize: DogSize | ""; onChange: () => void }) {
  return (
    <Card className="p-3.5 flex items-center justify-between gap-3 bg-secondary/10 border-secondary/30">
      <div className="min-w-0">
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider mb-1 border-secondary/40 text-secondary">Dog</Badge>
        <div className="font-display font-bold text-sm text-foreground truncate flex items-center gap-1.5"><Dog className="size-3.5" /> {dogName || "—"}</div>
        <div className="text-xs text-muted-foreground">{dogBreed || "—"}{dogSize ? ` · ${SIZE_LABELS[dogSize]}` : ""}</div>
      </div>
      <Button variant="ghost" size="sm" onClick={onChange} data-testid="button-change-dog">Change</Button>
    </Card>
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

function SkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
    </div>
  );
}
