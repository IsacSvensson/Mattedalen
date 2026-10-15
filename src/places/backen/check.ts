export { CHECK_EVERY_PLAY_DAYS, checkDue } from '../../shell/check';

/** Set when the child chose "not now": the check waits until another day. */
export const checkLaterKey = (profileId: string) => `brookCheckLater:${profileId}`;
