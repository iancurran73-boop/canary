import { BookingWidget } from "@/components/booking-widget";

// Embed-only view — what would actually be loaded inside an iframe on
// sophiespamperedpaws.co.uk via a single <script> tag.
export default function WidgetOnly() {
  return (
    <div className="min-h-screen bg-transparent p-2 sm:p-4">
      <BookingWidget embedded />
    </div>
  );
}
