/**
 * components/content/ImageDropzone.tsx
 * ──────────────────────────────────────
 * Drag-and-drop / tap-to-pick image uploader for the admin Content tab.
 * Mobile-first: uses <input type="file" capture="environment"> for iOS camera.
 */

import { useRef, useState, DragEvent } from "react";
import { useContentMutations } from "@/lib/content";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ImageIcon, CheckCircle2, Trash2 } from "lucide-react";

interface ImageDropzoneProps {
  /** Content key to write the URL to, e.g. "home.heroImage" — omit when using onChange instead. */
  contentKey?: string;
  /** Current image URL (from c(key, fallback), or from local form state). */
  currentUrl?: string;
  /** Alt text for the thumbnail preview */
  alt?: string;
  /**
   * Use instead of contentKey when the image belongs to local form state
   * rather than the content table (e.g. one field of a record being edited
   * in a dialog, like an event's flyer). Called with "" on remove.
   */
  onChange?: (url: string) => void;
  /** Overrides the data-testid suffix; falls back to contentKey. */
  testId?: string;
}

export function ImageDropzone({ contentKey, currentUrl, alt = "Preview", onChange, testId }: ImageDropzoneProps) {
  const { uploadImage, setImage } = useContentMutations();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const id = testId ?? contentKey ?? "image";

  async function save(url: string) {
    if (onChange) {
      onChange(url);
    } else if (contentKey) {
      await setImage(contentKey, url);
    }
  }

  async function handleRemove() {
    if (!window.confirm("Remove this image?")) return;
    try {
      await save("");
      toast({ title: "Image removed" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not remove image";
      toast({ title: "Remove failed", description: message, variant: "destructive" });
    }
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Not an image", description: "Please pick an image file.", variant: "destructive" });
      return;
    }
    setUploading(true);
    setSaved(false);
    try {
      const url = await uploadImage(file);
      await save(url);
      setSaved(true);
      toast({ title: "Image saved", description: "Your image has been uploaded." });
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Upload failed";
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave() {
    setDragging(false);
  }

  function onClick() {
    inputRef.current?.click();
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so the same file can be picked again
    e.target.value = "";
  }

  return (
    <div className="space-y-2">
      {/* Current image preview */}
      {currentUrl && (
        <div className="relative rounded-lg overflow-hidden border border-border bg-muted aspect-video max-h-40">
          <img src={currentUrl} alt={alt} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={handleRemove}
            aria-label="Remove image"
            title="Remove image"
            className="absolute top-1.5 right-1.5 z-10 grid place-items-center size-7 rounded-full bg-white/90 text-destructive shadow-sm ring-1 ring-destructive/20 hover:bg-white hover:ring-destructive/40 transition-colors"
            data-testid={`button-remove-image-${id}`}
          >
            <Trash2 className="size-4" />
          </button>
          {saved && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <CheckCircle2 className="size-8 text-white" />
            </div>
          )}
        </div>
      )}

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload image"
        onClick={onClick}
        onKeyDown={(e) => e.key === "Enter" && onClick()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`
          relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer
          transition-colors min-h-[80px] touch-manipulation select-none
          ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/60 hover:bg-muted/50"}
          ${uploading ? "pointer-events-none opacity-70" : ""}
        `}
      >
        {uploading ? (
          <>
            <Loader2 className="size-6 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">Uploading…</p>
          </>
        ) : saved ? (
          <>
            <CheckCircle2 className="size-6 text-green-600" />
            <p className="text-sm text-green-700 font-semibold">Saved ✓</p>
          </>
        ) : (
          <>
            <ImageIcon className="size-6 text-muted-foreground" />
            <p className="text-sm text-center text-muted-foreground">
              <span className="font-semibold text-foreground">Drop image or tap to upload</span>
              <br />
              <span className="text-xs">JPG, PNG or WebP · Max 10 MB · Resized automatically</span>
            </p>
          </>
        )}

        {/* Hidden file input — capture="environment" opens camera on iOS */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={onInputChange}
          data-testid={`input-image-${id}`}
        />
      </div>
    </div>
  );
}
