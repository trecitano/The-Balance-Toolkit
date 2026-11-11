import { SyntheticEvent } from "react";

export function getBlockImage(id: string) {
  return `/activities/${id}.svg`;
}

/** The toolkit's flamingo logo, for when there is no activity picture to show. */
export const LOGO_IMAGE = getBlockImage("logo-flamingo-blue");

/**
 * `onError` for activity pictures: shows the logo when the picture doesn't exist, such as one
 * named in a hand-edited activities file.
 */
export function showLogoInstead(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (!image.src.endsWith(LOGO_IMAGE)) image.src = LOGO_IMAGE;
}
