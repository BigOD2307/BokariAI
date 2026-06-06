export const register = async () => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Supabase handles database - no local migrations needed
    console.log('Bokari: Using Supabase for database and auth');

    await import('./lib/config/index');

    // Start the autonomous-content scheduler (Discover refresh, article
    // generation, weekly stats). Never during `next build` page-data collection.
    if (process.env.NEXT_PHASE !== 'phase-production-build') {
      try {
        const { startScheduler } = await import('./lib/scheduler');
        startScheduler();
      } catch (err) {
        console.error('[instrumentation] scheduler failed to start:', err);
      }
    }
  }
};
