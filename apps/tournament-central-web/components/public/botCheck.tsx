/**
 * Bot check for public forms: a field people never see (simple bots fill in every field) and how
 * long the form was open (people take more than a few seconds). The server quietly ignores
 * anything that trips either one. See `looks_like_a_bot` in the API.
 */

export type BotCheckPayload = { company_website: string; fill_seconds: number | null };

export function botCheckPayload(trap: string | undefined, openedAt: number | undefined): BotCheckPayload {
  return {
    company_website: trap ?? '',
    fill_seconds: openedAt ? Math.round((Date.now() - openedAt) / 100) / 10 : null,
  };
}

/** Hidden from people and screen readers, skipped by Tab, and off for autofill. */
export function BotTrapField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="sr-only" aria-hidden="true">
      <label htmlFor="company-website-check">Company website</label>
      <input
        id="company-website-check"
        name="company_website_check"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
