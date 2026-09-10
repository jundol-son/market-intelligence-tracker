export function sparklinePoints(values: number[], width = 100, height = 32): string {
  if (!values.length) return '';
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  return values.map((value, index) =>
    `${values.length === 1 ? width / 2 : index * width / (values.length - 1)},${height - (value - min) * height / span}`,
  ).join(' ');
}
