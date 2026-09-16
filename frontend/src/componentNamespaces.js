export const EXCLUDED_COMPONENT_NAMESPACES = new Set([
  "DashDevtoolsPlus",
  "plotly_cloud_publish_component",
]);

export function isExcludedComponentNamespace(namespace) {
  return typeof namespace === "string" && EXCLUDED_COMPONENT_NAMESPACES.has(namespace);
}
