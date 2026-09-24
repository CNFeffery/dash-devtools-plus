// Keep G2's own legend in charge of interaction while retaining the user's
// selection when a live chart receives new data.
export function createLiveLegendChart(chart, series, initialData, selectionRef) {
  let currentData = initialData;
  let destroyed = false;

  // changeData() performs a full G2 render and recreates legendFilter. Keep the
  // interaction's initial state in sync before that render starts so G2 never
  // paints an intermediate frame with every series selected.
  const syncDefaultSelection = () => {
    const legends = chart.legend();
    const colorLegend = legends?.color;
    if (!colorLegend || colorLegend === true) return;
    const nextColorLegend = {...colorLegend};
    if (selectionRef.current === null) delete nextColorLegend.defaultSelect;
    else nextColorLegend.defaultSelect = [...selectionRef.current];
    chart.legend("color", nextColorLegend);
  };

  chart.on("legend:filter", ({nativeEvent, data}) => {
    if (nativeEvent && data?.channel === "color" && Array.isArray(data.values)) {
      selectionRef.current = series.filter((value) => data.values.includes(value));
      syncDefaultSelection();
    }
  });
  chart.on("legend:focus", ({nativeEvent, data}) => {
    if (nativeEvent && data?.channel === "color" && series.includes(data.value)) {
      selectionRef.current = [data.value];
      syncDefaultSelection();
    }
  });
  chart.on("legend:reset", ({nativeEvent}) => {
    if (nativeEvent) {
      selectionRef.current = null;
      syncDefaultSelection();
    }
  });

  syncDefaultSelection();
  let pending = Promise.resolve(chart.render());

  return {
    update(nextData) {
      if (nextData === currentData) return pending;
      currentData = nextData;
      pending = pending.catch(() => {}).then(async () => {
        if (destroyed) return;
        syncDefaultSelection();
        await chart.changeData(nextData);
      });
      return pending;
    },
    destroy() {
      destroyed = true;
      chart.destroy();
    },
  };
}

export function seriesGradient(datum, field, gradients) {
  const record = Array.isArray(datum) ? datum[0] : datum;
  return gradients[record?.[field]];
}
