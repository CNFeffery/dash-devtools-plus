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

function matchesId(dependencyId, id) {
  if (typeof id === "string") return dependencyId === id;
  if (!dependencyId.startsWith("{")) return false;
  try {
    const pattern = JSON.parse(dependencyId);
    const keys = Object.keys(id);
    return Object.keys(pattern).length === keys.length && keys.every(key => {
      if (!Object.hasOwn(pattern, key)) return false;
      const value = pattern[key];
      return value === id[key] || (Array.isArray(value) && value.length === 1 && WILDCARDS.has(value[0]));
    });
  } catch { return false; }
}

function parseId(text) {
  if (text.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      return componentCallbackQuery(parsed) != null ? parsed : null;
    } catch { return null; }
  }
  return componentCallbackQuery(text);
}

function splitDependency(text) {
  if (typeof text !== "string") return null;
  const separator = text.lastIndexOf(".");
  if (separator < 1 || separator === text.length - 1) return null;
  return {id: text.slice(0, separator), property: text.slice(separator + 1)};
}

export function createCallbackQueryMatcher(query, searchMode = "fuzzy") {
  const needle = query.trim().toLowerCase();
  const property = query.trim();
  const componentId = searchMode === "exact-id" ? parseId(query) : null;
  return row => {
    if (!needle) return true;
    if (searchMode === "exact-id" || searchMode === "exact-property") {
      if (searchMode === "exact-id" && componentId == null) return false;
      // Dictionary key order is irrelevant; registered Dash wildcard dependencies
      // also refer to concrete IDs with the same keys and fixed values.
      return [...(row.outputs || []), ...(row.inputs || []), ...(row.state || [])]
        .some(dependency => {
          const parsed = splitDependency(dependency);
          return parsed != null && (searchMode === "exact-property"
            ? parsed.property === property : matchesId(parsed.id, componentId));
        });
    }
    return `${row.outputText} ${row.inputText} ${row.stateText} ${row.sourceText} ${row.mode}`
      .toLowerCase().includes(needle);
  };
}
