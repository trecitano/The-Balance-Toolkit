/** The colours a user can pick. */
export const USER_COLORS = ["#e55d82", "#409edb", "#e8bd00", "#894c2f", "#dd2020", "#2a2a2a", "#989898", "#9bbc0f"];

/** Shown for a user without a colour. It is one of the choices, so the picker can show it selected. */
export const NO_COLOR = "#989898";

export const userColor = (user: { color: string | null }) => user.color ?? NO_COLOR;
