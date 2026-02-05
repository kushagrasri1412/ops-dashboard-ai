export function sortByKey(items, key, direction) {
  const dir = direction === "desc" ? -1 : 1;
  return [...items].sort((a, b) => {
    const left = a?.[key];
    const right = b?.[key];

    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;

    if (typeof left === "number" && typeof right === "number") {
      return (left - right) * dir;
    }

    return String(left).localeCompare(String(right)) * dir;
  });
}
