import { useMemo, useState } from "react";
import { Download, ExternalLink, ImageIcon, Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type GalleryImage = {
  key: string;
  label: string;
  url: string;
};

const IMAGE_LABELS: Record<string, string> = {
  profile_photo: "Profile",
  garage_front: "Shop Front",
  shop_front: "Shop Front",
  tools_photo: "Tools",
  facilities_photo: "Facilities",
};

export default function TechnicianImageGallery({
  documents,
  resolveUrl,
}: {
  documents: Record<string, any>;
  resolveUrl: (value?: string) => string;
}) {
  const [selected, setSelected] = useState<GalleryImage | null>(null);
  const [zoom, setZoom] = useState(1);
  const images = useMemo(
    () =>
      Object.entries(documents || {})
        .filter(([, value]) => typeof value === "string" && String(value).trim())
        .map(([key, value]) => ({
          key,
          label: IMAGE_LABELS[key] || key.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
          url: resolveUrl(String(value)),
        }))
        .filter((item) => Boolean(item.url)),
    [documents, resolveUrl]
  );

  const openImage = (image: GalleryImage) => {
    setSelected(image);
    setZoom(1);
  };

  return (
    <>
      {images.length ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {images.map((image) => (
            <button
              key={image.key}
              type="button"
              className="group overflow-hidden rounded-xl border bg-muted/20 text-left"
              onClick={() => openImage(image)}
            >
              <div className="h-32 overflow-hidden bg-muted">
                <img
                  src={image.url}
                  alt={image.label}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
              <p className="px-3 py-2 text-xs font-semibold">{image.label}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex min-h-28 items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground">
          <ImageIcon className="h-5 w-5" />
          No registration images uploaded.
        </div>
      )}

      {selected ? (
        <div className="fixed inset-0 z-[180] flex flex-col bg-black/90 p-3" onClick={() => setSelected(null)}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-white" onClick={(event) => event.stopPropagation()}>
            <p className="font-semibold">{selected.label}</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}>
                <Minus className="h-4 w-4" />
              </Button>
              <span className="min-w-14 text-center text-sm">{Math.round(zoom * 100)}%</span>
              <Button size="sm" variant="secondary" onClick={() => setZoom((value) => Math.min(4, value + 0.25))}>
                <Plus className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="secondary" asChild>
                <a href={selected.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1 h-4 w-4" /> Full
                </a>
              </Button>
              <Button size="sm" variant="secondary" asChild>
                <a href={selected.url} download>
                  <Download className="mr-1 h-4 w-4" /> Download
                </a>
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setSelected(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-auto" onClick={(event) => event.stopPropagation()}>
            <img
              src={selected.url}
              alt={selected.label}
              className="max-h-full max-w-full object-contain transition-transform"
              style={{ transform: `scale(${zoom})` }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
