(function registerTestComponents(global) {
  const React = global.React;
  const PropTypes = global.PropTypes;

  function ForwardedLayer({id, setProps, slot}) {
    return React.createElement(
      "section",
      {
        id,
        "data-testid": "component-prop-carrier",
        style: {
          border: "2px solid #1677ff",
          borderRadius: "12px",
          marginTop: "12px",
          padding: "16px",
        },
      },
      React.createElement(
        "div",
        {
          style: {
            background: "#eaf3ff",
            borderRadius: "8px",
            marginBottom: "12px",
            padding: "12px",
          },
        },
        slot,
      ),
    );
  }

  ForwardedLayer.propTypes = {
    id: PropTypes.string,
    setProps: PropTypes.func,
    slot: PropTypes.node,
  };

  function ComponentPropCarrier(props) {
    const forwardedSlot = React.createElement(
      "div",
      {"data-testid": "forwarded-slot-wrapper"},
      props.slot,
    );
    return React.createElement(ForwardedLayer, {
      id: props.id,
      setProps: props.setProps,
      slot: forwardedSlot,
    });
  }

  ComponentPropCarrier.propTypes = {
    children: PropTypes.node,
    id: PropTypes.string,
    setProps: PropTypes.func,
    slot: PropTypes.node,
  };

  global.test_components = Object.assign(global.test_components || {}, {
    ComponentPropCarrier,
  });
})(window);
