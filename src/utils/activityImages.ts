export function getActivityAssetFullPath(activityId: string, assetName: string): string {
  return `/src/assets/activities/${activityId}/${assetName}`;
}

// src/utils/activityImages.ts
const activityImageModules = import.meta.glob("/src/assets/activities/**/*.svg", {
  eager: true,
  as: "url",
});

interface ImageItem {
  path: string;
  image: string;
}

export function getActivityImages(activityId: string): string[] {
  if (!activityId) return [];

  const images: ImageItem[] = [];
  const regex = new RegExp(`/src/assets/activities/${activityId}.*/${activityId}[\\d\\w-]+\\.svg$`);

  Object.entries(activityImageModules).forEach(([path, imageUrl]) => {
    if (regex.test(path)) images.push({ path, image: imageUrl });
  });

  const sorted = images.sort((a, b) => {
    const aMatch = a.path.match(new RegExp(`${activityId}(\\d+)`));
    const bMatch = b.path.match(new RegExp(`${activityId}(\\d+)`));
    if (aMatch && bMatch) return +aMatch[1] - +bMatch[1];
    return a.path.localeCompare(b.path);
  });

  return sorted.map((i) => i.image);
}

export function getActionImage(activityId: string, actionLabel: string): string | undefined {
  const matches: ImageItem[] = [];

  // 1) activityId-actionLabel.svg or activityId-actionLabel-N.svg
  const regex1 = new RegExp(`/src/assets/activities/${activityId}.*/${activityId}-${actionLabel}(-\\d+)?\\.svg$`);

  // 2) activityIdN-actionLabel.svg
  const regex2 = new RegExp(`/src/assets/activities/${activityId}.*/${activityId}\\d+-${actionLabel}\\.svg$`);

  Object.entries(activityImageModules).forEach(([path, imageUrl]) => {
    if (regex1.test(path) || regex2.test(path)) {
      matches.push({ path, image: imageUrl });
    }
  });

  if (matches.length > 0) {
    const sorted = matches.sort((a, b) => {
      const aMatch = a.path.match(/(\d+)\.svg$/) || a.path.match(/(\d+)-/);
      const bMatch = b.path.match(/(\d+)\.svg$/) || b.path.match(/(\d+)-/);
      if (aMatch && bMatch) return +aMatch[1] - +bMatch[1];
      return a.path.localeCompare(b.path);
    });
    return sorted[0].image;
  }

  const defaults = getActivityImages(activityId);
  return defaults[0];
}
