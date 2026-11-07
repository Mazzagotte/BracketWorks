/**
 * Side events and fees on the registration form: which are offered for the chosen event, division,
 * and squad, and a running total. The server prices every line again from setup
 * (apps/api/app/services/tc_side_events.py); these numbers are only a preview.
 */
import { normalizeSideEvent, type SideEventSelection, type SideEventSettings } from '@/components/organizer/formatTypes';

/** A fee as the public registration config sends it. */
export type PublicFeeConfig = {
  id: string;
  name: string;
  amountCents?: number;
  required?: boolean;
  enabled?: boolean;
  displayOrder?: number;
  eventIds?: string[];
  divisionIds?: string[];
  squadIds?: string[];
  sideEvent?: unknown;
};

export type OfferedSideEvent = {
  fee: PublicFeeConfig;
  settings: SideEventSettings;
  amountCents: number;
  /** Highest quantity a bowler may pick; 1 when it's yes or no. */
  maxQuantity: number;
};

export type SideEventLine = SideEventSelection & {
  name: string;
  unitCents: number;
  totalCents: number;
  required: boolean;
};

/** Matches the server's limit when an organizer allows a quantity but sets no maximum. */
export const DEFAULT_MAX_QUANTITY = 99;

const moneyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatSideEventMoney(cents: number): string {
  const text = moneyFormatter.format(cents / 100);
  return text.endsWith('.00') ? text.slice(0, -3) : text;
}

function inList(ids: string[] | undefined, chosen: string): boolean {
  return !Array.isArray(ids) || ids.length === 0 || ids.includes(chosen);
}

/** Enabled fees for this event, division, and squad. Empty id lists mean every one. */
export function offeredSideEvents(
  fees: PublicFeeConfig[] | undefined,
  choice: { eventId: string; divisionId: string; squadId: string },
): OfferedSideEvent[] {
  return (fees ?? [])
    .filter((fee) => fee.enabled !== false && fee.id)
    .filter((fee) => inList(fee.eventIds, choice.eventId) && inList(fee.divisionIds, choice.divisionId) && inList(fee.squadIds, choice.squadId))
    .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0))
    .map((fee) => {
      const settings = normalizeSideEvent(fee.sideEvent);
      const amountCents = typeof fee.amountCents === 'number' && fee.amountCents > 0 ? Math.floor(fee.amountCents) : 0;
      const maxQuantity = settings.allowQuantity
        ? (settings.maxQuantity && settings.maxQuantity > 0 ? settings.maxQuantity : DEFAULT_MAX_QUANTITY)
        : 1;
      return { fee, settings, amountCents, maxQuantity };
    });
}

/** "Pays $30 and $10 per bracket" for a brackets side event. */
export function bracketPayoutLine(settings: SideEventSettings): string | null {
  if (!settings.brackets) return null;
  return `Pays ${formatSideEventMoney(settings.brackets.firstPlaceCents)} and ${formatSideEventMoney(settings.brackets.secondPlaceCents)} per bracket`;
}

/** Drops picks that are no longer offered (event, division, or squad changed) or point at a missing bowler. */
export function keepOfferedSelections(
  selections: SideEventSelection[] | undefined,
  offered: OfferedSideEvent[],
  bowlerCount: number,
): SideEventSelection[] {
  const byId = new Map(offered.map((item) => [item.fee.id, item]));
  return (selections ?? []).filter((selection) => {
    const item = byId.get(selection.feeId);
    if (!item || item.fee.required || selection.quantity < 1) return false;
    if (item.settings.per === 'bowler') return selection.bowlerIndex !== null && selection.bowlerIndex < bowlerCount;
    return selection.bowlerIndex === null;
  }).map((selection) => {
    const item = byId.get(selection.feeId);
    return item ? { ...selection, quantity: Math.min(selection.quantity, item.maxQuantity) } : selection;
  });
}

/** Every line that will be charged: the bowler's picks plus required fees, in the server's order. */
export function sideEventLines(
  offered: OfferedSideEvent[],
  selections: SideEventSelection[] | undefined,
  bowlerCount: number,
): SideEventLine[] {
  const picked = keepOfferedSelections(selections, offered, bowlerCount);
  const lines: SideEventLine[] = [];
  offered.forEach((item) => {
    const indexes: Array<number | null> = item.settings.per === 'bowler'
      ? Array.from({ length: bowlerCount }, (_, index) => index)
      : [null];
    indexes.forEach((bowlerIndex) => {
      const quantity = item.fee.required
        ? 1
        : picked.find((selection) => selection.feeId === item.fee.id && selection.bowlerIndex === bowlerIndex)?.quantity ?? 0;
      if (quantity < 1) return;
      lines.push({
        feeId: item.fee.id,
        bowlerIndex,
        quantity,
        name: item.fee.name || 'Side event',
        unitCents: item.amountCents,
        totalCents: item.amountCents * quantity,
        required: Boolean(item.fee.required),
      });
    });
  });
  return lines;
}

/** The payload the registration API takes: optional picks only (the server adds required fees). */
export function sideEventPayload(selections: SideEventSelection[] | undefined): Array<{ fee_id: string; bowler_index: number | null; quantity: number }> {
  return (selections ?? [])
    .filter((selection) => selection.quantity > 0)
    .map((selection) => ({ fee_id: selection.feeId, bowler_index: selection.bowlerIndex, quantity: selection.quantity }));
}

/** "Brackets x5, High game" for organizer lists. */
export function summarizeSideEvents(items: Array<{ name: string; quantity: number }>): string {
  return items.map((item) => (item.quantity > 1 ? `${item.name} x${item.quantity}` : item.name)).join(', ');
}
