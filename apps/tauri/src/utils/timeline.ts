import { TimelineBlock } from "@/types.ts";

/** The shortest an action can last, in seconds. */
export const MIN_DURATION = 1;
/** The largest whole number the backend stores, for a duration or a repeat count. */
export const MAX_WHOLE_NUMBER = 2147483647;

/** Whether `seconds` is a duration the backend accepts: whole, and from MIN_DURATION up. */
export const isValidDuration = (seconds: number) =>
  Number.isSafeInteger(seconds) && seconds >= MIN_DURATION && seconds <= MAX_WHOLE_NUMBER;

/** How long one round of an activity's actions lasts, in seconds. */
export const roundSeconds = (blocks: TimelineBlock[]) => blocks.reduce((sum, block) => sum + block.duration, 0);
