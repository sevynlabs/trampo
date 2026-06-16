import { router } from './trpc';
import { authRouter } from './modules/auth/router';
import { profilesRouter } from './modules/profiles/router';
import { kycRouter } from './modules/kyc/router';
import { categoriesRouter } from './modules/categories/router';
import { tasksRouter } from './modules/tasks/router';
import { feedRouter } from './modules/feed/router';
import { matchingRouter } from './modules/matching/router';
import { chatRouter } from './modules/chat/router';
import { reviewsRouter } from './modules/reviews/router';
import { paymentsRouter } from './modules/payments/router';

/**
 * Main application router
 * Combines all module routers
 */
export const appRouter = router({
  auth: authRouter,
  profiles: profilesRouter,
  kyc: kycRouter,
  categories: categoriesRouter,
  tasks: tasksRouter,
  feed: feedRouter,
  matching: matchingRouter,
  chat: chatRouter,
  reviews: reviewsRouter,
  payments: paymentsRouter,
});

// Export type for client
export type AppRouter = typeof appRouter;
