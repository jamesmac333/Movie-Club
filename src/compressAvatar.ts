// Crops a photo to a square and shrinks it so profile pictures stay small in the database
export function compressAvatar(file: File, maxDim = 320, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) {
        reject(new Error("Empty image file"));
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;
          const minDim = Math.min(width, height);
          const startX = (width - minDim) / 2;
          const startY = (height - minDim) / 2;

          const canvas = document.createElement("canvas");
          canvas.width = maxDim;
          canvas.height = maxDim;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }
          // Square crop and compress
          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, maxDim, maxDim);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (canvasErr) {
          resolve(rawDataUrl);
        }
      };
      img.onerror = () => {
        // If browser image element failed to decode but file is reasonable size, fallback to raw data URL
        if (file.size < 5 * 1024 * 1024 && rawDataUrl) {
          resolve(rawDataUrl);
        } else {
          reject(new Error("Failed to load image"));
        }
      };
      img.src = rawDataUrl;
    };
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}
