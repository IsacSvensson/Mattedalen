/**
 * The test version (docs/PLAN-TESTVERSION.md): the same app, built with
 * `vite build --mode staging` and published under ./test/. It shares the
 * origin with the real app, so it keeps its own database, caches and
 * resume mark, and never touches the real children's data.
 */
export const STAGING: boolean = typeof __STAGING__ === 'boolean' && __STAGING__;
