// Dash callback IDs are non-empty strings or dictionaries of scalar values.
export function componentCallbackQuery(id) {
  if (typeof id === "string") return id.trim() && !/[.{]/.test(id) ? id : null;
  if (!id || typeof id !== "object" || Array.isArray(id)) return null;
  const prototype = Object.getPrototypeOf(id);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const keys = Object.keys(id).sort();
  if (!keys.every(key => typeof id[key] === "string" || typeof id[key] === "boolean"
    || (typeof id[key] === "number" && Number.isFinite(id[key])))) return null;
  return JSON.stringify(Object.fromEntries(keys.map(key => [key, id[key]])));
}

const WILDCARDS = new Set(["ALL", "MATCH", "ALLSMALLER"]);

function matchesPattern(dependency, id) {
  if (typeof dependency !== "string" || !dependency.startsWith("{")) return false;
  try {
    const pattern = JSON.parse(dependency.slice(0, dependency.lastIndexOf(".")));
    const keys = Object.keys(id);
    return Object.keys(pattern).length === keys.length && keys.every(key => {
      if (!Object.hasOwn(pattern, key)) return false;
      const value = pattern[key];
      return value === id[key] || (Array.isArray(value) && value.length === 1 && WILDCARDS.has(value[0]));
    });
  } catch { return false; }
}

export function createCallbackQueryMatcher(query) {
  const needle = query.trim().toLowerCase();
  let componentId = null;
  if (query.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(query);
      if (componentCallbackQuery(parsed) != null) componentId = parsed;
    } catch { /* Partial JSON still uses the ordinary text search. */ }
  }
  return row => {
    if (!needle) return true;
    if (componentId) {
      // Full dictionary IDs should also find callbacks registered with wildcards,
      // regardless of JSON whitespace or the order of dictionary keys.
      return [...(row.outputs || []), ...(row.inputs || []), ...(row.state || [])]
        .some(dependency => matchesPattern(dependency, componentId));
    }
    return `${row.outputText} ${row.inputText} ${row.stateText} ${row.sourceText} ${row.mode}`
      .toLowerCase().includes(needle);
  };
}
