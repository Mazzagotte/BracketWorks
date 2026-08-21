import type { OrganizerRegistrationRecord } from './organizerApi';
import type { SquadConfig } from './types';

export type PaymentSummary = {
  expectedCents: number;
  paidCents: number;
  unpaidCents: number;
  refundedCents: number;
  paidCount: number;
};

// Derived only from real total_cents / payment_status / status fields; never estimated.
export function buildPaymentSummary(registrations: OrganizerRegistrationRecord[]): PaymentSummary {
  const summary: PaymentSummary = {
    expectedCents: 0,
    paidCents: 0,
    unpaidCents: 0,
    refundedCents: 0,
    paidCount: 0,
  };

  for (const registration of registrations) {
    const status = registration.status ?? 'pending';
    const amountCents = registration.total_cents ?? 0;

    if (status === 'refunded') {
      summary.refundedCents += amountCents;
      continue;
    }

    if (status === 'cancelled') {
      continue;
    }

    summary.expectedCents += amountCents;
    if (registration.payment_status === 'paid') {
      summary.paidCents += amountCents;
      summary.paidCount += 1;
    } else {
      summary.unpaidCents += amountCents;
    }
  }

  return summary;
}

export type ParticipantRow = {
  key: string;
  firstName: string;
  lastName: string;
  usbcNumber: string | null;
  average: number | null;
  email: string | null;
  phone: string | null;
  events: string[];
  divisions: string[];
  squads: string[];
  entryCount: number;
  paymentStatus: 'paid' | 'unpaid' | 'mixed';
};

