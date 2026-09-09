export function secureEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function secureEqualAny(value: string, candidates: Array<string | undefined>) {
  return candidates.some((candidate) => candidate !== undefined && secureEqual(value, candidate));
}
