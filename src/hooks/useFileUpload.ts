"use client";

import { useCallback } from "react";

import { usePresignMutation } from "@/store/api/workerApi";
import { createLogger } from "@/lib/logger";
import type { PresignPurpose } from "@/types/worker";

const log = createLogger("upload");

/**
 * Returns an `upload(file, purpose)` function that performs the two-step direct
 * upload: ask the BFF for a Cloudinary signed credential, then POST the binary
 * straight to Cloudinary (never through our server). Resolves to the hosted
 * `secure_url` to hand to a profile endpoint.
 */
export function useFileUpload() {
  const [presign] = usePresignMutation();

  return useCallback(
    async (file: File, purpose: PresignPurpose): Promise<string> => {
      // 1) Ask the BFF for a one-shot Cloudinary signed credential.
      let cred;
      try {
        cred = await presign({ purpose }).unwrap();
      } catch (err) {
        const message =
          (err as { data?: { message?: string } })?.data?.message ??
          "Could not start the upload. Try again.";
        log.warn("presign failed", { purpose, message });
        throw new Error(message);
      }

      // 2) Upload the binary straight to Cloudinary. A signed upload must send
      // *exactly* the params the backend put in the signature, with identical
      // values — any extra or missing one yields "Invalid Signature". The backend
      // signs `{ folder, public_id, timestamp }`, so send those three (plus the
      // reserved `file`/`api_key`/`signature`). `transformation` is returned for
      // reference but is NOT signed, so it must NOT be sent here.
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", cred.api_key);
      form.append("timestamp", String(cred.timestamp));
      form.append("signature", cred.signature);
      form.append("public_id", cred.public_id);
      form.append("folder", cred.folder);

      let res: Response;
      try {
        res = await fetch(cred.upload_url, { method: "POST", body: form });
      } catch {
        throw new Error("Network error during upload. Check your connection.");
      }

      const json = (await res.json().catch(() => null)) as
        | { secure_url?: string; error?: { message?: string } }
        | null;

      if (!res.ok || !json?.secure_url) {
        // Cloudinary's error embeds the exact "String to sign", which reveals
        // precisely which params it verified against — surface it verbatim so a
        // signature mismatch is debuggable instead of a generic failure.
        const detail = json?.error?.message ?? `HTTP ${res.status}`;
        log.warn("cloudinary upload failed", { purpose, status: res.status, detail });
        throw new Error(detail);
      }

      log.debug("uploaded", { purpose });
      return json.secure_url;
    },
    [presign],
  );
}
