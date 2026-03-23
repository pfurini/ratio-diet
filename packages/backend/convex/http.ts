import { httpRouter } from 'convex/server';
import { registerRoutes } from '@convex-dev/stripe';

import { components } from './_generated/api';
import { authComponent, createAuth } from './auth';

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

registerRoutes(http, components.stripe, {
  webhookPath: '/stripe/webhook',
});

export default http;