// A participant is a unique bowler, distinct from the registration submission that added them.
export function buildParticipantRows(registrations: OrganizerRegistrationRecord[]): ParticipantRow[] {
  type MutableRow = ParticipantRow & { paidCount: number; unpaidCount: number };
  const rowsByKey = new Map<string, MutableRow>();

  for (const registration of registrations) {
    const status = registration.status ?? 'pending';
    if (status === 'cancelled' || status === 'refunded') {
      continue;
    }

    const isPaid = registration.payment_status === 'paid';

    for (const entry of registration.entries ?? []) {
      const bowlers = entry.bowlers && entry.bowlers.length > 0
        ? entry.bowlers
        : [{
          id: entry.id,
          first_name: registration.contact_first_name ?? registration.form?.first_name ?? '',
          last_name: registration.contact_last_name ?? registration.form?.last_name ?? '',
          email: registration.contact_email ?? registration.form?.email ?? null,
          phone: registration.contact_phone ?? registration.form?.phone ?? null,
          usbc_number: null,
          average: null,
        }];

      for (const bowler of bowlers) {
        const firstName = bowler.first_name?.trim() ?? '';
        const lastName = bowler.last_name?.trim() ?? '';
        const usbcNumber = bowler.usbc_number?.trim() ?? '';
        const email = bowler.email?.trim().toLowerCase() ?? '';
        const key = usbcNumber || email || `${firstName.toLowerCase()}|${lastName.toLowerCase()}`;
        if (!key || (!firstName && !lastName)) {
          continue;
        }

        let row = rowsByKey.get(key);
        if (!row) {
          row = {
            key,
            firstName,
            lastName,
            usbcNumber: bowler.usbc_number ?? null,
            average: bowler.average ?? null,
            email: bowler.email ?? null,
            phone: bowler.phone ?? null,
            events: [],
            divisions: [],
            squads: [],
            entryCount: 0,
            paymentStatus: 'unpaid',
            paidCount: 0,
            unpaidCount: 0,
          };
          rowsByKey.set(key, row);
        }

        row.entryCount += 1;
        if (isPaid) {
          row.paidCount += 1;
        } else {
          row.unpaidCount += 1;
        }
        if (!row.usbcNumber && bowler.usbc_number) {
          row.usbcNumber = bowler.usbc_number;
        }
        if ((row.average === null || row.average === undefined) && typeof bowler.average === 'number') {
          row.average = bowler.average;
        }
        if (!row.email && bowler.email) {
          row.email = bowler.email;
        }
        if (!row.phone && bowler.phone) {
          row.phone = bowler.phone;
        }

        const eventName = entry.event_name || entry.event_config_id;
        if (eventName && !row.events.includes(eventName)) {
          row.events.push(eventName);
        }
        if (entry.division_name && !row.divisions.includes(entry.division_name)) {
          row.divisions.push(entry.division_name);
        }
        if (entry.squad_name && !row.squads.includes(entry.squad_name)) {
          row.squads.push(entry.squad_name);
        }
      }
    }
  }

  return [...rowsByKey.values()]
    .map((row) => ({
      ...row,
      paymentStatus: row.paidCount > 0 && row.unpaidCount > 0 ? 'mixed' as const : row.paidCount > 0 ? 'paid' as const : 'unpaid' as const,
    }))
    .sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`));
}

export type RegistrationSummary = {
  total: number;
  confirmed: number;
  pending: number;
  waitlisted: number;
  cancelled: number;
  paid: number;
  unpaid: number;
  confirmedUnpaid: number;
};

export function buildRegistrationSummary(registrations: OrganizerRegistrationRecord[]): RegistrationSummary {
  const summary: RegistrationSummary = {
    total: 0,
    confirmed: 0,
    pending: 0,
    waitlisted: 0,
    cancelled: 0,
    paid: 0,
    unpaid: 0,
    confirmedUnpaid: 0,
  };

  for (const registration of registrations) {
    summary.total += 1;
    const status = registration.status ?? 'pending';

    if (status === 'confirmed') {
      summary.confirmed += 1;
    } else if (status === 'waitlisted') {
      summary.waitlisted += 1;
    } else if (status === 'cancelled' || status === 'refunded') {
      summary.cancelled += 1;
    } else {
      summary.pending += 1;
    }

    const isPaid = registration.payment_status === 'paid';
    if (isPaid) {
      summary.paid += 1;
    } else {
      summary.unpaid += 1;
    }

    if (status === 'confirmed' && !isPaid) {
      summary.confirmedUnpaid += 1;
    }
  }

  return summary;
}

export type SquadStatus = 'Open' | 'Nearly Full' | 'Full' | 'Waitlist';

export type SquadSummary = {
  squad: SquadConfig;
  registered: number;
  waitlisted: number;
  available: number | null;
  status: SquadStatus;
};

// A whole registration (not each individual entry) is treated as occupying or waitlisting the squad it is assigned to.
export function buildSquadSummaries(squads: SquadConfig[], registrations: OrganizerRegistrationRecord[]): SquadSummary[] {
  return squads.map((squad) => {
    let registered = 0;
    let waitlisted = 0;

    for (const registration of registrations) {
      const status = registration.status ?? 'pending';
      if (status === 'cancelled' || status === 'refunded') {
        continue;
      }

      const isAssignedToSquad = (registration.entries ?? []).some((entry) => entry.squad_config_id === squad.id);
      if (!isAssignedToSquad) {
        continue;
      }

      if (status === 'waitlisted') {
        waitlisted += 1;
      } else {
        registered += 1;
      }
    }

    const capacity = squad.capacity > 0 ? squad.capacity : 0;
    const available = capacity > 0 ? Math.max(capacity - registered, 0) : null;

    let status: SquadStatus = 'Open';
    if (capacity > 0 && registered >= capacity) {
      status = waitlisted > 0 ? 'Waitlist' : 'Full';
    } else if (capacity > 0 && registered / capacity >= 0.85) {
      status = 'Nearly Full';
    } else if (waitlisted > 0) {
      status = 'Waitlist';
    }

    return { squad, registered, waitlisted, available, status };
  });
}

export type TournamentAttentionItem = {
  id: string;
  message: string;
  href: string;
};

export function buildTournamentAttentionItems(params: {
  tournamentId: number;
  isPublished: boolean;
  startDate: string | null | undefined;
  location: string | null | undefined;
  eventCount: number;
  hasRulesDocument: boolean;
  registrationCloseIso: string | null;
  squadSummaries: SquadSummary[];
  registrationSummary: RegistrationSummary;
  referenceDate?: Date;
}): TournamentAttentionItem[] {
  const items: TournamentAttentionItem[] = [];
  const overviewHref = organizerRoutes.overview(params.tournamentId);
  const setupHref = organizerRoutes.setup(params.tournamentId);
  const registrationsHref = organizerRoutes.registrations(params.tournamentId);
  const squadsHref = organizerRoutes.squads(params.tournamentId);

  if (!params.isPublished) {
    items.push({ id: 'unpublished', message: 'Setup changes are not published yet.', href: setupHref });
  }
  if (!params.startDate) {
    items.push({ id: 'dates', message: 'Tournament dates are missing.', href: setupHref });
  }
  if (!params.location) {
    items.push({ id: 'location', message: 'Tournament location is missing.', href: setupHref });
  }
  if (params.eventCount === 0) {
    items.push({ id: 'events', message: 'No events are configured yet.', href: setupHref });
  }
  if (params.squadSummaries.length === 0) {
    items.push({ id: 'squads', message: 'No squads are configured yet.', href: setupHref });
  }
  if (!params.hasRulesDocument) {
    items.push({ id: 'rules', message: 'A rules document has not been uploaded.', href: setupHref });
  }

  const today = params.referenceDate ?? new Date();

  if (params.registrationCloseIso) {
    const closeDate = new Date(`${params.registrationCloseIso}T00:00:00`);
    if (!Number.isNaN(closeDate.getTime())) {
      const daysUntilClose = Math.ceil((closeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilClose >= 0 && daysUntilClose <= 3) {
        items.push({
          id: 'closing-soon',
          message: `Registration closes in ${daysUntilClose} day${daysUntilClose === 1 ? '' : 's'}.`,
          href: registrationsHref,
        });
      }
    }
  }

  if (params.startDate) {
    const startDate = new Date(`${params.startDate}T00:00:00`);
    if (!Number.isNaN(startDate.getTime())) {
      const daysUntilStart = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilStart >= 0 && daysUntilStart <= 7) {
        items.push({
          id: 'starting-soon',
          message: `Tournament starts in ${daysUntilStart} day${daysUntilStart === 1 ? '' : 's'}.`,
          href: overviewHref,
        });
      }
    }
  }

  for (const summary of params.squadSummaries) {
    if (summary.status === 'Full') {
      items.push({ id: `squad-full-${summary.squad.id}`, message: `${summary.squad.name} is full.`, href: squadsHref });
    } else if (summary.status === 'Nearly Full') {
      items.push({ id: `squad-near-${summary.squad.id}`, message: `${summary.squad.name} is nearly full.`, href: squadsHref });
    }

    if (summary.waitlisted > 0) {
      items.push({
        id: `squad-wait-${summary.squad.id}`,
        message: `${summary.squad.name} has ${summary.waitlisted} on the waitlist.`,
        href: squadsHref,
      });
    }
  }

  if (params.registrationSummary.confirmedUnpaid > 0) {
    const count = params.registrationSummary.confirmedUnpaid;
    items.push({
      id: 'unpaid',
      message: `${count} confirmed registration${count === 1 ? '' : 's'} unpaid.`,
      href: registrationsHref,
    });
  }

  return items;
}
import { organizerRoutes } from './organizerRoutes';
