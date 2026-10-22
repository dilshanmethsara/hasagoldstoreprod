import { createClient } from "@supabase/supabase-js";

export async function uploadPaymentProof(
  signedUrl: string,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<void> {
  // Use XMLHttpRequest for upload progress tracking with signed URLs
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        const percentage = (event.loaded / event.total) * 100;
        onProgress(Math.round(percentage));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload"));
    });

    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.send(file);
  });
}
