import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '@/lib/db';

/**
 * Loads the user's stored Google OAuth tokens from the Account table and
 * constructs an OAuth2 client that auto-refreshes and persists new tokens
 * back to the DB.
 */
async function getOAuth2Client(userId: string): Promise<OAuth2Client> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'google' },
  });

  if (!account) {
    throw new Error(`No Google account linked for user ${userId}`);
  }
  if (!account.access_token) {
    throw new Error(`Google account for user ${userId} has no access token`);
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token ?? undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
    token_type: account.token_type ?? undefined,
    scope: account.scope ?? undefined,
    id_token: account.id_token ?? undefined,
  });

  // Persist refreshed tokens back to the Account row so we don't lose them.
  oauth2Client.on('tokens', async (tokens) => {
    const update: Record<string, unknown> = {};
    if (tokens.access_token) update.access_token = tokens.access_token;
    if (tokens.refresh_token) update.refresh_token = tokens.refresh_token;
    if (tokens.expiry_date) update.expires_at = Math.floor(tokens.expiry_date / 1000);
    if (tokens.id_token) update.id_token = tokens.id_token;
    if (tokens.scope) update.scope = tokens.scope;
    if (tokens.token_type) update.token_type = tokens.token_type;

    if (Object.keys(update).length > 0) {
      await prisma.account.update({
        where: { id: account.id },
        data: update,
      });
    }
  });

  return oauth2Client;
}

export async function getCalendarClient(userId: string): Promise<calendar_v3.Calendar> {
  const auth = await getOAuth2Client(userId);
  return google.calendar({ version: 'v3', auth });
}

export async function listCalendars(userId: string) {
  const calendar = await getCalendarClient(userId);
  const res = await calendar.calendarList.list();
  return res.data.items ?? [];
}

export async function listEvents(
  userId: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date
) {
  const calendar = await getCalendarClient(userId);
  const res = await calendar.events.list({
    calendarId,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });
  return res.data.items ?? [];
}

export async function createEvent(
  userId: string,
  calendarId: string,
  event: calendar_v3.Schema$Event
) {
  const calendar = await getCalendarClient(userId);
  const res = await calendar.events.insert({
    calendarId,
    requestBody: event,
  });
  return res.data;
}

export async function updateEvent(
  userId: string,
  calendarId: string,
  eventId: string,
  event: calendar_v3.Schema$Event
) {
  const calendar = await getCalendarClient(userId);
  const res = await calendar.events.update({
    calendarId,
    eventId,
    requestBody: event,
  });
  return res.data;
}

export async function deleteEvent(
  userId: string,
  calendarId: string,
  eventId: string
) {
  const calendar = await getCalendarClient(userId);
  await calendar.events.delete({ calendarId, eventId });
}
