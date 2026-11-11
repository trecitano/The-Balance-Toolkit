// The raised, clickable tile used across the welcome page's cards. It lifts on hover.
// Background and alignment are left to each tile: two classes for the same property would leave
// the winner to the stylesheet's order, not the order they're written in.
export const tile =
  "group relative flex w-full cursor-pointer rounded-lg shadow-sm ring-1 ring-black/5 transition-all " +
  "hover:-translate-y-px hover:shadow-md hover:ring-(--primary)/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
