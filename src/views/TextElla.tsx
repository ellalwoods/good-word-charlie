import type { ReactNode } from 'react';

// Ella's mobile (VITE_HELP_PHONE overrides it), in international form so it works from any phone.
const phone = ((import.meta.env.VITE_HELP_PHONE as string | undefined) || '+61435772613').replace(/[^\d+]/g, '');

/** Opens Messages with a text to Ella, already written. Nothing shows if no number is set. */
export function TextElla({ body, label = 'Text Ella' }: { body: string; label?: string }) {
  if (!phone) return null;
  // "?&body=" works on both iPhone and Android.
  return <a className="chip chip-text" href={`sms:${phone}?&body=${encodeURIComponent(body)}`}>{label}</a>;
}

/** An error, with a button to text Ella about it. */
export function Problem({ children, about }: { children: ReactNode; about: string }) {
  return (
    <div className="slip sync-error problem">
      <p>{children}</p>
      <TextElla body={`Good Word, Charlie isn’t working for me: ${about}`} />
    </div>
  );
}
