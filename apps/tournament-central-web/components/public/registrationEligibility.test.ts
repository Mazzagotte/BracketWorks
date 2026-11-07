import { describe, expect, it } from 'vitest';
import {
  ageOn,
  checkRegistrationEligibility,
  isValidUsbcNumber,
  normalizeGender,
  parseBirthDate,
  parseReferenceDate,
  requiredBowlerFields,
  type EligibilityBowler,
  type EligibilityDivision,
} from './registrationEligibility';
import {
  bracketPayoutLine,
  keepOfferedSelections,
  offeredSideEvents,
  sideEventLines,
  sideEventPayload,
  summarizeSideEvents,
  type PublicFeeConfig,
} from './registrationSideEvents';

// Messages match apps/api/tests/test_tc_eligibility.py so the form and server say the same thing.
const START = parseReferenceDate('2026-10-01');

function check(eventRules: unknown, division: EligibilityDivision, bowlers: EligibilityBowler[]) {
  return checkRegistrationEligibility({ event: eventRules === undefined ? {} : { rules: eventRules }, division, bowlers, referenceDate: START });
}

describe('registration eligibility', () => {
  it('checks nothing that setup did not configure', () => {
    expect(check(undefined, { name: 'Open' }, [{ first_name: 'Ann' }])).toEqual([]);
    expect(check({ average: { noAverage: 'assigned-average' }, team: {} }, null, [{ first_name: 'Ann' }])).toEqual([]);
  });

  it('applies division average limits', () => {
    const division = { name: 'Under 180', minAverage: 120, maxAverage: 179 };
    expect(check(undefined, division, [{ first_name: 'Ann', last_name: 'Lee', average: '185' }]))
      .toEqual(['Ann Lee: average 185 is above the Under 180 maximum of 179.']);
    expect(check(undefined, division, [{ first_name: 'Ann', last_name: 'Lee', average: '100' }]))
      .toEqual(['Ann Lee: average 100 is below the Under 180 minimum of 120.']);
    expect(check(undefined, division, [{ first_name: 'Ann', last_name: 'Lee', average: '179' }])).toEqual([]);
    expect(check(undefined, division, [{ first_name: 'Ann', last_name: 'Lee' }]))
      .toEqual(['Ann Lee: an average is required for Under 180.']);
  });

  it('uses the assigned average for a blank average, and requires one when the event says so', () => {
    const division = { name: 'Under 180', maxAverage: 179 };
    expect(check({ average: { noAverage: 'assigned-average', assignedAverage: 170 } }, division, [{ first_name: 'Ann' }])).toEqual([]);
    expect(check({ average: { noAverage: 'assigned-average', assignedAverage: 190 } }, division, [{ first_name: 'Ann' }])[0]).toContain('above');
    expect(check({ average: { noAverage: 'not-eligible', assignedAverage: 170 } }, null, [{ first_name: 'Ann', last_name: 'Lee' }]))
      .toEqual(['Ann Lee: an average is required for this event.']);
  });

  it('checks age on the first tournament day', () => {
    const seniors = { name: 'Seniors', minAge: 50 };
    const youth = { name: 'Youth', maxAge: 18 };
    expect(check(undefined, seniors, [{ first_name: 'Ann', date_of_birth: '1976-10-01' }])).toEqual([]);
    expect(check(undefined, seniors, [{ first_name: 'Ann', date_of_birth: '1976-10-02' }]))
      .toEqual(['Ann: must be at least 50 on the first day of the tournament for Seniors.']);
    expect(check(undefined, youth, [{ first_name: 'Ann', date_of_birth: '2007-10-01' }]))
      .toEqual(['Ann: must be 18 or younger on the first day of the tournament for Youth.']);
    expect(check(undefined, youth, [{ first_name: 'Ann', date_of_birth: '10/02/2007' }])).toEqual([]);
    expect(check(undefined, youth, [{ first_name: 'Ann' }])).toEqual(['Ann: a date of birth is required for Youth.']);
    expect(ageOn(parseBirthDate('2000-02-29')!, parseReferenceDate('2026-02-28')!)).toBe(25);
    expect(parseBirthDate('2026-02-30')).toBeNull();
  });

  it('checks division gender', () => {
    const women = { name: 'Women', rules: { gender: 'women', prizeType: 'cash' } };
    expect(check(undefined, women, [{ first_name: 'Ann', gender: 'F' }])).toEqual([]);
    expect(check(undefined, women, [{ first_name: 'Bob', gender: 'male' }])).toEqual(['Bob: Women is for women only.']);
    expect(check(undefined, women, [{ first_name: 'Ann' }])).toEqual(['Ann: gender is required for Women.']);
    expect(check(undefined, { name: 'Open', rules: { gender: 'any' } }, [{ first_name: 'Bob' }])).toEqual([]);
  });

  it('checks USBC numbers when required', () => {
    expect(check({ usbcRequired: true }, null, [{ first_name: 'Ann', usbc_number: '1234-56789' }])).toEqual([]);
    expect(check({ usbcRequired: true }, null, [{ first_name: 'Ann' }])).toEqual(['Ann: a USBC number is required for this event.']);
    expect(check({ usbcRequired: true }, null, [{ first_name: 'Ann', usbc_number: 'abc' }]))
      .toEqual(['Ann: enter the USBC number like 1234-56789.']);
    expect(isValidUsbcNumber('123456789')).toBe(true);
    expect(isValidUsbcNumber('12345 - 6789')).toBe(true);
    expect(isValidUsbcNumber('12-34')).toBe(false);
    expect(isValidUsbcNumber('1234-567-89')).toBe(false);
  });

  it('checks the combined average cap and mixed entries', () => {
    const rules = { team: { combinedAverageMax: 400, mixedRequired: true } };
    const pair: EligibilityBowler[] = [
      { first_name: 'Ann', last_name: 'Lee', average: '210', gender: 'F' },
      { first_name: 'Bob', last_name: 'Ray', average: '200', gender: 'F' },
    ];
    expect(check(rules, null, pair)).toEqual([
      "Combined average 410 is above this event's limit of 400.",
      'This event is mixed: include at least one man and one woman.',
    ]);
    pair[1] = { ...pair[1], average: '190', gender: 'M' };
    expect(check(rules, null, pair)).toEqual([]);
    pair[1] = { ...pair[1], gender: undefined };
    expect(check(rules, null, pair)).toEqual(['Bowler 2 (Bob Ray): gender is required for this mixed event.']);
  });

  it('normalizes gender and lists the fields the rules need', () => {
    expect(['M', 'female', 'Women', 'x', undefined].map(normalizeGender)).toEqual(['M', 'F', 'F', null, null]);
    expect(requiredBowlerFields({ rules: { usbcRequired: true, team: { mixedRequired: true } } }, { minAge: 50, maxAverage: 200 }))
      .toEqual(new Set(['usbc_number', 'gender', 'date_of_birth', 'average']));
    expect(requiredBowlerFields({ rules: {} }, null)).toEqual(new Set());
  });
});

