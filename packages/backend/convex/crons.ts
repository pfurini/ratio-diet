import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

crons.weekly(
  'delete old webhook events',
  { dayOfWeek: 'sunday', hourUTC: 2, minuteUTC: 0 },
  internal.webhookCleanup.deleteOldWebhookEvents
);

export default crons;
