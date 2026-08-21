/**
 * client/src/lib/content.ts
 * ──────────────────────────
 * Owner-friendly content management layer backed by the local SQLite backend.
 *
 * useContent()          → { c(key, fallback), images, ready }
 * useGalleryItems()     → { items, refresh }
 * useContentMutations() → { setText, setImage, uploadImage, insertGalleryItem, updateGalleryItem, deleteGalleryItem }
 *
 * Reads from /api/public/content and /api/public/gallery via the app's own
 * Express routes. Falls back to the fallback arg if data is unavailable.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ContentRow {
  key: string;
  value: string;
  updatedAt: number;
}

export interface GalleryItem {
  id: number;
  imageUrl: string;
  caption: string | null;
  category: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function resizeToJpeg(file: File, maxPx = 2400, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width: w, height: h } = bitmap;
  const scale = Math.min(1, maxPx / Math.max(w, h));
  const tw = Math.round(w * scale);
  const th = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, tw, th);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      "image/jpeg",
      quality
    )
  );
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── Query: content rows ──────────────────────────────────────────────────────

async function fetchContentRows(): Promise<ContentRow[]> {
  try {
    const res = await fetch("/api/public/content");
    if (!res.ok) return [];
    return (await res.json()) as ContentRow[];
  } catch {
    return [];
  }
}

// ── Query: gallery items ─────────────────────────────────────────────────────

async function fetchGalleryItems(): Promise<GalleryItem[]> {
  try {
    const res = await fetch("/api/public/gallery");
    if (!res.ok) return [];
    return (await res.json()) as GalleryItem[];
  } catch {
    return [];
  }
}

// ── Hooks ────────────────────────────────────────────────────────────────────

/**
 * useContent()
 * Returns:
 *   c(key, fallback) — get a content string, falling back to fallback if missing
 *   images           — map of image-key → url
 *   ready            — true once the first fetch completes
 */
export function useContent() {
  const { data, isSuccess } = useQuery<ContentRow[]>({
    queryKey: ["/api/public/content"],
    queryFn: fetchContentRows,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const rowMap = new Map<string, string>(
    (data ?? []).map((r) => [r.key, r.value])
  );

  function c(key: string, fallback: string): string {
    const val = rowMap.get(key);
    if (val === undefined || val === null) return fallback;
    return String(val);
  }

  // Collect all image-type values (data URLs or http URLs)
  const images: Record<string, string> = {};
  rowMap.forEach((v, k) => {
    if (typeof v === "string" && (v.startsWith("http") || v.startsWith("data:"))) {
      images[k] = v;
    }
  });

  return { c, images, ready: isSuccess };
}

/**
 * useGalleryItems()
 * Returns gallery items from the local API, or empty array if unavailable.
 */
export function useGalleryItems() {
  const queryClient = useQueryClient();
  const { data: items = [], isSuccess } = useQuery<GalleryItem[]>({
    queryKey: ["/api/public/gallery"],
    queryFn: fetchGalleryItems,
    staleTime: 2 * 60_000,
    retry: 1,
  });

  // Normalise field names — DB returns camelCase via drizzle
  const normalisedItems: GalleryItem[] = items.map((item: any) => ({
    id: item.id,
    imageUrl: item.imageUrl ?? item.image_url ?? "",
    caption: item.caption ?? null,
    category: item.category ?? null,
    sortOrder: item.sortOrder ?? item.sort_order ?? 0,
    active: item.active ?? true,
    createdAt: item.createdAt ?? item.created_at ?? 0,
  }));

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["/api/public/gallery"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/gallery"] });
  }

  return { items: normalisedItems, ready: isSuccess, refresh };
}

/**
 * useContentMutations()
 * setText(key, value)      — upsert a text/image key via PUT /api/admin/content/:key
 * setImage(key, url)       — alias for setText
 * uploadImage(file)        — resize, convert to base64 data URL, store via content endpoint, return data URL
 */
export function useContentMutations() {
  const queryClient = useQueryClient();

  async function setText(key: string, value: string): Promise<void> {
    await apiRequest("PUT", `/api/admin/content/${encodeURIComponent(key)}`, { value });
    queryClient.invalidateQueries({ queryKey: ["/api/public/content"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/content"] });
  }

  async function setImage(key: string, url: string): Promise<void> {
    return setText(key, url);
  }

  async function uploadImage(file: File): Promise<string> {
    const blob = await resizeToJpeg(file);
    const dataUrl = await blobToDataUrl(blob);
    return dataUrl;
  }

  // Gallery-specific mutations (used by admin ContentTab)
  const insertGalleryItem = useMutation({
    mutationFn: async (item: Omit<GalleryItem, "id" | "createdAt">) => {
      const res = await apiRequest("POST", "/api/admin/gallery", item);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public/gallery"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gallery"] });
    },
  });

  const updateGalleryItem = useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: Partial<GalleryItem> & { id: number }) => {
      const res = await apiRequest("PATCH", `/api/admin/gallery/${id}`, patch);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public/gallery"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gallery"] });
    },
  });

  const deleteGalleryItem = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/gallery/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public/gallery"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gallery"] });
    },
  });

  return {
    setText,
    setImage,
    uploadImage,
    insertGalleryItem,
    updateGalleryItem,
    deleteGalleryItem,
  };
}
