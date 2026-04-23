/**
 * FormData/File construction helpers for upload-related integration tests.
 * Keeping these here instead of local-to-file prevents drift if a future test
 * needs its own variant — all uploads flow through the same builder.
 */

/** Build a stub File the upload action will accept (PDF by default). */
export function makeUploadFile(
  name: string,
  type = "application/pdf",
  content = "hello",
): File {
  // Browser File subclass inherits from Blob — Node's global File (≥ 20.x)
  // is fine. Content doesn't need real PDF bytes; the upload path only
  // checks mime + size.
  return new File([content], name, { type });
}

/** Build a multi-file FormData payload matching `uploadAssignmentFiles`. */
export function uploadForm(...files: File[]): FormData {
  const fd = new FormData();
  for (const f of files) fd.append("file", f);
  return fd;
}
