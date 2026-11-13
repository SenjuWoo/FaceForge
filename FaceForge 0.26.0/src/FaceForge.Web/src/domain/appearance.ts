import { rawLandmarksFromDataUrl } from "./headRender";
import { extractPhotoColors, type PhotoColors } from "./photoColors";

/** Reads skin, lip, iris and hair colours from a photo URL (data or blob). Null when no face is found. */
export async function readPhotoColors(url: string): Promise<PhotoColors | null> {
  const raw = await rawLandmarksFromDataUrl(url);
  if (!raw) return null;
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("The photo could not be loaded."));
    el.src = url;
  });
  const scale = Math.min(1, 1536 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return extractPhotoColors(context.getImageData(0, 0, canvas.width, canvas.height), raw.landmarks);
}
