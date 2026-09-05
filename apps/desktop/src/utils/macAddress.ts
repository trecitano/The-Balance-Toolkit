export const convertNumberToMacAddress = (number: number): string => {
  return number
    .toString(16)
    .toUpperCase()
    .padStart(12, "0")
    .match(/.{1,2}/g)!
    .join(":");
};
