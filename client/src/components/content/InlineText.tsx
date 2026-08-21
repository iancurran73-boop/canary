/**
 * components/content/InlineText.tsx
 * ───────────────────────────────────
 * Auto-saving text / textarea field for admin Content tab.
 * Debounces saves 800ms after the user stops typing.
 */

import { useEffect, useRef, useState } from "react";
import { useContentMutations } from "@/lib/content";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";

interface InlineTextProps {
  /** Content key to write, e.g. "home.heroTitle" */
  contentKey: string;
  /** Current value (from c(key, fallback)) */
  value: string;
  /** "input" renders a single-line Input; "textarea" renders multi-line */
  variant?: "input" | "textarea";
  /** Placeholder shown when the field is empty */
  placeholder?: string;
  /** aria-label for accessibility */
  label?: string;
  /** Number of rows for textarea */
  rows?: number;
}

export function InlineText({
  contentKey,
  value: initialValue,
  variant = "input",
  placeholder,
  label,
  rows = 4,
}: InlineTextProps) {
  const { setText } = useContentMutations();
  const { toast } = useToast();
  const [localValue, setLocalValue] = useState(initialValue);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>(initialValue);

  // Sync when parent value changes (e.g. after content loads)
  useEffect(() => {
    setLocalValue(initialValue);
    lastSaved.current = initialValue;
  }, [initialValue]);

  function scheduleAutoSave(newValue: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (newValue === lastSaved.current) return;
      setSaving(true);
      try {
        await setText(contentKey, newValue);
        lastSaved.current = newValue;
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } catch {
        toast({ title: "Save failed", description: "Changes could not be saved.", variant: "destructive" });
      } finally {
        setSaving(false);
      }
    }, 800);
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const val = e.target.value;
    setLocalValue(val);
    scheduleAutoSave(val);
  }

  const statusNode = (
    <span
      className={`
        inline-flex items-center gap-1 text-xs font-medium transition-opacity duration-300
        ${saved ? "text-green-600 opacity-100" : "opacity-0"}
      `}
      aria-live="polite"
    >
      <CheckCircle2 className="size-3" /> Saved ✓
    </span>
  );

  const commonProps = {
    value: localValue,
    onChange,
    placeholder,
    "aria-label": label ?? contentKey,
    "data-testid": `input-content-${contentKey}`,
    className: `w-full ${saving ? "opacity-60" : ""}`,
  };

  return (
    <div className="space-y-1">
      {variant === "textarea" ? (
        <Textarea {...commonProps} rows={rows} />
      ) : (
        <Input {...commonProps} />
      )}
      <div className="h-4 flex items-center">{statusNode}</div>
    </div>
  );
}
