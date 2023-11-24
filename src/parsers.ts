export function floatJSONReplacer(key: string, value: any): any {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      return value.toString();
    } else {
      return parseFloat(value.toFixed(2));
    }
  }
  return value;
}