const BRACKETS: PublicFeeConfig = {
  id: 'fee-brackets', name: 'Handicap brackets', amountCents: 500, required: false, enabled: true, displayOrder: 1,
  eventIds: [], divisionIds: [], squadIds: [],
  sideEvent: { kind: 'brackets', allowQuantity: true, maxQuantity: 10, per: 'bowler', brackets: { scoring: 'handicap', size: 8, firstPlaceCents: 3000, secondPlaceCents: 1000 } },
};
const HIGH_GAME: PublicFeeConfig = {
  id: 'fee-high-game', name: 'High game', amountCents: 1000, required: false, enabled: true, displayOrder: 2,
  eventIds: ['evt-singles'], sideEvent: { kind: 'high-game-pot', allowQuantity: false, per: 'bowler' },
};
const LINEAGE: PublicFeeConfig = {
  id: 'fee-lineage', name: 'Lineage', amountCents: 200, required: true, enabled: true, displayOrder: 3,
  sideEvent: { kind: 'fee', per: 'registration' },
};
const choice = { eventId: 'evt-singles', divisionId: 'div-open', squadId: 'sq-am' };

describe('registration side events', () => {
  it('offers enabled fees in scope, in display order', () => {
    const offered = offeredSideEvents([LINEAGE, HIGH_GAME, BRACKETS, { ...BRACKETS, id: 'off', enabled: false }], choice);
    expect(offered.map((item) => item.fee.id)).toEqual(['fee-brackets', 'fee-high-game', 'fee-lineage']);
    expect(offered.map((item) => item.maxQuantity)).toEqual([10, 1, 1]);
    expect(offeredSideEvents([HIGH_GAME], { ...choice, eventId: 'evt-doubles' })).toEqual([]);
  });

  it('prices picks plus required fees, and sends only optional picks', () => {
    const offered = offeredSideEvents([BRACKETS, HIGH_GAME, LINEAGE], choice);
    const selections = [{ feeId: 'fee-brackets', bowlerIndex: 0, quantity: 5 }, { feeId: 'fee-high-game', bowlerIndex: 0, quantity: 1 }];
    const lines = sideEventLines(offered, selections, 1);
    expect(lines.map((line) => [line.feeId, line.bowlerIndex, line.totalCents])).toEqual([
      ['fee-brackets', 0, 2500], ['fee-high-game', 0, 1000], ['fee-lineage', null, 200],
    ]);
    expect(sideEventPayload(selections)).toEqual([
      { fee_id: 'fee-brackets', bowler_index: 0, quantity: 5 },
      { fee_id: 'fee-high-game', bowler_index: 0, quantity: 1 },
    ]);
  });

  it('drops picks that no longer apply', () => {
    const offered = offeredSideEvents([BRACKETS, LINEAGE], choice);
    expect(keepOfferedSelections([
      { feeId: 'fee-brackets', bowlerIndex: 1, quantity: 2 },
      { feeId: 'fee-brackets', bowlerIndex: 0, quantity: 50 },
      { feeId: 'fee-high-game', bowlerIndex: 0, quantity: 1 },
      { feeId: 'fee-lineage', bowlerIndex: null, quantity: 1 },
    ], offered, 1)).toEqual([{ feeId: 'fee-brackets', bowlerIndex: 0, quantity: 10 }]);
  });

  it('describes bracket payouts and summarizes picks', () => {
    expect(bracketPayoutLine(offeredSideEvents([BRACKETS], choice)[0].settings)).toBe('Pays $30 and $10 per bracket');
    expect(bracketPayoutLine(offeredSideEvents([LINEAGE], choice)[0].settings)).toBeNull();
    expect(summarizeSideEvents([{ name: 'Brackets', quantity: 5 }, { name: 'High game', quantity: 1 }])).toBe('Brackets x5, High game');
  });
});
