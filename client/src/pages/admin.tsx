import { useState, useRef, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { gbp, formatDuration, formatDate, formatDateShort, todayIso, addDays } from "@/lib/format";
import { BrandMark } from "@/components/brand-mark";
import {
  Calendar, PartyPopper, Clock, Settings as SettingsIcon, Plus, Trash2, Pencil, Bell, ChevronLeft,
  CalendarOff, Ban, CheckCircle2, X, Loader2, BellRing, AlertCircle, FileText,
  ChevronUp, ChevronDown, GripVertical, Image as ImageIcon, Star, MessageSquare, CreditCard,
  Building2, Palette, ScrollText, MapPin, Mail, Layers, Eye, EyeOff, Copy, Link2,
} from "lucide-react";
import type { Booking, WorkingHours, BlockedDate, Settings, Review, Event, ReturningCustomerInfo } from "@shared/schema";
import { AdminGate, AdminLogout } from "@/components/admin-gate";
import { useContent, useGalleryItems, useContentMutations } from "@/lib/content";
import type { GalleryItem } from "@/lib/content";
import type { SitePage } from "@/lib/pages";
import { PAGE_LAYOUTS } from "@shared/page-layouts";
import { ImageDropzone } from "@/components/content/ImageDropzone";
import { InlineText } from "@/components/content/InlineText";
import config from "@/lib/tenant";

type Tab = "today" | "schedule" | "hours" | "blocked" | "settings" | "content" | "pages" | "reviews" | "events" | "payments" | "business" | "branding" | "policy" | "emails";

type AdminBooking = Booking & { returningCustomer?: ReturningCustomerInfo | null };

function toMinutesLocal(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function slotsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const aS = toMinutesLocal(aStart);
  let aE = toMinutesLocal(aEnd);
  if (aE <= aS) aE += 1440;
  const bS = toMinutesLocal(bStart);
  let bE = toMinutesLocal(bEnd);
  if (bE <= bS) bE += 1440;
  return aS < bE && aE > bS;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatLastVisit(lastVisitDate: string): string {
  const last = new Date(lastVisitDate + "T00:00:00");
  const now = new Date();
  const days = Math.max(0, Math.round((now.getTime() - last.getTime()) / 86_400_000));
  if (days < 14) return `last ${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.round(days / 7);
  if (weeks <= 52) return `last ${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  return `last ${months} month${months === 1 ? "" : "s"} ago`;
}

function ReturningBadge({ info }: { info: ReturningCustomerInfo }) {
  const parts = [
    `${ordinal(info.visits + 1)} visit`,
    info.lastVisitDate ? formatLastVisit(info.lastVisitDate) : null,
    info.lastEventType || null,
  ].filter(Boolean);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/25 px-2 py-0.5 text-[10px] font-medium"
      data-testid="badge-returning"
    >
      🔁 Returning · {parts.join(" · ")}
    </span>
  );
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const { brand, business } = config;

export default function Admin() {
  return (
    <AdminGate>
      <AdminInner />
    </AdminGate>
  );
}

function AdminInner() {
  const [tab, setTab] = useState<Tab>("today");
  return (
    <div className="min-h-screen bg-sidebar text-sidebar-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-sidebar/95 backdrop-blur border-b border-sidebar-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sidebar-foreground/60 hover:text-sidebar-foreground" data-testid="link-back-site">
              <ChevronLeft className="size-5" />
            </Link>
            <div className="flex items-center gap-2">
              <BrandMark className="h-14 w-auto rounded-full" />
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">Admin</div>
                <div className="font-display font-bold text-sm leading-tight">{brand.shortName}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:text-sidebar-foreground" data-testid="button-notifications">
              <Bell className="size-5" />
            </Button>
            <AdminLogout />
          </div>
        </div>
      </header>

      {/* Body — light surface */}
      <main className="bg-background text-foreground rounded-t-3xl min-h-[calc(100vh-58px)] pb-24 sm:pb-6">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-5">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            {/* Desktop: grouped nav panel. Mobile uses the fixed bottom nav below. */}
            <Card className="hidden sm:block p-4 mb-6 space-y-3">
              <NavGroup label="Operations">
                <TabsList className="bg-transparent p-0 h-auto flex flex-wrap gap-2 justify-start">
                  <TabsTrigger className="flex-none px-3 py-1.5 text-sm" value="today" data-testid="tab-today"><Calendar className="size-4 mr-1.5" /> Today</TabsTrigger>
                  <TabsTrigger className="flex-none px-3 py-1.5 text-sm" value="schedule" data-testid="tab-schedule"><Clock className="size-4 mr-1.5" /> Schedule</TabsTrigger>
                  <TabsTrigger className="flex-none px-3 py-1.5 text-sm" value="hours" data-testid="tab-hours"><CalendarOff className="size-4 mr-1.5" /> Opening Hours</TabsTrigger>
                  <TabsTrigger className="flex-none px-3 py-1.5 text-sm" value="blocked" data-testid="tab-blocked"><Ban className="size-4 mr-1.5" /> Room Availability</TabsTrigger>
                </TabsList>
              </NavGroup>
              <NavGroup label="Content">
                <TabsList className="bg-transparent p-0 h-auto flex flex-wrap gap-2 justify-start">
                  <TabsTrigger className="flex-none px-3 py-1.5 text-sm" value="content" data-testid="tab-content"><FileText className="size-4 mr-1.5" /> Content</TabsTrigger>
                  <TabsTrigger className="flex-none px-3 py-1.5 text-sm" value="pages" data-testid="tab-pages"><Layers className="size-4 mr-1.5" /> Pages</TabsTrigger>
                  <TabsTrigger className="flex-none px-3 py-1.5 text-sm" value="reviews" data-testid="tab-reviews"><Star className="size-4 mr-1.5" /> Reviews</TabsTrigger>
                  <TabsTrigger className="flex-none px-3 py-1.5 text-sm" value="events" data-testid="tab-events"><PartyPopper className="size-4 mr-1.5" /> Events</TabsTrigger>
                </TabsList>
              </NavGroup>
              <NavGroup label="Setup">
                <TabsList className="bg-transparent p-0 h-auto flex flex-wrap gap-2 justify-start">
                  <TabsTrigger className="flex-none px-3 py-1.5 text-sm" value="business" data-testid="tab-business"><Building2 className="size-4 mr-1.5" /> Business</TabsTrigger>
                  <TabsTrigger className="flex-none px-3 py-1.5 text-sm" value="branding" data-testid="tab-branding"><Palette className="size-4 mr-1.5" /> Branding</TabsTrigger>
                  <TabsTrigger className="flex-none px-3 py-1.5 text-sm" value="policy" data-testid="tab-policy"><ScrollText className="size-4 mr-1.5" /> Policy</TabsTrigger>
                  <TabsTrigger className="flex-none px-3 py-1.5 text-sm" value="emails" data-testid="tab-emails"><Mail className="size-4 mr-1.5" /> Emails</TabsTrigger>
                  <TabsTrigger className="flex-none px-3 py-1.5 text-sm" value="payments" data-testid="tab-payments"><CreditCard className="size-4 mr-1.5" /> Payments</TabsTrigger>
                  <TabsTrigger className="flex-none px-3 py-1.5 text-sm" value="settings" data-testid="tab-settings"><SettingsIcon className="size-4 mr-1.5" /> Settings</TabsTrigger>
                </TabsList>
              </NavGroup>
            </Card>

            <TabsContent value="today"><TodayTab /></TabsContent>
            <TabsContent value="schedule"><ScheduleTab /></TabsContent>
            <TabsContent value="hours"><OpeningHoursTab /></TabsContent>
            <TabsContent value="blocked"><RoomAvailabilityTab /></TabsContent>
            <TabsContent value="content"><ContentTab /></TabsContent>
            <TabsContent value="pages"><PagesTab /></TabsContent>
            <TabsContent value="reviews"><ReviewsTab /></TabsContent>
            <TabsContent value="events"><EventsTab /></TabsContent>
            <TabsContent value="payments"><PaymentsTab /></TabsContent>
            <TabsContent value="business"><BusinessTab /></TabsContent>
            <TabsContent value="branding"><BrandingTab /></TabsContent>
            <TabsContent value="policy"><PolicyTab /></TabsContent>
            <TabsContent value="emails"><EmailsTab /></TabsContent>
            <TabsContent value="settings"><SettingsTab /></TabsContent>
          </Tabs>
        </div>

        {/* Mobile bottom nav */}
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-20 bg-card/95 backdrop-blur border-t border-card-border">
          <div className="grid grid-cols-6">
            {([
              ["today", Calendar, "Today"],
              ["schedule", Clock, "Schedule"],
              ["hours", CalendarOff, "Hours"],
              ["blocked", Ban, "Blocked"],
              ["content", FileText, "Content"],
              ["pages", Layers, "Pages"],
              ["reviews", Star, "Reviews"],
              ["events", PartyPopper, "Events"],
              ["payments", CreditCard, "Pay"],
              ["business", Building2, "Business"],
              ["branding", Palette, "Brand"],
              ["policy", ScrollText, "Policy"],
              ["emails", Mail, "Emails"],
              ["settings", SettingsIcon, "Settings"],
            ] as [Tab, typeof Calendar, string][]).map(([id, Icon, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                data-testid={`mobnav-${id}`}
                className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${tab === id ? "text-primary" : "text-muted-foreground"}`}
              >
                <Icon className="size-5" />
                {label}
              </button>
            ))}
          </div>
        </nav>
      </main>
    </div>
  );
}

// ============ TODAY ============
function TodayTab() {
  const today = todayIso();
  const week = addDays(today, 7);
  const { data: bookings = [], isLoading } = useQuery<AdminBooking[]>({
    queryKey: ["/api/admin/bookings", { from: today, to: week }],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/admin/bookings?from=${today}&to=${week}`);
      return r.json();
    },
  });

  const todays = bookings.filter((b) => b.date === today && b.status !== "cancelled");
  const upcoming = bookings.filter((b) => b.date > today && b.status !== "cancelled");
  const revenue = bookings.filter((b) => b.status === "confirmed" || b.status === "completed").reduce((sum, b) => sum + b.depositAmount, 0);

  return (
    <div className="space-y-5 mt-5">
      {/* Greeting */}
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="font-display text-3xl font-bold text-foreground mt-1">Hi {business.ownerName.split(" ")[0]}.</h1>
        <p className="text-muted-foreground">{todays.length === 0 ? "No bookings today — enjoy the breather." : `You've got ${todays.length} booking${todays.length === 1 ? "" : "s"} today.`}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Today" value={todays.length.toString()} />
        <Stat label="This week" value={upcoming.length.toString()} />
        <Stat label="Deposits" value={gbp(revenue)} />
      </div>

      {/* Today's list */}
      <section>
        <h2 className="font-display text-lg font-bold mb-3">Today's schedule</h2>
        {isLoading ? <SkeletonRow /> : todays.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">Nothing on for today.</Card>
        ) : (
          <div className="space-y-2">{todays.map((b) => <BookingRow key={b.id} booking={b} />)}</div>
        )}
      </section>

      {/* Upcoming */}
      <section>
        <h2 className="font-display text-lg font-bold mb-3">Coming up</h2>
        {upcoming.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">No upcoming bookings in the next 7 days.</Card>
        ) : (
          <div className="space-y-2">{upcoming.map((b) => <BookingRow key={b.id} booking={b} />)}</div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 sm:p-4 bg-card">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="font-display text-xl sm:text-2xl font-bold text-foreground mt-1">{value}</div>
    </Card>
  );
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-accent/20 text-accent-foreground border-accent/40",
  confirmed: "bg-secondary/15 text-secondary border-secondary/40",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  completed: "bg-muted text-muted-foreground border-muted-foreground/20",
};

function BookingRow({ booking }: { booking: AdminBooking }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Card
        className="p-4 bg-card hover-elevate cursor-pointer"
        data-testid={`row-booking-${booking.id}`}
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); } }}
      >
        <div className="flex items-start gap-3">
          <div className="text-center shrink-0 w-14">
            <div className="font-display text-lg font-bold text-foreground leading-tight">{booking.startTime}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{formatDateShort(booking.date)}</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-display font-bold text-foreground">{booking.customerName}</div>
                <div className="text-sm text-muted-foreground truncate">{booking.eventType || "Booking"} · {booking.partySize} guest{booking.partySize === 1 ? "" : "s"}</div>
              </div>
              <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${STATUS_STYLES[booking.status]}`}>{booking.status}</Badge>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>{gbp(booking.depositAmount)} deposit</span>
            </div>
            {booking.returningCustomer && booking.returningCustomer.visits > 0 && (
              <div className="mt-1.5">
                <ReturningBadge info={booking.returningCustomer} />
              </div>
            )}
          </div>
        </div>
      </Card>
      <BookingDetailDialog open={open} onClose={() => setOpen(false)} booking={booking} />
    </>
  );
}

function BookingDetailDialog({ open, onClose, booking }: { open: boolean; onClose: () => void; booking: AdminBooking }) {
  const { toast } = useToast();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);

  const generateLink = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/public/bookings/${booking.id}/sumup-checkout`);
      return res.json() as Promise<{ hostedCheckoutUrl?: string; error?: string }>;
    },
    onSuccess: (data) => {
      if (data.hostedCheckoutUrl) setPaymentLink(data.hostedCheckoutUrl);
    },
    onError: (e: unknown) => {
      const message = e instanceof Error ? e.message : "Could not generate a payment link";
      toast({ title: "Couldn't generate link", description: message, variant: "destructive" });
    },
  });

  async function copyLink() {
    if (!paymentLink) return;
    try {
      await navigator.clipboard.writeText(paymentLink);
      toast({ title: "Copied", description: "Payment link copied — send it to the customer." });
    } catch {
      toast({ title: "Couldn't copy", description: "Select and copy the link manually.", variant: "destructive" });
    }
  }

  const cancel = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/admin/bookings/${booking.id}/cancel`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
      toast({ title: "Booking cancelled", description: "The slot has been released." });
      setShowCancelConfirm(false);
      onClose();
    },
  });
  const complete = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/admin/bookings/${booking.id}/complete`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
      toast({ title: "Marked complete" });
      onClose();
    },
  });
  const confirm = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/admin/bookings/${booking.id}/confirm`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
      toast({ title: "Marked confirmed", description: "Customer's slot is locked in." });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Booking #{booking.id}
            <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${STATUS_STYLES[booking.status]}`}>{booking.status}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* When */}
          <section className="space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">When</div>
            <div className="font-display text-lg font-bold text-foreground">{formatDate(booking.date)} · {booking.startTime}</div>
            <div className="text-xs text-muted-foreground">{booking.eventType || "—"} · {booking.partySize} guest{booking.partySize === 1 ? "" : "s"}</div>
          </section>

          {/* Customer */}
          <section className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Customer</div>
            <div className="font-semibold text-foreground">{booking.customerName}</div>
            <div className="flex flex-col gap-0.5 text-xs">
              <a href={`mailto:${booking.customerEmail}`} className="text-primary hover:underline break-all" data-testid={`link-email-${booking.id}`}>{booking.customerEmail}</a>
              <a href={`tel:${booking.customerPhone}`} className="text-primary hover:underline" data-testid={`link-phone-${booking.id}`}>{booking.customerPhone}</a>
            </div>
          </section>

          {/* Payment */}
          <section className="space-y-1.5 rounded-lg bg-muted/40 border border-card-border p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Payment</div>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Deposit paid</span><span className="font-medium text-foreground">{gbp(booking.depositAmount)}</span></div>
            {booking.paymentRef && (
              <div className="flex justify-between text-xs pt-1 border-t border-card-border"><span className="text-muted-foreground">Payment ref</span><span className="font-mono text-foreground">{booking.paymentRef}</span></div>
            )}
            {booking.status === "pending" && (
              <div className="pt-2 border-t border-card-border">
                {paymentLink ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 bg-background rounded-md border border-card-border px-2 py-1.5">
                      <span className="text-xs font-mono text-foreground/80 truncate flex-1" data-testid={`text-payment-link-${booking.id}`}>{paymentLink}</span>
                      <Button size="icon" variant="ghost" className="size-6 shrink-0" onClick={copyLink} data-testid={`button-copy-payment-link-${booking.id}`}>
                        <Copy className="size-3.5" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Send this to the customer — it'll confirm the booking automatically once they pay.</p>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="w-full" onClick={() => generateLink.mutate()} disabled={generateLink.isPending} data-testid={`button-generate-link-${booking.id}`}>
                    {generateLink.isPending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Link2 className="size-3.5 mr-1" />} Generate payment link
                  </Button>
                )}
              </div>
            )}
          </section>

          {/* Notes */}
          {booking.notes && (
            <section className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Notes</div>
              <div className="rounded-md bg-muted p-2 text-xs text-foreground/80 whitespace-pre-wrap">{booking.notes}</div>
            </section>
          )}

          {/* DJ shout-outs */}
          {booking.shoutOuts && (
            <section className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">DJ shout-outs</div>
              <div className="rounded-md bg-muted p-2 text-xs text-foreground/80 whitespace-pre-wrap">{booking.shoutOuts}</div>
            </section>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
          <Button variant="ghost" size="sm" asChild><a href={`tel:${booking.customerPhone}`}>Call</a></Button>
          <Button variant="ghost" size="sm" asChild><a href={`mailto:${booking.customerEmail}`}>Email</a></Button>
          {booking.status === "pending" && (
            <Button size="sm" variant="outline" onClick={() => confirm.mutate()} disabled={confirm.isPending} data-testid={`button-confirm-${booking.id}`}>
              {confirm.isPending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="size-3.5 mr-1" />} Mark confirmed
            </Button>
          )}
          {booking.status === "confirmed" && (
            <Button size="sm" variant="outline" onClick={() => complete.mutate()} disabled={complete.isPending} data-testid={`button-complete-${booking.id}`}>
              {complete.isPending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="size-3.5 mr-1" />} Mark done
            </Button>
          )}
          {(booking.status === "pending" || booking.status === "confirmed") && (
            <Button size="sm" variant="destructive" onClick={() => setShowCancelConfirm(true)} data-testid={`button-cancel-${booking.id}`}>
              <X className="size-3.5 mr-1" /> Cancel booking
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Confirm cancel sub-dialog */}
      <Dialog open={showCancelConfirm} onOpenChange={(o) => !o && setShowCancelConfirm(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cancel this booking?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This releases the slot so other customers can book it. The booking will show as cancelled. This can't be undone.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCancelConfirm(false)}>Keep booking</Button>
            <Button variant="destructive" onClick={() => cancel.mutate()} disabled={cancel.isPending} data-testid={`button-confirm-cancel-${booking.id}`}>
              {cancel.isPending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <X className="size-3.5 mr-1" />} Cancel it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

// ============ SCHEDULE (full upcoming list) ============
function ScheduleTab() {
  const today = todayIso();
  const future = addDays(today, 90);
  const { data: bookings = [] } = useQuery<AdminBooking[]>({
    queryKey: ["/api/admin/bookings", { from: today, to: future }],
    queryFn: async () => (await apiRequest("GET", `/api/admin/bookings?from=${today}&to=${future}`)).json(),
  });
  const [addOpen, setAddOpen] = useState(false);

  // Group by date
  const grouped: Record<string, AdminBooking[]> = {};
  bookings.filter((b) => b.status !== "cancelled").forEach((b) => {
    grouped[b.date] = grouped[b.date] || [];
    grouped[b.date].push(b);
  });
  const dates = Object.keys(grouped).sort();

  return (
    <div className="space-y-5 mt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Schedule</h1>
          <p className="text-sm text-muted-foreground">All upcoming bookings.</p>
        </div>
        <Button onClick={() => setAddOpen(true)} data-testid="button-add-booking">
          <Plus className="size-4 mr-1" /> Add booking
        </Button>
      </div>
      <AddBookingDialog open={addOpen} onClose={() => setAddOpen(false)} />
      {dates.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">No upcoming bookings.</Card>
      ) : dates.map((d) => (
        <div key={d}>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">{formatDate(d)}</h3>
          <div className="space-y-2">{grouped[d].map((b) => <BookingRow key={b.id} booking={b} />)}</div>
        </div>
      ))}
    </div>
  );
}

function AddBookingDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { data: workingHours = [] } = useQuery<WorkingHours[]>({ queryKey: ["/api/admin/working-hours"] });
  const { data: settings } = useQuery<Settings>({ queryKey: ["/api/admin/settings"] });

  const emptyForm = {
    date: todayIso(),
    startTime: "",
    endTime: "",
    override: false,
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    eventType: "",
    partySize: "",
    notes: "",
    shoutOuts: "",
    status: "confirmed" as "confirmed" | "pending",
    depositAmount: "",
  };
  const [form, setForm] = useState(emptyForm);

  const { data: dateBookings = [] } = useQuery<AdminBooking[]>({
    queryKey: ["/api/admin/bookings", { from: form.date, to: form.date }],
    queryFn: async () => (await apiRequest("GET", `/api/admin/bookings?from=${form.date}&to=${form.date}`)).json(),
    enabled: open && !!form.date,
  });
  const bookedSlots = useMemo(
    () => dateBookings.filter((b) => b.status === "pending" || b.status === "confirmed"),
    [dateBookings]
  );

  const daySlots = useMemo(() => {
    const dow = new Date(form.date + "T00:00:00").getDay();
    return workingHours
      .filter((w) => w.dayOfWeek === dow && w.enabled)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((w) => ({ ...w, taken: bookedSlots.some((b) => slotsOverlap(w.startTime, w.endTime, b.startTime, b.endTime)) }));
  }, [workingHours, form.date, bookedSlots]);

  const create = useMutation({
    mutationFn: async () => {
      const body = {
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        customerPhone: form.customerPhone,
        eventType: form.eventType,
        partySize: Number(form.partySize),
        notes: form.notes,
        shoutOuts: form.shoutOuts,
        date: form.date,
        startTime: form.startTime,
        status: form.status,
        override: form.override,
        ...(form.override ? { endTime: form.endTime } : {}),
        ...(form.depositAmount ? { depositAmount: Number(form.depositAmount) } : {}),
      };
      return (await apiRequest("POST", "/api/admin/bookings", body)).json();
    },
    onSuccess: (data: { emailSent?: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
      const description = form.status !== "confirmed"
        ? "Marked as pending — no email sent yet."
        : data.emailSent
        ? `Confirmation emailed to ${form.customerEmail}.`
        : "No email on file — the customer wasn't notified.";
      toast({ title: "Booking added", description });
      setForm(emptyForm);
      onClose();
    },
    onError: (e: unknown) => {
      const message = e instanceof Error ? e.message : "Could not add booking";
      toast({ title: "Couldn't add booking", description: message, variant: "destructive" });
    },
  });

  function handleClose() {
    setForm(emptyForm);
    onClose();
  }

  const canSave = !!form.customerName.trim() && !!form.startTime && !!form.partySize && Number(form.partySize) >= 1
    && (!form.override || !!form.endTime);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add a booking</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">For phone or walk-in enquiries. Any slot not already booked that day can be added — or use Override to add one regardless.</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value, startTime: "", endTime: "" })} data-testid="input-addbooking-date" />
            </div>
            <div>
              <Label>Start time</Label>
              {form.override ? (
                <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} data-testid="input-addbooking-start-override" />
              ) : daySlots.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-2.5">No slots defined for this day — add one in Admin &gt; Hours, or use Override below.</p>
              ) : (
                <Select value={form.startTime} onValueChange={(v) => setForm({ ...form, startTime: v })}>
                  <SelectTrigger data-testid="select-addbooking-time"><SelectValue placeholder="Choose a slot" /></SelectTrigger>
                  <SelectContent>
                    {daySlots.map((w) => (
                      <SelectItem key={w.id} value={w.startTime} disabled={w.taken}>
                        {w.startTime} – {w.endTime}{w.taken ? " (booked)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {form.override && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>End time</Label>
                <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} data-testid="input-addbooking-end-override" />
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5 rounded-md border border-dashed border-card-border p-3">
            <Switch
              checked={form.override}
              onCheckedChange={(v) => setForm({ ...form, override: v, startTime: "", endTime: "" })}
              data-testid="switch-addbooking-override"
            />
            <div>
              <div className="text-sm font-medium text-foreground">Override</div>
              <p className="text-xs text-muted-foreground">
                Ignore defined slots and existing bookings — set any start/end time and add the booking regardless. For days with only one slot, or when the room can genuinely take more than the usual limit.
              </p>
            </div>
          </div>

          <div>
            <Label>Customer name</Label>
            <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Jane Doe" data-testid="input-addbooking-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Phone <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input type="tel" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} data-testid="input-addbooking-phone" />
            </div>
            <div>
              <Label>Email <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} data-testid="input-addbooking-email" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Occasion <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })} placeholder="Birthday, hen do…" data-testid="input-addbooking-occasion" />
            </div>
            <div>
              <Label>Party size</Label>
              <Input type="number" min={1} value={form.partySize} onChange={(e) => setForm({ ...form, partySize: e.target.value })} placeholder="e.g. 12" data-testid="input-addbooking-partysize" />
            </div>
          </div>

          <div>
            <Label>Notes <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="input-addbooking-notes" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "confirmed" | "pending" })}>
                <SelectTrigger data-testid="select-addbooking-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Deposit <span className="text-muted-foreground font-normal text-xs">(optional override)</span></Label>
              <Input type="number" min={0} value={form.depositAmount} onChange={(e) => setForm({ ...form, depositAmount: e.target.value })} placeholder={settings ? gbp(settings.depositAmount) : ""} data-testid="input-addbooking-deposit" />
            </div>
          </div>
          {form.status === "confirmed" && !form.customerEmail.trim() && (
            <p className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1.5" data-testid="text-addbooking-noemail-warning">
              <AlertCircle className="size-3.5 shrink-0" /> No email entered — the customer won't get a confirmation email.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!canSave || create.isPending} data-testid="button-save-addbooking">
            {create.isPending && <Loader2 className="size-4 mr-1 animate-spin" />} Add booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ AVAILABILITY ============
interface HoursRow {
  id: number;
  dayOfWeek: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

// Shared editor — used for both the bar's general opening hours (display
// only) and the room-hire booking hours (drives actual availability). Same
// mechanism, different data source, since they can legitimately differ.
function WeeklyHoursEditor({
  description,
  footnote,
  apiPath,
  testIdPrefix,
  defaultSlot,
}: {
  description: string;
  footnote: string;
  apiPath: string;
  testIdPrefix: string;
  defaultSlot: { startTime: string; endTime: string };
}) {
  const { toast } = useToast();
  const { data: hours = [] } = useQuery<HoursRow[]>({ queryKey: [apiPath] });
  const [local, setLocal] = useState<HoursRow[] | null>(null);

  const current = local ?? hours;

  const save = useMutation({
    mutationFn: async () => {
      const body = current.map(({ id, ...rest }) => rest);
      return (await apiRequest("PUT", apiPath, body)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiPath] });
      setLocal(null);
      toast({ title: "Hours saved" });
    },
  });

  const updateSlot = (id: number, patch: Partial<HoursRow>) => {
    setLocal(current.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  };
  const addSlot = (dayOfWeek: number) => {
    const tempId = -(Date.now() + Math.floor(Math.random() * 1000));
    setLocal([...current, { id: tempId, dayOfWeek, enabled: true, ...defaultSlot }]);
  };
  const removeSlot = (id: number) => {
    setLocal(current.filter((w) => w.id !== id));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{description}</p>

      <Card className="p-2 bg-card divide-y divide-card-border">
        {DAYS.map((dayName, d) => {
          const rows = current.filter((w) => w.dayOfWeek === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
          return (
            <div key={d} className="p-3 space-y-2" data-testid={`row-${testIdPrefix}-${d}`}>
              <div className="flex items-center justify-between">
                <div className="font-medium text-foreground">{dayName}</div>
                <Button size="sm" variant="ghost" onClick={() => addSlot(d)} data-testid={`button-add-${testIdPrefix}-slot-${d}`}>
                  <Plus className="size-3.5 mr-1" /> Add slot
                </Button>
              </div>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Closed</p>
              ) : (
                <div className="space-y-2">
                  {rows.map((w) => (
                    <div key={w.id} className="flex flex-wrap items-center gap-2" data-testid={`row-${testIdPrefix}-slot-${w.id}`}>
                      <Switch checked={w.enabled} onCheckedChange={(v) => updateSlot(w.id, { enabled: v })} data-testid={`switch-${testIdPrefix}-slot-${w.id}`} />
                      <div className="flex items-center gap-2 w-full pl-[2.75rem] sm:w-auto sm:flex-1 sm:ml-1 sm:pl-0">
                        <Input type="time" value={w.startTime} onChange={(e) => updateSlot(w.id, { startTime: e.target.value })} className="w-28 min-w-0" data-testid={`input-${testIdPrefix}-slot-start-${w.id}`} />
                        <span className="text-muted-foreground shrink-0">to</span>
                        <Input type="time" value={w.endTime} onChange={(e) => updateSlot(w.id, { endTime: e.target.value })} className="w-28 min-w-0" data-testid={`input-${testIdPrefix}-slot-end-${w.id}`} />
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => removeSlot(w.id)} data-testid={`button-remove-${testIdPrefix}-slot-${w.id}`}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </Card>
      <p className="text-xs text-muted-foreground">{footnote}</p>
      {local && (
        <div className="flex gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid={`button-save-${testIdPrefix}`}>
            {save.isPending && <Loader2 className="size-4 mr-1 animate-spin" />} Save changes
          </Button>
          <Button variant="ghost" onClick={() => setLocal(null)}>Reset</Button>
        </div>
      )}
    </div>
  );
}

function OpeningHoursTab() {
  return (
    <div className="space-y-6 mt-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Opening hours</h1>
        <p className="text-sm text-muted-foreground -mt-1">The bar's general hours — shown on the site. Separate from when the room can actually be booked (see Room Availability) — the bar can be open at different times to room hire.</p>
      </div>
      <WeeklyHoursEditor
        description="Shown in the site header, footer and contact page."
        footnote="A day can have more than one slot if needed, e.g. a daytime and an evening session."
        apiPath="/api/admin/bar-hours"
        testIdPrefix="bar"
        defaultSlot={{ startTime: "17:00", endTime: "23:00" }}
      />
    </div>
  );
}

function RoomAvailabilityTab() {
  const { toast } = useToast();
  const { data: blocked = [] } = useQuery<BlockedDate[]>({ queryKey: ["/api/admin/blocked-dates"] });

  const [blockDate, setBlockDate] = useState(todayIso());
  const [blockReason, setBlockReason] = useState("");
  const addBlock = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/admin/blocked-dates", { date: blockDate, reason: blockReason })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blocked-dates"] });
      setBlockReason("");
      toast({ title: "Date blocked" });
    },
  });
  const removeBlock = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/admin/blocked-dates/${id}`)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/blocked-dates"] }),
  });

  return (
    <div className="space-y-8 mt-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Room availability</h1>
        <p className="text-sm text-muted-foreground -mt-1">Controls when the room can actually be booked online.</p>
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-lg font-bold">Room hire hours</h2>
        <WeeklyHoursEditor
          description="Customers can only book within these hours."
          footnote="A day can have more than one slot — e.g. an afternoon session and a separate evening one. Each is a distinct bookable start time."
          apiPath="/api/admin/working-hours"
          testIdPrefix="hours"
          defaultSlot={{ startTime: "13:00", endTime: "17:00" }}
        />
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-lg font-bold">Blocked dates</h2>
        <p className="text-sm text-muted-foreground -mt-2">One-off dates the room can't be booked, even within the hours above — holidays, private events, maintenance, etc.</p>
        <Card className="p-4 bg-card">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={blockDate} onChange={(e) => setBlockDate(e.target.value)} data-testid="input-block-date" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label>Reason (optional)</Label>
              <Input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Holiday, personal, etc." data-testid="input-block-reason" />
            </div>
            <Button onClick={() => addBlock.mutate()} data-testid="button-add-block">Block date</Button>
          </div>
        </Card>
        <div className="space-y-2">
          {blocked.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No blocked dates.</p>
          ) : blocked.map((b) => (
            <Card key={b.id} className="p-3 flex items-center justify-between bg-card">
              <div>
                <div className="font-medium">{formatDate(b.date)}</div>
                {b.reason && <div className="text-xs text-muted-foreground">{b.reason}</div>}
              </div>
              <Button size="icon" variant="ghost" onClick={() => removeBlock.mutate(b.id)} data-testid={`button-remove-block-${b.id}`}>
                <Trash2 className="size-4" />
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ CONTENT ============
function ContentTab() {
  const { c, ready } = useContent();
  const { items: galleryItems, refresh: refreshGallery } = useGalleryItems();
  const { uploadImage, insertGalleryItem, updateGalleryItem, deleteGalleryItem } = useContentMutations();
  const { toast } = useToast();
  const { copy, business, brand, seo } = config;
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // We need useRef for the gallery multi-upload input
  // Use a callback to create it lazily
  function handleGalleryFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setGalleryUploading(true);
    let failed = 0;
    const uploads = Array.from(files).map(async (file, i) => {
      try {
        const url = await uploadImage(file);
        await insertGalleryItem.mutateAsync({
          imageUrl: url,
          caption: null,
          category: null,
          sortOrder: Date.now() + i,
          active: true,
        });
      } catch (e: unknown) {
        failed += 1;
        const msg = e instanceof Error ? e.message : "Upload failed";
        toast({ title: `Couldn't add ${file.name}`, description: msg, variant: "destructive" });
      }
    });
    // Individual failures already toast above — only claim success here for
    // what actually saved, instead of always showing "Gallery updated"
    // regardless of whether every upload failed.
    Promise.all(uploads).finally(() => {
      setGalleryUploading(false);
      refreshGallery();
      const succeeded = files.length - failed;
      if (succeeded > 0) {
        toast({ title: `${succeeded} photo${succeeded === 1 ? "" : "s"} added` });
      }
    });
  }

  async function moveItem(item: GalleryItem, direction: "up" | "down") {
    const sorted = [...galleryItems].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((i) => i.id === item.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swapItem = sorted[swapIdx];
    await updateGalleryItem.mutateAsync({ id: item.id, sortOrder: swapItem.sortOrder });
    await updateGalleryItem.mutateAsync({ id: swapItem.id, sortOrder: item.sortOrder });
  }

  async function confirmDelete(id: number) {
    try {
      await deleteGalleryItem.mutateAsync(id);
      toast({ title: "Item deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setConfirmDeleteId(null);
    }
  }

  if (!ready) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="size-5 animate-spin inline" />
        <p className="text-sm text-muted-foreground mt-2">Loading content…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 mt-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Content</h1>
        <p className="text-sm text-muted-foreground mt-1">Edit your website text and images. Changes save automatically.</p>
      </div>

      <Accordion type="multiple" className="space-y-3">

        {/* HOME PAGE */}
        <AccordionItem value="home" className="border border-border rounded-xl overflow-hidden">
          <AccordionTrigger className="px-4 py-3 font-display font-bold hover:no-underline">
            Home page
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-5 space-y-5">
            <div>
              <Label className="mb-1 block">Hero Title <span className="text-xs font-normal text-muted-foreground">— shown at the top of the home page</span></Label>
              <InlineText contentKey="home.heroTitle" value={c("home.heroTitle", copy.heroTitle)} placeholder={copy.heroTitle} label="Hero title" />
            </div>
            <div>
              <Label className="mb-1 block">Hero Accent <span className="text-xs font-normal text-muted-foreground">— the italic words at the end of the title</span></Label>
              <InlineText contentKey="home.heroAccent" value={c("home.heroAccent", copy.heroTitle.split(" ").slice(-2).join(" "))} placeholder="Pampered Perfection" label="Hero accent" />
            </div>
            <div>
              <Label className="mb-1 block">Hero Body <span className="text-xs font-normal text-muted-foreground">— paragraph below the headline</span></Label>
              <InlineText contentKey="home.heroBody" value={c("home.heroBody", copy.heroSubtitle)} variant="textarea" rows={4} label="Hero body" />
            </div>
            <div>
              <Label className="mb-1 block">Hero Image</Label>
              <ImageDropzone contentKey="home.heroImage" currentUrl={c("home.heroImage", "")} alt="Hero image" />
            </div>
            <div>
              <Label className="mb-1 block">Trust Badges <span className="text-xs font-normal text-muted-foreground">— one per line</span></Label>
              <InlineText contentKey="home.bullets" value={c("home.bullets", copy.homeBullets.join("\n"))} variant="textarea" rows={5} label="Trust badges" />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ABOUT PAGE */}
        <AccordionItem value="about" className="border border-border rounded-xl overflow-hidden">
          <AccordionTrigger className="px-4 py-3 font-display font-bold hover:no-underline">
            About page
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-5 space-y-5">
            <div>
              <Label className="mb-1 block">Title</Label>
              <InlineText contentKey="about.title" value={c("about.title", copy.aboutTitle)} label="About title" />
            </div>
            <div>
              <Label className="mb-1 block">Body <span className="text-xs font-normal text-muted-foreground">— separate paragraphs with a blank line</span></Label>
              <InlineText contentKey="about.body" value={c("about.body", copy.aboutBody)} variant="textarea" rows={10} label="About body" />
            </div>
            <div>
              <Label className="mb-1 block">About Image</Label>
              <ImageDropzone contentKey="about.image" currentUrl={c("about.image", "")} alt="About image" />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* HOW IT WORKS */}
        <AccordionItem value="how-it-works" className="border border-border rounded-xl overflow-hidden">
          <AccordionTrigger className="px-4 py-3 font-display font-bold hover:no-underline">
            How it works page
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-5 space-y-5">
            <div>
              <Label className="mb-1 block">Title</Label>
              <InlineText contentKey="howItWorks.title" value={c("howItWorks.title", copy.howItWorksTitle)} label="How it works title" />
            </div>
            <div>
              <Label className="mb-1 block">Intro</Label>
              <InlineText contentKey="howItWorks.intro" value={c("howItWorks.intro", copy.howItWorksIntro)} variant="textarea" rows={2} label="How it works intro" />
            </div>
            <div>
              <Label className="mb-1 block">Steps <span className="text-xs font-normal text-muted-foreground">— one step per line, shown in order</span></Label>
              <InlineText contentKey="howItWorks.steps" value={c("howItWorks.steps", copy.howItWorksSteps.join("\n"))} variant="textarea" rows={8} label="How it works steps" />
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <Label className="mb-1 block">Photo 1 — The room</Label>
                <ImageDropzone contentKey="howItWorks.photo1" currentUrl={c("howItWorks.photo1", "")} alt="The room" />
              </div>
              <div>
                <Label className="mb-1 block">Photo 2 — Grab the mic</Label>
                <ImageDropzone contentKey="howItWorks.photo2" currentUrl={c("howItWorks.photo2", "")} alt="Grab the mic" />
              </div>
              <div>
                <Label className="mb-1 block">Photo 3 — Good times</Label>
                <ImageDropzone contentKey="howItWorks.photo3" currentUrl={c("howItWorks.photo3", "")} alt="Good times" />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* GALLERY */}
        <AccordionItem value="gallery" className="border border-border rounded-xl overflow-hidden">
          <AccordionTrigger className="px-4 py-3 font-display font-bold hover:no-underline">
            Gallery
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-5 space-y-5">
            {/* Multi-upload drop zone */}
            <div>
              <Label className="mb-2 block">Upload new images <span className="text-xs font-normal text-muted-foreground">— you can pick multiple at once</span></Label>
              <div
                role="button"
                tabIndex={0}
                onClick={() => galleryInputRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && galleryInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-muted/50 cursor-pointer transition-colors touch-manipulation"
              >
                {galleryUploading ? (
                  <><Loader2 className="size-6 text-muted-foreground animate-spin" /><p className="text-sm text-muted-foreground">Uploading…</p></>
                ) : (
                  <><ImageIcon className="size-6 text-muted-foreground" /><p className="text-sm text-center text-muted-foreground"><span className="font-semibold text-foreground">Drop images or tap to upload</span><br /><span className="text-xs">Multiple files at once supported</span></p></>
                )}
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => handleGalleryFiles(e.target.files)}
                  data-testid="input-gallery-upload"
                />
              </div>
            </div>

            {/* Gallery grid */}
            {galleryItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No gallery images yet. Upload some above.</p>
            ) : (
              <div className="space-y-3">
                {[...galleryItems].sort((a, b) => a.sortOrder - b.sortOrder).map((item, idx, arr) => (
                  <Card key={item.id} className="relative p-3 flex gap-3 items-start bg-card">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(item.id)}
                      aria-label="Delete photo"
                      title="Delete photo"
                      className="absolute top-1.5 right-1.5 z-10 grid place-items-center size-7 rounded-full bg-white/90 text-destructive shadow-sm ring-1 ring-destructive/20 hover:bg-white hover:ring-destructive/40 transition-colors"
                      data-testid={`button-gallery-delete-${item.id}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                    <div className="size-16 rounded-md overflow-hidden shrink-0 bg-muted">
                      <img src={item.imageUrl} alt={item.caption ?? "Gallery item"} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2 pr-8">
                      <Input
                        placeholder="Caption (optional)"
                        defaultValue={item.caption ?? ""}
                        onBlur={(e) => updateGalleryItem.mutate({ id: item.id, caption: e.target.value || null })}
                        className="w-full text-sm h-8"
                        data-testid={`input-gallery-caption-${item.id}`}
                      />
                      <Input
                        placeholder="Category (optional)"
                        defaultValue={item.category ?? ""}
                        onBlur={(e) => updateGalleryItem.mutate({ id: item.id, category: e.target.value || null })}
                        className="w-full text-sm h-8"
                        data-testid={`input-gallery-category-${item.id}`}
                      />
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => moveItem(item, "up")} disabled={idx === 0} data-testid={`button-gallery-up-${item.id}`}>
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => moveItem(item, "down")} disabled={idx === arr.length - 1} data-testid={`button-gallery-down-${item.id}`}>
                        <ChevronDown className="size-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Delete confirm dialog */}
            <Dialog open={confirmDeleteId !== null} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
              <DialogContent>
                <DialogHeader><DialogTitle>Delete image?</DialogTitle></DialogHeader>
                <p className="text-sm text-muted-foreground">This will remove the image from your gallery. You cannot undo this.</p>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                  <Button variant="destructive" onClick={() => confirmDeleteId !== null && confirmDelete(confirmDeleteId)}>Delete</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </AccordionContent>
        </AccordionItem>

        {/* CONTACT */}
        <AccordionItem value="contact" className="border border-border rounded-xl overflow-hidden">
          <AccordionTrigger className="px-4 py-3 font-display font-bold hover:no-underline">
            Contact details
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1 block">Phone <span className="text-xs font-normal text-muted-foreground">e.g. +447591134200</span></Label>
                <InlineText contentKey="contact.phone" value={c("contact.phone", business.phone)} label="Phone" />
              </div>
              <div>
                <Label className="mb-1 block">Phone display <span className="text-xs font-normal text-muted-foreground">e.g. +44 7591 134200</span></Label>
                <InlineText contentKey="contact.phoneDisplay" value={c("contact.phoneDisplay", business.phoneDisplay)} label="Phone display" />
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Email</Label>
              <InlineText contentKey="contact.email" value={c("contact.email", business.email)} label="Email" />
            </div>
            <div>
              <Label className="mb-1 block">Address line 1</Label>
              <InlineText contentKey="contact.addressLine1" value={c("contact.addressLine1", business.address.line1)} label="Address line 1" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1 block">City</Label>
                <InlineText contentKey="contact.city" value={c("contact.city", business.address.city)} label="City" />
              </div>
              <div>
                <Label className="mb-1 block">Postcode</Label>
                <InlineText contentKey="contact.postcode" value={c("contact.postcode", business.address.postcode)} label="Postcode" />
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Instagram handle <span className="text-xs font-normal text-muted-foreground">— without the @</span></Label>
              <InlineText contentKey="contact.instagram" value={c("contact.instagram", brand.instagram ?? "")} label="Instagram" />
            </div>
            <div>
              <Label className="mb-1 block">Hours note <span className="text-xs font-normal text-muted-foreground">— free-form note shown beside opening hours</span></Label>
              <InlineText contentKey="contact.hoursNote" value={c("contact.hoursNote", "")} variant="textarea" rows={2} placeholder="e.g. Sunday by request only" label="Hours note" />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* FOOTER / SEO */}
        <AccordionItem value="seo" className="border border-border rounded-xl overflow-hidden">
          <AccordionTrigger className="px-4 py-3 font-display font-bold hover:no-underline">
            Footer &amp; SEO
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-5 space-y-5">
            <div>
              <Label className="mb-1 block">Page title <span className="text-xs font-normal text-muted-foreground">— shown in browser tab and Google results</span></Label>
              <InlineText contentKey="seo.title" value={c("seo.title", seo.defaultTitle)} label="SEO title" />
            </div>
            <div>
              <Label className="mb-1 block">Meta description <span className="text-xs font-normal text-muted-foreground">— 150–160 characters for best Google display</span></Label>
              <InlineText contentKey="seo.description" value={c("seo.description", seo.defaultDescription)} variant="textarea" rows={3} label="SEO description" />
            </div>
            <div>
              <Label className="mb-1 block">Social share image (OG Image)</Label>
              <ImageDropzone contentKey="seo.ogImage" currentUrl={c("seo.ogImage", seo.ogImage)} alt="OG image" />
            </div>
            <div>
              <Label className="mb-1 block">Logo image <span className="text-xs font-normal text-muted-foreground">— replaces the logo across the entire site</span></Label>
              <ImageDropzone contentKey="brand.logo" currentUrl={c("brand.logo", brand.logoPath)} alt="Logo" />
            </div>
          </AccordionContent>
        </AccordionItem>

      </Accordion>
    </div>
  );
}

// ============ PAGES ============
function PagesTab() {
  const { toast } = useToast();
  const { data: allPages = [], isLoading } = useQuery<SitePage[]>({ queryKey: ["/api/admin/pages"] });
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<SitePage | null>(null);
  const [renaming, setRenaming] = useState<SitePage | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const sorted = [...allPages].sort((a, b) => a.sortOrder - b.sortOrder);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/pages"] });
    queryClient.invalidateQueries({ queryKey: ["/api/public/pages"] });
  }

  async function move(page: SitePage, direction: "up" | "down") {
    const idx = sorted.findIndex((p) => p.id === page.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swap = sorted[swapIdx];
    await apiRequest("PATCH", `/api/admin/pages/${page.id}`, { sortOrder: swap.sortOrder });
    await apiRequest("PATCH", `/api/admin/pages/${swap.id}`, { sortOrder: page.sortOrder });
    invalidate();
  }

  async function toggleVisible(page: SitePage) {
    await apiRequest("PATCH", `/api/admin/pages/${page.id}`, { visible: !page.visible });
    invalidate();
  }

  const deletePage = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/admin/pages/${id}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "Page deleted" });
      setConfirmDeleteId(null);
    },
  });

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="size-5 animate-spin inline" />
        <p className="text-sm text-muted-foreground mt-2">Loading pages…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Pages</h1>
          <p className="text-sm text-muted-foreground">Reorder, hide or add pages. This controls the site's navigation menu.</p>
        </div>
        <Button onClick={() => setAddOpen(true)} data-testid="button-add-page">
          <Plus className="size-4 mr-1" /> Add page
        </Button>
      </div>

      <div className="space-y-2">
        {sorted.map((page, i) => (
          <Card key={page.id} className="p-4 bg-card" data-testid={`row-page-${page.slug}`}>
            <div className="flex items-center gap-3">
              <div className="flex flex-col shrink-0">
                <button
                  type="button"
                  onClick={() => move(page, "up")}
                  disabled={i === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Move up"
                  data-testid={`button-page-up-${page.slug}`}
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(page, "down")}
                  disabled={i === sorted.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Move down"
                  data-testid={`button-page-down-${page.slug}`}
                >
                  <ChevronDown className="size-4" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display font-bold text-foreground">{page.navLabel}</span>
                  <Badge variant="outline" className="text-[10px]">{page.kind === "core" ? "Core" : PAGE_LAYOUTS.find((l) => l.id === page.layout)?.label ?? page.layout}</Badge>
                  {!page.visible && <Badge variant="outline" className="text-[10px]">Hidden</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">{page.path}</p>
                {page.kind === "core" && (
                  <p className="text-xs text-muted-foreground mt-1">Edit its copy in the Content tab.</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleVisible(page)}
                  className="text-muted-foreground hover:text-foreground p-1.5"
                  aria-label={page.visible ? "Hide from menu" : "Show in menu"}
                  data-testid={`button-page-visible-${page.slug}`}
                >
                  {page.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </button>
                {page.kind === "custom" ? (
                  <>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(page)} data-testid={`button-edit-page-${page.slug}`}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setConfirmDeleteId(page.id)} data-testid={`button-delete-page-${page.slug}`}>
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                ) : (
                  <Button size="icon" variant="ghost" onClick={() => setRenaming(page)} data-testid={`button-rename-page-${page.slug}`}>
                    <Pencil className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <AddPageDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={(p) => { invalidate(); setEditing(p); }} />
      {editing && <PageContentDialog page={editing} onClose={() => setEditing(null)} />}
      {renaming && <RenamePageDialog page={renaming} onClose={() => setRenaming(null)} />}

      <Dialog open={confirmDeleteId !== null} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete this page?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This removes it from the menu and deletes its content. This can't be undone.</p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDeleteId !== null && deletePage.mutate(confirmDeleteId)} disabled={deletePage.isPending} data-testid="button-confirm-delete-page">
              {deletePage.isPending && <Loader2 className="size-4 mr-1 animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function AddPageDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (page: SitePage) => void }) {
  const { toast } = useToast();
  const [navLabel, setNavLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [layout, setLayout] = useState<string>(PAGE_LAYOUTS[0].id);

  function reset() {
    setNavLabel("");
    setSlug("");
    setSlugTouched(false);
    setLayout(PAGE_LAYOUTS[0].id);
  }

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/pages", { navLabel, slug, layout });
      return res.json() as Promise<SitePage>;
    },
    onSuccess: (page) => {
      toast({ title: "Page created", description: "Add its content below." });
      reset();
      onClose();
      onCreated(page);
    },
    onError: (e: unknown) => {
      const message = e instanceof Error ? e.message : "Could not create page";
      toast({ title: "Couldn't create page", description: message, variant: "destructive" });
    },
  });

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add a page</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Page name</Label>
            <Input
              value={navLabel}
              onChange={(e) => {
                setNavLabel(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              placeholder="e.g. FAQ"
              data-testid="input-new-page-label"
            />
          </div>
          <div>
            <Label>URL</Label>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-muted-foreground font-mono">/p/</span>
              <Input
                value={slug}
                onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
                placeholder="faq"
                className="font-mono"
                data-testid="input-new-page-slug"
              />
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Layout</Label>
            <div className="grid gap-2">
              {PAGE_LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLayout(l.id)}
                  className={`text-left rounded-xl border p-3 transition-colors ${layout === l.id ? "border-primary bg-primary/5" : "border-card-border hover-elevate"}`}
                  data-testid={`button-layout-${l.id}`}
                >
                  <p className="font-semibold text-sm">{l.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{l.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !navLabel.trim() || !slug.trim()}
            data-testid="button-create-page"
          >
            {create.isPending && <Loader2 className="size-4 mr-1 animate-spin" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenamePageDialog({ page, onClose }: { page: SitePage; onClose: () => void }) {
  const { toast } = useToast();
  const [navLabel, setNavLabel] = useState(page.navLabel);

  const save = useMutation({
    mutationFn: async () => (await apiRequest("PATCH", `/api/admin/pages/${page.id}`, { navLabel })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/pages"] });
      toast({ title: "Page renamed" });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Rename "{page.navLabel}"</DialogTitle></DialogHeader>
        <div>
          <Label>Menu name</Label>
          <Input value={navLabel} onChange={(e) => setNavLabel(e.target.value)} data-testid="input-rename-page" />
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !navLabel.trim()} data-testid="button-save-rename-page">
            {save.isPending && <Loader2 className="size-4 mr-1 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PageContentDialog({ page, onClose }: { page: SitePage; onClose: () => void }) {
  const { toast } = useToast();
  const { c } = useContent();
  const slug = page.slug;
  const [layout, setLayout] = useState(page.layout ?? PAGE_LAYOUTS[0].id);

  const changeLayout = useMutation({
    mutationFn: async (newLayout: string) => (await apiRequest("PATCH", `/api/admin/pages/${page.id}`, { layout: newLayout })).json(),
    onSuccess: (_data, newLayout) => {
      setLayout(newLayout);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/pages"] });
      toast({ title: "Layout updated" });
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{page.navLabel}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Layout <span className="text-xs font-normal text-muted-foreground">— switching may leave some old fields unused below</span></Label>
            <div className="grid gap-2">
              {PAGE_LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => l.id !== layout && changeLayout.mutate(l.id)}
                  disabled={changeLayout.isPending}
                  className={`text-left rounded-xl border p-3 transition-colors ${layout === l.id ? "border-primary bg-primary/5" : "border-card-border hover-elevate"}`}
                  data-testid={`button-change-layout-${l.id}`}
                >
                  <p className="font-semibold text-sm">{l.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{l.description}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-1 block">Title</Label>
            <InlineText contentKey={`page.${slug}.title`} value={c(`page.${slug}.title`, page.navLabel)} label="Title" />
          </div>
          <div>
            <Label className="mb-1 block">Intro</Label>
            <InlineText contentKey={`page.${slug}.intro`} value={c(`page.${slug}.intro`, "")} variant="textarea" rows={2} label="Intro" />
          </div>

          {layout === "steps" && (
            <>
              <div>
                <Label className="mb-1 block">Steps <span className="text-xs font-normal text-muted-foreground">— one per line, shown in order</span></Label>
                <InlineText contentKey={`page.${slug}.steps`} value={c(`page.${slug}.steps`, "")} variant="textarea" rows={8} label="Steps" />
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                {[1, 2, 3].map((n) => (
                  <div key={n}>
                    <Label className="mb-1 block">Photo {n}</Label>
                    <ImageDropzone contentKey={`page.${slug}.photo${n}`} currentUrl={c(`page.${slug}.photo${n}`, "")} alt={`Photo ${n}`} />
                  </div>
                ))}
              </div>
            </>
          )}

          {layout === "story" && (
            <>
              <div>
                <Label className="mb-1 block">Body <span className="text-xs font-normal text-muted-foreground">— separate paragraphs with a blank line</span></Label>
                <InlineText contentKey={`page.${slug}.body`} value={c(`page.${slug}.body`, "")} variant="textarea" rows={10} label="Body" />
              </div>
              <div>
                <Label className="mb-1 block">Image</Label>
                <ImageDropzone contentKey={`page.${slug}.image`} currentUrl={c(`page.${slug}.image`, "")} alt="Story image" />
              </div>
            </>
          )}

          {(layout === "simple" || layout === "promo") && (
            <>
              <div>
                <Label className="mb-1 block">Body</Label>
                <InlineText contentKey={`page.${slug}.body`} value={c(`page.${slug}.body`, "")} variant="textarea" rows={6} label="Body" />
              </div>
              <div>
                <Label className="mb-1 block">Image {layout === "promo" && <span className="text-xs font-normal text-muted-foreground">— shown as a full-width background</span>}</Label>
                <ImageDropzone contentKey={`page.${slug}.image`} currentUrl={c(`page.${slug}.image`, "")} alt="Page image" />
              </div>
            </>
          )}

          {layout === "gallery" && (
            <div className="grid sm:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n}>
                  <Label className="mb-1 block">Photo {n}</Label>
                  <ImageDropzone contentKey={`page.${slug}.photo${n}`} currentUrl={c(`page.${slug}.photo${n}`, "")} alt={`Photo ${n}`} />
                </div>
              ))}
            </div>
          )}

          {layout === "faq" && (
            <div>
              <Label className="mb-1 block">Questions &amp; answers <span className="text-xs font-normal text-muted-foreground">— question on the first line, answer below, blank line between each</span></Label>
              <InlineText
                contentKey={`page.${slug}.faq`}
                value={c(`page.${slug}.faq`, "")}
                variant="textarea"
                rows={10}
                placeholder={"Is the room really exclusive?\nYes — once booked, it's yours for the whole session, no sharing.\n\nWhat happens to my deposit?\nIt comes straight back to you as a bar tab on the night."}
                label="FAQ"
              />
            </div>
          )}

          {layout === "testimonials" && (
            <p className="text-xs text-muted-foreground">This page shows your full review list automatically — manage reviews in the Reviews tab.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-close-page-content">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ REVIEWS ============
function ReviewsTab() {
  const { toast } = useToast();
  const { data: reviews = [] } = useQuery<Review[]>({ queryKey: ["/api/admin/reviews"] });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Review | null>(null);

  return (
    <div className="space-y-4 mt-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Reviews</h1>
          <p className="text-sm text-muted-foreground">Only active reviews show on the website.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} data-testid="button-add-review">
          <Plus className="size-4 mr-1" /> Add
        </Button>
      </div>

      {reviews.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">No reviews yet. Add your first one.</Card>
      ) : (
        <div className="space-y-2">
          {reviews.map((r) => (
            <Card key={r.id} className="p-4 bg-card hover-elevate" data-testid={`row-review-${r.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-foreground">{r.authorName}</span>
                    {!r.active && <Badge variant="outline" className="text-[10px]">Hidden</Badge>}
                  </div>
                  <div className="flex gap-0.5 mt-1">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <Star key={i} className="size-3 fill-accent text-accent" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{r.body}</p>
                  <p className="text-xs text-muted-foreground mt-1">{r.publishedAt}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }} data-testid={`button-edit-review-${r.id}`}>
                  <Pencil className="size-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ReviewDialog open={open} onClose={() => setOpen(false)} review={editing} />
    </div>
  );
}

function ReviewDialog({ open, onClose, review }: { open: boolean; onClose: () => void; review: Review | null }) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    authorName: review?.authorName ?? "",
    rating: review?.rating ?? 5,
    body: review?.body ?? "",
    publishedAt: review?.publishedAt ?? today,
    active: review?.active ?? true,
    sortOrder: review?.sortOrder ?? 0,
  });

  useState(() => {
    setForm({
      authorName: review?.authorName ?? "",
      rating: review?.rating ?? 5,
      body: review?.body ?? "",
      publishedAt: review?.publishedAt ?? today,
      active: review?.active ?? true,
      sortOrder: review?.sortOrder ?? 0,
    });
  });

  const save = useMutation({
    mutationFn: async () => {
      if (review) {
        return (await apiRequest("PATCH", `/api/admin/reviews/${review.id}`, form)).json();
      }
      return (await apiRequest("POST", "/api/admin/reviews", form)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/reviews"] });
      toast({ title: review ? "Review updated" : "Review added" });
      onClose();
    },
  });

  const remove = useMutation({
    mutationFn: async () => (await apiRequest("DELETE", `/api/admin/reviews/${review!.id}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/reviews"] });
      toast({ title: "Review deleted" });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{review ? "Edit review" : "New review"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Author name</Label>
            <Input value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} placeholder="Sarah W." data-testid="input-review-author" />
          </div>
          <div>
            <Label>Rating</Label>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm({ ...form, rating: n })}
                  className="p-0.5"
                  data-testid={`button-rating-${n}`}
                >
                  <Star className={`size-6 ${n <= form.rating ? "fill-accent text-accent" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Review body</Label>
            <Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Tell us about your experience…" data-testid="input-review-body" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.publishedAt} onChange={(e) => setForm({ ...form, publishedAt: e.target.value })} data-testid="input-review-date" />
            </div>
            <div>
              <Label>Sort order</Label>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} data-testid="input-review-sort" />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-card-border bg-card px-3 py-2">
            <div>
              <div className="text-sm font-medium">Show on website</div>
              <div className="text-xs text-muted-foreground">Toggle off to hide</div>
            </div>
            <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} data-testid="switch-review-active" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {review && (
            <Button variant="outline" onClick={() => remove.mutate()} disabled={remove.isPending} data-testid="button-delete-review">
              <Trash2 className="size-4 mr-1" /> Delete
            </Button>
          )}
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.authorName || !form.body} data-testid="button-save-review">
            {save.isPending && <Loader2 className="size-4 mr-1 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ EVENTS ============
function EventsTab() {
  const { data: eventsList = [] } = useQuery<Event[]>({ queryKey: ["/api/admin/events"] });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4 mt-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Events</h1>
          <p className="text-sm text-muted-foreground">Shown on the public Events page, soonest first. Past events drop off automatically.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} data-testid="button-add-event">
          <Plus className="size-4 mr-1" /> Add
        </Button>
      </div>

      {eventsList.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">No events yet. Add your first one.</Card>
      ) : (
        <div className="space-y-2">
          {eventsList.map((ev) => (
            <Card key={ev.id} className="p-4 bg-card hover-elevate" data-testid={`row-event-${ev.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-foreground">{ev.title}</span>
                    {!ev.active && <Badge variant="outline" className="text-[10px]">Hidden</Badge>}
                    {ev.date < today && <Badge variant="outline" className="text-[10px]">Past</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDate(ev.date)}{ev.startTime ? ` · ${ev.startTime}` : ""}
                  </div>
                  {ev.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ev.description}</p>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => { setEditing(ev); setOpen(true); }} data-testid={`button-edit-event-${ev.id}`}>
                  <Pencil className="size-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <EventDialog key={editing?.id ?? "new"} open={open} onClose={() => setOpen(false)} event={editing} />
    </div>
  );
}

function EventDialog({ open, onClose, event }: { open: boolean; onClose: () => void; event: Event | null }) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    title: event?.title ?? "",
    description: event?.description ?? "",
    date: event?.date ?? today,
    startTime: event?.startTime ?? "",
    imageUrl: event?.imageUrl ?? "",
    active: event?.active ?? true,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (event) {
        return (await apiRequest("PATCH", `/api/admin/events/${event.id}`, form)).json();
      }
      return (await apiRequest("POST", "/api/admin/events", form)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/events"] });
      toast({ title: event ? "Event updated" : "Event added" });
      onClose();
    },
  });

  const remove = useMutation({
    mutationFn: async () => (await apiRequest("DELETE", `/api/admin/events/${event!.id}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/events"] });
      toast({ title: "Event deleted" });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Karaoke Championship Night" data-testid="input-event-title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} data-testid="input-event-date" />
            </div>
            <div>
              <Label>Start time <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} data-testid="input-event-time" />
            </div>
          </div>
          <div>
            <Label>Description <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
            <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What's happening, any entry details…" data-testid="input-event-description" />
          </div>
          <div>
            <Label className="mb-1 block">Flyer / photo <span className="text-muted-foreground font-normal text-xs">(optional — some events have their own flyer)</span></Label>
            <ImageDropzone currentUrl={form.imageUrl} onChange={(url) => setForm({ ...form, imageUrl: url })} alt="Event flyer" testId="event-image" />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-card-border bg-card px-3 py-2">
            <div>
              <div className="text-sm font-medium">Show on website</div>
              <div className="text-xs text-muted-foreground">Toggle off to hide</div>
            </div>
            <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} data-testid="switch-event-active" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {event && (
            <Button variant="outline" onClick={() => remove.mutate()} disabled={remove.isPending} data-testid="button-delete-event">
              <Trash2 className="size-4 mr-1" /> Delete
            </Button>
          )}
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.title || !form.date} data-testid="button-save-event">
            {save.isPending && <Loader2 className="size-4 mr-1 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ SETTINGS ============
function SettingsTab() {
  const { toast } = useToast();
  const { data: settings } = useQuery<Settings>({ queryKey: ["/api/admin/settings"] });
  const update = useMutation({
    mutationFn: async (patch: Partial<Settings>) => (await apiRequest("PATCH", "/api/admin/settings", patch)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/studio"] });
      toast({ title: "Settings saved" });
    },
  });

  const { data: icsFeed } = useQuery<{ url: string }>({ queryKey: ["/api/admin/ics-feed"] });
  const regenerateIcs = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/admin/ics-feed/regenerate", {})).json() as Promise<{ url: string }>,
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/admin/ics-feed"], data);
      toast({ title: "Link regenerated", description: "The old link has stopped working — you'll need to re-subscribe with the new one." });
    },
  });
  const copyIcsUrl = () => {
    if (!icsFeed?.url) return;
    navigator.clipboard.writeText(icsFeed.url);
    toast({ title: "Copied" });
  };

  if (!settings) return <div className="py-12 text-center"><Loader2 className="size-5 animate-spin inline" /></div>;

  return (
    <div className="space-y-6 mt-5">
      <h1 className="font-display text-2xl font-bold">Settings</h1>

      <Card className="p-4 bg-card space-y-4">
        <h2 className="font-display font-bold">Bookings</h2>
        <Toggle label="Accepting new bookings" desc="Turn off to pause the booking widget on your website" checked={settings.acceptingBookings} onChange={(v) => update.mutate({ acceptingBookings: v })} testid="switch-accepting" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Buffer between bookings (min)</Label>
            <Input type="number" min={0} step={5} defaultValue={settings.bufferMinutes} onBlur={(e) => update.mutate({ bufferMinutes: Number(e.target.value) })} data-testid="input-buffer" />
          </div>
          <div>
            <Label>Min notice (hours)</Label>
            <Input type="number" min={0} defaultValue={settings.minNoticeHours} onBlur={(e) => update.mutate({ minNoticeHours: Number(e.target.value) })} data-testid="input-min-notice" />
          </div>
        </div>
        <div>
          <Label>Max advance booking (days)</Label>
          <Input type="number" min={1} defaultValue={settings.maxAdvanceDays} onBlur={(e) => update.mutate({ maxAdvanceDays: Number(e.target.value) })} data-testid="input-max-advance" />
        </div>
      </Card>

      <Card className="p-4 bg-card space-y-4">
        <h2 className="font-display font-bold">Notifications</h2>
        <div>
          <Label>Notification email</Label>
          <Input type="email" defaultValue={settings.notifyEmail} onBlur={(e) => update.mutate({ notifyEmail: e.target.value })} data-testid="input-notify-email" />
        </div>
        <Toggle label="iPhone push notifications" desc="Get an alert the moment a booking is paid" checked={settings.pushEnabled} onChange={(v) => update.mutate({ pushEnabled: v })} testid="switch-push" icon={<BellRing className="size-4" />} />
      </Card>

      <Card className="p-4 bg-card space-y-3">
        <div className="flex items-start gap-2">
          <Calendar className="size-4 text-muted-foreground mt-0.5" />
          <div>
            <h2 className="font-display font-bold">Calendar</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Subscribe to this link from your iPhone (Settings &gt; Calendar &gt; Accounts &gt; Add Subscribed Calendar) to see confirmed bookings alongside your own — works in Apple Calendar, Google Calendar or Outlook. It updates on its own every so often; not instant, but no login needed.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input readOnly value={icsFeed?.url ?? ""} onFocus={(e) => e.target.select()} className="font-mono text-xs" data-testid="input-ics-url" />
          <Button variant="outline" size="icon" onClick={copyIcsUrl} disabled={!icsFeed?.url} data-testid="button-copy-ics-url">
            <Copy className="size-4" />
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={() => regenerateIcs.mutate()} disabled={regenerateIcs.isPending} data-testid="button-regenerate-ics">
          {regenerateIcs.isPending && <Loader2 className="size-4 mr-1 animate-spin" />} Regenerate link
        </Button>
        <p className="text-xs text-muted-foreground">Only regenerate if this link has leaked — it breaks the old one, so you'll need to re-subscribe on your phone.</p>
      </Card>
    </div>
  );
}

function Toggle({ label, desc, checked, onChange, testid, icon }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void; testid: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-start gap-2">
        {icon && <div className="text-muted-foreground mt-0.5">{icon}</div>}
        <div>
          <div className="text-sm font-medium text-foreground">{label}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} data-testid={testid} />
    </div>
  );
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground font-display">{label}</div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function SkeletonRow() {
  return <div className="space-y-2">{Array.from({length: 3}).map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>;
}

// ============ PAYMENTS ============
type PaymentsConfig = {
  mode: "mvp" | "sumup";
  apiKeyMasked: string;
  hasApiKey: boolean;
  merchantCode: string;
};

function PaymentsTab() {
  const { toast } = useToast();
  const { data: cfg, isLoading } = useQuery<PaymentsConfig>({
    queryKey: ["/api/admin/payments-config"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/payments-config")).json(),
  });

  const [mode, setMode] = useState<"mvp" | "sumup">("mvp");
  const [apiKey, setApiKey] = useState("");
  const [merchantCode, setMerchantCode] = useState("");
  const [testing, setTesting] = useState(false);
  const [initialised, setInitialised] = useState(false);

  // Initialise local state once when cfg loads.
  if (cfg && !initialised) {
    setMode(cfg.mode);
    setMerchantCode(cfg.merchantCode);
    setInitialised(true);
  }

  const save = useMutation({
    mutationFn: async (payload: Partial<{ mode: string; apiKey: string; merchantCode: string }>) => {
      return (await apiRequest("POST", "/api/admin/payments-config", payload)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments-config"] });
      setApiKey("");
      toast({ title: "Saved", description: "Payment settings updated." });
    },
    onError: (e: any) => toast({ title: "Save failed", description: String(e?.message || e), variant: "destructive" }),
  });

  const handleTest = async () => {
    setTesting(true);
    try {
      const r = await apiRequest("POST", "/api/admin/payments-config/test", apiKey ? { apiKey } : {});
      const data = await r.json();
      if (data.ok) {
        const mp = data.merchantProfile || {};
        toast({
          title: "Connection OK",
          description: `${mp.company_name || "Connected"} — merchant code ${mp.merchant_code || "?"} (${mp.default_currency || "GBP"})`,
        });
        if (!merchantCode && mp.merchant_code) setMerchantCode(mp.merchant_code);
      } else {
        toast({ title: "Connection failed", description: data.error || "Check your API key", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Connection failed", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  if (isLoading) return <SkeletonRow />;

  return (
    <div className="space-y-4 mt-3">
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <CreditCard className="size-5 text-primary mt-0.5" />
          <div className="flex-1">
            <h2 className="text-base font-semibold text-foreground">SumUp payments</h2>
            <p className="text-sm text-muted-foreground">
              Take card deposits via SumUp's hosted checkout. Customers are redirected to a SumUp page to pay; bookings are confirmed automatically when payment completes. SumUp's fee is 2.5% per transaction.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-foreground">Payment mode</div>
            <div className="text-xs text-muted-foreground">
              {mode === "sumup"
                ? "Customers are redirected to SumUp to pay the deposit."
                : "Customers see a 'we'll email you within 24 hours' message. No card payment yet."}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${mode === "mvp" ? "font-semibold" : "text-muted-foreground"}`}>Manual</span>
            <Switch
              checked={mode === "sumup"}
              onCheckedChange={(v) => setMode(v ? "sumup" : "mvp")}
              data-testid="switch-payments-mode"
            />
            <span className={`text-xs ${mode === "sumup" ? "font-semibold" : "text-muted-foreground"}`}>SumUp</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sumup-api-key">SumUp API key</Label>
          <Input
            id="sumup-api-key"
            type="password"
            placeholder={cfg?.hasApiKey ? `Saved: ${cfg.apiKeyMasked} — enter a new key to replace` : "sup_sk_..."}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            data-testid="input-sumup-api-key"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Get this from your SumUp Dashboard → Developer → API keys. Starts with <code>sup_sk_</code>.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sumup-merchant">Merchant code</Label>
          <Input
            id="sumup-merchant"
            placeholder="e.g. MQEKWZTL"
            value={merchantCode}
            onChange={(e) => setMerchantCode(e.target.value.trim())}
            data-testid="input-sumup-merchant"
          />
          <p className="text-xs text-muted-foreground">
            Found in your SumUp Dashboard → Account → Profile. Or click "Test connection" — we'll fill it in for you.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || (!apiKey && !cfg?.hasApiKey)}
            data-testid="button-sumup-test"
          >
            {testing ? <Loader2 className="size-4 mr-2 animate-spin" /> : <CheckCircle2 className="size-4 mr-2" />}
            Test connection
          </Button>
          <Button
            onClick={() => save.mutate({ mode, apiKey: apiKey || undefined, merchantCode })}
            disabled={save.isPending}
            data-testid="button-sumup-save"
          >
            {save.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
            Save
          </Button>
        </div>

        {mode === "sumup" && (!cfg?.hasApiKey || !merchantCode) && (
          <div className="flex gap-2 rounded-md border border-amber-300/40 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            <div>
              SumUp mode is on but credentials are incomplete. Customers will see an error when trying to pay. Add your API key and merchant code, then test the connection.
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ============ BRANDING HELPERS ============

// Curated display + body font pairs (Google Fonts CSS2 family names).
const FONT_PAIRS: { display: string; body: string }[] = [
  { display: "Bricolage Grotesque", body: "Work Sans" },
  { display: "Big Shoulders Display", body: "Archivo" },
  { display: "Unbounded", body: "Manrope" },
  { display: "Fraunces", body: "Instrument Sans" },
  { display: "Playfair Display", body: "Inter" },
  { display: "DM Serif Display", body: "DM Sans" },
  { display: "Cormorant Garamond", body: "Montserrat" },
  { display: "Lora", body: "Source Sans 3" },
];

// HSL "H S% L%" → "#rrggbb"
function hslStringToHex(hsl: string): string {
  const m = hsl.trim().match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!m) return "#000000";
  const h = parseFloat(m[1]);
  const s = parseFloat(m[2]) / 100;
  const l = parseFloat(m[3]) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

// "#rrggbb" → HSL "H S% L%"
function hexToHslString(hex: string): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// ============ EMAILS ============
type EmailConfigForm = {
  enabled: boolean;
  fromEmail: string;
  fromName: string;
  bccOwner: boolean;
  ownerEmail: string;
  remindersEnabled: boolean;
  reminderHoursBefore: number;
};

type EmailDiagnostics = {
  enabled: boolean;
  fromEmail: string;
  ownerEmail: string;
  smtpConfigured: boolean;
  smtpConnectionOk: boolean | null;
  error: string | null;
};

type EmailTemplate = { subject: string; body: string };
type EmailTemplatesForm = {
  bookingReceived: EmailTemplate;
  customerConfirm: EmailTemplate;
  ownerAlert: EmailTemplate;
  newBookingRequest: EmailTemplate;
  appointmentReminder: EmailTemplate;
  cancellation: EmailTemplate;
};

const PLACEHOLDER_HINT =
  "Available placeholders: {customer}, {date}, {time}, {eventType}, {partySize}, {deposit}, {phone}, {email}, {notes}, {shoutOuts}, {business}, {ownerName}";
const NEW_BOOKING_PLACEHOLDER_HINT =
  "Available placeholders: {customer}, {date}, {time}, {eventType}, {partySize}, {depositStatus}, {phone}, {email}, {notes}, {shoutOuts}, {business}, {ownerName}";

function EmailsTab() {
  const { toast } = useToast();

  const { data: cfg, isLoading: cfgLoading } = useQuery<EmailConfigForm>({
    queryKey: ["/api/admin/email-config"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/email-config")).json(),
  });
  const { data: tmpl, isLoading: tmplLoading } = useQuery<EmailTemplatesForm>({
    queryKey: ["/api/admin/email-templates"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/email-templates")).json(),
  });

  const [form, setForm] = useState<EmailConfigForm | null>(null);
  const [testTo, setTestTo] = useState("");
  const [tForm, setTForm] = useState<EmailTemplatesForm | null>(null);

  if (cfg && !form) setForm(cfg);
  if (tmpl && !tForm) setTForm(tmpl);

  const saveConfig = useMutation({
    mutationFn: async (payload: EmailConfigForm) =>
      (await apiRequest("POST", "/api/admin/email-config", {
        enabled: payload.enabled,
        fromEmail: payload.fromEmail,
        fromName: payload.fromName,
        bccOwner: payload.bccOwner,
        ownerEmail: payload.ownerEmail,
        remindersEnabled: payload.remindersEnabled,
        reminderHoursBefore: payload.reminderHoursBefore,
      })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-config"] });
      toast({ title: "Saved", description: "Email settings updated." });
    },
    onError: (e: any) => toast({ title: "Save failed", description: String(e?.message || e), variant: "destructive" }),
  });

  const saveTemplates = useMutation({
    mutationFn: async (payload: EmailTemplatesForm) =>
      (await apiRequest("POST", "/api/admin/email-templates", payload)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      toast({ title: "Saved", description: "Templates updated." });
    },
    onError: (e: any) => toast({ title: "Save failed", description: String(e?.message || e), variant: "destructive" }),
  });

  const sendTest = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/admin/email-test", { to: testTo })).json(),
    onSuccess: () => toast({ title: "Test sent", description: "Check the inbox." }),
    onError: (e: any) => toast({ title: "Test failed", description: String(e?.message || e), variant: "destructive" }),
  });

  const [diagnostics, setDiagnostics] = useState<EmailDiagnostics | null>(null);
  const checkSetup = useMutation({
    mutationFn: async () => (await apiRequest("GET", "/api/admin/email-diagnostics")).json() as Promise<EmailDiagnostics>,
    onSuccess: (data) => setDiagnostics(data),
    onError: (e: any) => toast({ title: "Check failed", description: String(e?.message || e), variant: "destructive" }),
  });

  if (cfgLoading || tmplLoading || !form || !tForm) return <SkeletonRow />;

  return (
    <div className="space-y-4 mt-3">
      {/* Connection */}
      <Card className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <Mail className="size-5 text-primary mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-foreground">Booking emails</h2>
            <p className="text-sm text-muted-foreground">Send confirmation emails to customers and alerts to yourself via the mailbox's own SMTP login.</p>
          </div>
        </div>

        <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground space-y-1">
          <p>Sent by logging into the real mailbox over SMTP — <code className="font-mono">SMTP_HOST</code>, <code className="font-mono">SMTP_PORT</code>, <code className="font-mono">SMTP_SECURE</code>, <code className="font-mono">SMTP_USER</code> and <code className="font-mono">SMTP_PASS</code> environment variables set in Railway, not entered here.</p>
          <p>The From email below should match <code className="font-mono">SMTP_USER</code> — that's the mailbox actually sending the mail.</p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <Label className="text-sm">Send booking emails</Label>
            <p className="text-xs text-muted-foreground">When off, no emails are sent on booking.</p>
          </div>
          <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} data-testid="switch-email-enabled" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="from-email">From email</Label>
          <Input id="from-email" type="email" placeholder="bookings@yourbusiness.co.uk" value={form.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} data-testid="input-from-email" />
          <p className="text-xs text-muted-foreground">Should match the mailbox set as SMTP_USER on the server — that's the real login sending the mail.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="from-name">From name</Label>
          <Input id="from-name" value={form.fromName} onChange={(e) => setForm({ ...form, fromName: e.target.value })} data-testid="input-from-name" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="owner-email">Owner email <span className="text-muted-foreground font-normal">(for new-booking alerts)</span></Label>
          <Input id="owner-email" type="email" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} data-testid="input-owner-email" />
        </div>

        <div className="border-t border-border pt-4 space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label className="text-sm">Send booking reminders</Label>
              <p className="text-xs text-muted-foreground">Emails the customer ahead of their booking. Uses the connection above.</p>
            </div>
            <Switch checked={form.remindersEnabled} onCheckedChange={(v) => setForm({ ...form, remindersEnabled: v })} data-testid="switch-reminders-enabled" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder-hours">Hours before booking</Label>
            <Input
              id="reminder-hours"
              type="number"
              min={1}
              max={168}
              value={form.reminderHoursBefore}
              onChange={(e) => setForm({ ...form, reminderHoursBefore: Number(e.target.value) })}
              data-testid="input-reminder-hours"
            />
            <p className="text-xs text-muted-foreground">Checked every 15 minutes, so the reminder goes out shortly after this threshold is crossed — not to the exact minute.</p>
          </div>
        </div>

        <Button onClick={() => saveConfig.mutate(form)} disabled={saveConfig.isPending} data-testid="button-save-email-config">
          {saveConfig.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : null} Save settings
        </Button>

        <div className="border-t border-border pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label>Check setup</Label>
            <Button variant="outline" size="sm" onClick={() => checkSetup.mutate()} disabled={checkSetup.isPending} data-testid="button-check-setup">
              {checkSetup.isPending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : null} Check setup
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Actually connects and logs into the mailbox over SMTP to check it works — doesn't send anything.</p>
          {diagnostics && (
            <div className="rounded-lg border border-border p-3 space-y-2 text-xs" data-testid="panel-email-diagnostics">
              <DiagnosticRow ok={diagnostics.enabled} label={'"Send booking emails" is switched on'} />
              <DiagnosticRow ok={diagnostics.smtpConfigured} label="SMTP_HOST/SMTP_USER/SMTP_PASS set on the server" />
              {diagnostics.smtpConfigured && (
                <DiagnosticRow ok={diagnostics.smtpConnectionOk} label="Connected and logged in successfully" />
              )}
              {diagnostics.error && (
                <div className="pt-1 text-destructive" data-testid="text-diagnostics-error">{diagnostics.error}</div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border pt-4 space-y-2">
          <Label htmlFor="test-to">Send test email</Label>
          <div className="flex gap-2">
            <Input id="test-to" type="email" placeholder="Optional — defaults to owner email" value={testTo} onChange={(e) => setTestTo(e.target.value)} data-testid="input-test-to" />
            <Button variant="outline" onClick={() => sendTest.mutate()} disabled={sendTest.isPending} data-testid="button-send-test">
              {sendTest.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : null} Send test
            </Button>
          </div>
        </div>
      </Card>

      {/* Templates */}
      <Card className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <FileText className="size-5 text-primary mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-foreground">Templates</h2>
            <p className="text-sm text-muted-foreground">Customise the emails. Use placeholders like {"{customer}"} that get filled in automatically.</p>
          </div>
        </div>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="booking-received">
            <AccordionTrigger data-testid="accordion-booking-received">Booking received (to customer)</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Sent to the customer the moment they submit a request — before it's confirmed or paid — so they know it went through while they wait.</p>
              <div className="space-y-2">
                <Label htmlFor="received-subject">Subject</Label>
                <Input id="received-subject" value={tForm.bookingReceived.subject} onChange={(e) => setTForm({ ...tForm, bookingReceived: { ...tForm.bookingReceived, subject: e.target.value } })} data-testid="input-received-subject" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="received-body">Body</Label>
                <Textarea id="received-body" rows={12} value={tForm.bookingReceived.body} onChange={(e) => setTForm({ ...tForm, bookingReceived: { ...tForm.bookingReceived, body: e.target.value } })} data-testid="input-received-body" />
                <p className="text-xs text-muted-foreground">{NEW_BOOKING_PLACEHOLDER_HINT}</p>
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="customer">
            <AccordionTrigger data-testid="accordion-customer">Customer confirmation</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="cust-subject">Subject</Label>
                <Input id="cust-subject" value={tForm.customerConfirm.subject} onChange={(e) => setTForm({ ...tForm, customerConfirm: { ...tForm.customerConfirm, subject: e.target.value } })} data-testid="input-cust-subject" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cust-body">Body</Label>
                <Textarea id="cust-body" rows={12} value={tForm.customerConfirm.body} onChange={(e) => setTForm({ ...tForm, customerConfirm: { ...tForm.customerConfirm, body: e.target.value } })} data-testid="input-cust-body" />
                <p className="text-xs text-muted-foreground">{PLACEHOLDER_HINT}</p>
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="new-booking-request">
            <AccordionTrigger data-testid="accordion-new-booking-request">New booking request (to you)</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Sent the moment any booking comes in — before it's confirmed, so you always hear about a request even if it needs your manual review.</p>
              <div className="space-y-2">
                <Label htmlFor="new-booking-subject">Subject</Label>
                <Input id="new-booking-subject" value={tForm.newBookingRequest.subject} onChange={(e) => setTForm({ ...tForm, newBookingRequest: { ...tForm.newBookingRequest, subject: e.target.value } })} data-testid="input-new-booking-subject" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-booking-body">Body</Label>
                <Textarea id="new-booking-body" rows={12} value={tForm.newBookingRequest.body} onChange={(e) => setTForm({ ...tForm, newBookingRequest: { ...tForm.newBookingRequest, body: e.target.value } })} data-testid="input-new-booking-body" />
                <p className="text-xs text-muted-foreground">{NEW_BOOKING_PLACEHOLDER_HINT}</p>
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="owner">
            <AccordionTrigger data-testid="accordion-owner">Booking confirmed alert (to you)</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Sent once a booking is actually confirmed — deposit paid, or manually confirmed by you.</p>
              <div className="space-y-2">
                <Label htmlFor="owner-subject">Subject</Label>
                <Input id="owner-subject" value={tForm.ownerAlert.subject} onChange={(e) => setTForm({ ...tForm, ownerAlert: { ...tForm.ownerAlert, subject: e.target.value } })} data-testid="input-owner-subject" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner-body">Body</Label>
                <Textarea id="owner-body" rows={12} value={tForm.ownerAlert.body} onChange={(e) => setTForm({ ...tForm, ownerAlert: { ...tForm.ownerAlert, body: e.target.value } })} data-testid="input-owner-body" />
                <p className="text-xs text-muted-foreground">{PLACEHOLDER_HINT}</p>
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="reminder">
            <AccordionTrigger data-testid="accordion-reminder">Booking reminder</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="reminder-subject">Subject</Label>
                <Input id="reminder-subject" value={tForm.appointmentReminder.subject} onChange={(e) => setTForm({ ...tForm, appointmentReminder: { ...tForm.appointmentReminder, subject: e.target.value } })} data-testid="input-reminder-subject" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reminder-body">Body</Label>
                <Textarea id="reminder-body" rows={12} value={tForm.appointmentReminder.body} onChange={(e) => setTForm({ ...tForm, appointmentReminder: { ...tForm.appointmentReminder, body: e.target.value } })} data-testid="input-reminder-body" />
                <p className="text-xs text-muted-foreground">{PLACEHOLDER_HINT}</p>
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="cancellation">
            <AccordionTrigger data-testid="accordion-cancellation">Cancellation (to customer)</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Sent when you cancel a booking from the admin panel.</p>
              <div className="space-y-2">
                <Label htmlFor="cancellation-subject">Subject</Label>
                <Input id="cancellation-subject" value={tForm.cancellation.subject} onChange={(e) => setTForm({ ...tForm, cancellation: { ...tForm.cancellation, subject: e.target.value } })} data-testid="input-cancellation-subject" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cancellation-body">Body</Label>
                <Textarea id="cancellation-body" rows={12} value={tForm.cancellation.body} onChange={(e) => setTForm({ ...tForm, cancellation: { ...tForm.cancellation, body: e.target.value } })} data-testid="input-cancellation-body" />
                <p className="text-xs text-muted-foreground">{PLACEHOLDER_HINT}</p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Button onClick={() => saveTemplates.mutate(tForm)} disabled={saveTemplates.isPending} data-testid="button-save-templates">
          {saveTemplates.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : null} Save templates
        </Button>
      </Card>
    </div>
  );
}

function DiagnosticRow({ ok, label }: { ok: boolean | null; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok === true && <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />}
      {ok === false && <X className="size-3.5 text-destructive shrink-0" />}
      {ok === null && <AlertCircle className="size-3.5 text-muted-foreground shrink-0" />}
      <span className={ok === false ? "text-destructive" : "text-foreground"}>{label}</span>
    </div>
  );
}

// ============ BUSINESS ============
type BusinessConfig = {
  ownerName: string;
  brandName: string;
  brandShortName: string;
  tagline: string;
  instagram: string;
  email: string;
  phone: string;
};

function BusinessTab() {
  const { toast } = useToast();
  const { data: cfg, isLoading } = useQuery<BusinessConfig>({
    queryKey: ["/api/admin/business-config"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/business-config")).json(),
  });

  const [form, setForm] = useState<BusinessConfig | null>(null);
  if (cfg && !form) setForm(cfg);

  const save = useMutation({
    mutationFn: async (payload: BusinessConfig) =>
      (await apiRequest("POST", "/api/admin/business-config", payload)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/brand-config"] });
      toast({ title: "Saved", description: "Business details updated." });
    },
    onError: (e: any) => toast({ title: "Save failed", description: String(e?.message || e), variant: "destructive" }),
  });

  if (isLoading || !form) return <SkeletonRow />;

  return (
    <div className="space-y-4 mt-3">
      <Card className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <Building2 className="size-5 text-primary mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-foreground">Business details</h2>
            <p className="text-sm text-muted-foreground">Your name and how your brand appears across the site.</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="biz-owner">Owner name</Label>
          <Input id="biz-owner" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} data-testid="input-owner-name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="biz-brand">Brand name</Label>
          <Input id="biz-brand" value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} data-testid="input-brand-name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="biz-short">Brand short name</Label>
          <Input id="biz-short" value={form.brandShortName} onChange={(e) => setForm({ ...form, brandShortName: e.target.value })} data-testid="input-brand-short" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="biz-tagline">Tagline</Label>
          <Input id="biz-tagline" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} data-testid="input-tagline" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="biz-email">Business email</Label>
          <Input id="biz-email" type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="input-business-email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="biz-phone">Business phone</Label>
          <Input id="biz-phone" type="tel" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="input-business-phone" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="biz-insta">Instagram handle <span className="text-muted-foreground font-normal">(optional, no @)</span></Label>
          <Input id="biz-insta" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value.replace(/^@+/, "") })} data-testid="input-instagram" />
        </div>
        <Button onClick={() => save.mutate(form)} disabled={save.isPending} data-testid="button-save-business">
          {save.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : null} Save
        </Button>
      </Card>
    </div>
  );
}

// ============ BRANDING ============
type BrandingConfig = {
  colors: {
    primary: string; primaryFg: string;
    accent: string; accentFg: string;
    tertiary: string; tertiaryFg: string;
    background: string; foreground: string;
    muted: string; mutedFg: string;
    border: string;
  };
  fonts: { display: string; body: string };
  italicAccent: boolean;
};

function BrandingTab() {
  const { toast } = useToast();
  const { data: cfg, isLoading } = useQuery<BrandingConfig>({
    queryKey: ["/api/admin/branding-config"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/branding-config")).json(),
  });

  const [form, setForm] = useState<BrandingConfig | null>(null);
  if (cfg && !form) setForm(cfg);

  const save = useMutation({
    mutationFn: async (payload: BrandingConfig) =>
      (await apiRequest("POST", "/api/admin/branding-config", payload)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/branding-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/brand-config"] });
      toast({ title: "Saved", description: "Branding updated — changes are live." });
    },
    onError: (e: any) => toast({ title: "Save failed", description: String(e?.message || e), variant: "destructive" }),
  });

  if (isLoading || !form) return <SkeletonRow />;

  const setColor = (key: keyof BrandingConfig["colors"], hex: string) =>
    setForm({ ...form, colors: { ...form.colors, [key]: hexToHslString(hex) } });

  const colorField = (key: keyof BrandingConfig["colors"], label: string) => {
    const hex = hslStringToHex(form.colors[key]);
    return (
      <div className="space-y-1.5">
        <Label htmlFor={`color-${key}`}>{label}</Label>
        <div className="flex items-center gap-2">
          <input
            id={`color-${key}`}
            type="color"
            value={hex}
            onChange={(e) => setColor(key, e.target.value)}
            className="h-9 w-12 rounded border border-border bg-transparent p-0.5"
            data-testid={`color-${key}`}
          />
          <code className="text-xs text-muted-foreground">{hex}</code>
        </div>
      </div>
    );
  };

  const selectedPairIdx = FONT_PAIRS.findIndex(
    (p) => p.display === form.fonts.display && p.body === form.fonts.body
  );

  return (
    <div className="space-y-4 mt-3">
      <Card className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <Palette className="size-5 text-primary mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-foreground">Branding</h2>
            <p className="text-sm text-muted-foreground">Fonts and colours. Changes apply across the site without a redeploy.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="font-pair">Font pair (Display / Body)</Label>
          <select
            id="font-pair"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selectedPairIdx >= 0 ? String(selectedPairIdx) : ""}
            onChange={(e) => {
              const p = FONT_PAIRS[Number(e.target.value)];
              setForm({ ...form, fonts: { display: p.display, body: p.body } });
            }}
            data-testid="select-font-pair"
          >
            {selectedPairIdx < 0 && <option value="">Custom ({form.fonts.display} / {form.fonts.body})</option>}
            {FONT_PAIRS.map((p, i) => (
              <option key={i} value={i}>{p.display} / {p.body}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {colorField("primary", "Primary")}
          {colorField("primaryFg", "Primary text")}
          {colorField("accent", "Accent")}
          {colorField("accentFg", "Accent text")}
          {colorField("tertiary", "Tertiary (sparing highlights)")}
          {colorField("tertiaryFg", "Tertiary text")}
          {colorField("background", "Background")}
          {colorField("foreground", "Foreground (text)")}
          {colorField("muted", "Card / surface")}
          {colorField("mutedFg", "Card text (muted)")}
          {colorField("border", "Border")}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-card-border bg-card px-3 py-2">
          <div>
            <div className="text-sm font-medium">Italic headline accents</div>
            <div className="text-xs text-muted-foreground">e.g. "own <em>the night</em>" — turn off for a straighter look</div>
          </div>
          <Switch checked={form.italicAccent} onCheckedChange={(v) => setForm({ ...form, italicAccent: v })} data-testid="switch-italic-accent" />
        </div>

        <Button onClick={() => save.mutate(form)} disabled={save.isPending} data-testid="button-save-branding">
          {save.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : null} Save
        </Button>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground border-b border-card-border">Live preview</div>
        <div
          className="h-[200px] p-6 flex flex-col justify-center gap-3"
          style={{
            background: `hsl(${form.colors.background})`,
            color: `hsl(${form.colors.foreground})`,
            fontFamily: `'${form.fonts.body}', system-ui, sans-serif`,
          }}
        >
          <div style={{ fontFamily: `'${form.fonts.display}', sans-serif`, fontWeight: 700, fontSize: "1.6rem", lineHeight: 1.1 }}>
            Sample heading
          </div>
          <div style={{ fontSize: "0.95rem", opacity: 0.85 }}>
            The quick brown fox jumps over the lazy dog.
          </div>
          <div className="flex gap-2 mt-1">
            <span style={{ background: `hsl(${form.colors.primary})`, color: `hsl(${form.colors.primaryFg})`, padding: "0.4rem 0.9rem", borderRadius: "9999px", fontSize: "0.85rem", fontWeight: 600 }}>Button</span>
            <span style={{ background: `hsl(${form.colors.accent})`, color: `hsl(${form.colors.accentFg})`, padding: "0.4rem 0.9rem", borderRadius: "9999px", fontSize: "0.85rem", fontWeight: 600 }}>Accent</span>
            <span style={{ background: `hsl(${form.colors.tertiary})`, color: `hsl(${form.colors.tertiaryFg})`, padding: "0.4rem 0.9rem", borderRadius: "9999px", fontSize: "0.85rem", fontWeight: 600 }}>Tertiary</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============ POLICY ============
type PolicyConfig = {
  cancellationNoticeHours: number;
  refundPercentInsideNotice: number;
  body: string;
};

function PolicyTab() {
  const { toast } = useToast();
  const { data: cfg, isLoading } = useQuery<PolicyConfig>({
    queryKey: ["/api/admin/policy-config"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/policy-config")).json(),
  });

  const [form, setForm] = useState<PolicyConfig | null>(null);
  if (cfg && !form) setForm(cfg);

  const save = useMutation({
    mutationFn: async (payload: PolicyConfig) =>
      (await apiRequest("POST", "/api/admin/policy-config", payload)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/policy-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/brand-config"] });
      toast({ title: "Saved", description: "Cancellation policy updated." });
    },
    onError: (e: any) => toast({ title: "Save failed", description: String(e?.message || e), variant: "destructive" }),
  });

  if (isLoading || !form) return <SkeletonRow />;

  const preview = form.body.replace(/\[N\]/g, String(form.cancellationNoticeHours));

  return (
    <div className="space-y-4 mt-3">
      <Card className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <ScrollText className="size-5 text-primary mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-foreground">Cancellation policy</h2>
            <p className="text-sm text-muted-foreground">Shown to customers on the payment and confirmation pages.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="policy-hours">Free-cancellation window (hours before booking)</Label>
          <Input
            id="policy-hours"
            type="number"
            min={0}
            value={form.cancellationNoticeHours}
            onChange={(e) => setForm({ ...form, cancellationNoticeHours: Math.max(0, parseInt(e.target.value || "0", 10)) })}
            data-testid="input-policy-hours"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="policy-refund">Refund % for late cancellations</Label>
          <Input
            id="policy-refund"
            type="number"
            min={0}
            max={100}
            value={form.refundPercentInsideNotice}
            onChange={(e) => setForm({ ...form, refundPercentInsideNotice: Math.max(0, Math.min(100, parseInt(e.target.value || "0", 10))) })}
            data-testid="input-policy-refund"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="policy-body">Policy text</Label>
          <Textarea
            id="policy-body"
            rows={6}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            data-testid="input-policy-body"
          />
          <p className="text-xs text-muted-foreground">Use [N] as a placeholder for the notice hours.</p>
        </div>

        <Button onClick={() => save.mutate(form)} disabled={save.isPending} data-testid="button-save-policy">
          {save.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : null} Save
        </Button>
      </Card>

      <Card className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Preview</div>
        <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{preview}</p>
      </Card>
    </div>
  );
}
