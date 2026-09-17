export function blockProbedInteraction(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

export function selectProbedComponent(event, findComponent, onSelect) {
  const component = findComponent(event.target);
  blockProbedInteraction(event);
  if (component) onSelect(component);
  return component;
}
