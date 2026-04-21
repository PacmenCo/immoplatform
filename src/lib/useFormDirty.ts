"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Track whether a `<form>` has been edited since render. Works for both
 * controlled and uncontrolled inputs — listens for bubbling `input` and
 * `change` events on the form element.
 *
 * False-positive tolerant: once the user types anything the form is marked
 * dirty, and stays dirty until the form is re-mounted (e.g. after a
 * successful submit + server-action redirect). That's fine — the confirm
 * dialog is cheap, and we'd rather over-warn than lose edits.
 */
export function useFormDirty(ref: RefObject<HTMLFormElement | null>): boolean {
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const form = ref.current;
    if (!form) return;
    const markDirty = () => setDirty(true);
    // Reset dirty on a real submit so the subsequent navigation doesn't
    // trigger the guard. If the server action rejects and we stay on the
    // page, the user's next keystroke flips it back to dirty.
    const onSubmit = () => setDirty(false);
    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
    form.addEventListener("submit", onSubmit);
    return () => {
      form.removeEventListener("input", markDirty);
      form.removeEventListener("change", markDirty);
      form.removeEventListener("submit", onSubmit);
    };
  }, [ref]);

  return dirty;
}
