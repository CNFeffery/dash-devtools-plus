import React, {useEffect, useState} from "react";
import {createPortal} from "react-dom";
import {AimOutlined} from "@ant-design/icons";
import {findClosestDashComponent} from "./componentInspector";
import {blockProbedInteraction, selectProbedComponent} from "./componentProbeEvents";

const BLOCKED_POINTER_EVENTS = [
  "pointerup",
  "pointercancel",
  "mousedown",
  "mouseup",
  "click",
  "dblclick",
  "contextmenu",
  "touchstart",
  "touchmove",
  "touchend",
  "touchcancel",
  "dragstart",
  "drop",
];

const BLOCKED_KEYBOARD_EVENTS = ["keydown", "keyup", "keypress"];

export default function ComponentProbeOverlay({active, accentColor, onCancel, onSelect, t}) {
  const [candidate, setCandidate] = useState(null);

  useEffect(() => {
    if (!active) {
      setCandidate(null);
      return undefined;
    }

    let frame = 0;
    let lastTarget = null;
    const inspectTarget = (target) => {
      if (!(target instanceof Element) || target === lastTarget) return;
      lastTarget = target;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setCandidate(findClosestDashComponent(target)));
    };
    const onPointerMove = (event) => {
      inspectTarget(event.target);
      blockProbedInteraction(event);
    };
    const onPointerDown = (event) => {
      selectProbedComponent(event, findClosestDashComponent, onSelect);
    };
    const onPointerInteraction = (event) => blockProbedInteraction(event);
    const onKeyDown = (event) => {
      blockProbedInteraction(event);
      if (event.key === "Escape") onCancel();
    };
    const onKeyboardInteraction = (event) => blockProbedInteraction(event);
    const onViewportChange = () => {
      if (lastTarget?.isConnected) setCandidate(findClosestDashComponent(lastTarget));
    };

    document.documentElement.classList.add("ddp-component-probing");
    const timer = window.setTimeout(() => {
      window.addEventListener("pointermove", onPointerMove, true);
      window.addEventListener("pointerdown", onPointerDown, true);
      BLOCKED_POINTER_EVENTS.forEach((eventName) => {
        window.addEventListener(eventName, onPointerInteraction, true);
      });
      window.addEventListener("keydown", onKeyDown, true);
      BLOCKED_KEYBOARD_EVENTS.filter((eventName) => eventName !== "keydown").forEach((eventName) => {
        window.addEventListener(eventName, onKeyboardInteraction, true);
      });
      window.addEventListener("scroll", onViewportChange, true);
      window.addEventListener("resize", onViewportChange, true);
    }, 260);

    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
      document.documentElement.classList.remove("ddp-component-probing");
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      BLOCKED_POINTER_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, onPointerInteraction, true);
      });
      window.removeEventListener("keydown", onKeyDown, true);
      BLOCKED_KEYBOARD_EVENTS.filter((eventName) => eventName !== "keydown").forEach((eventName) => {
        window.removeEventListener(eventName, onKeyboardInteraction, true);
      });
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange, true);
    };
  }, [active, onCancel, onSelect]);

  if (!active) return null;
  const bounds = candidate?.bounds;
  return createPortal(
    <div className="ddp-probe-layer" style={{"--ddp-primary": accentColor}}>
      {bounds && (
        <div
          className="ddp-probe-highlight"
          style={{left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height}}
        >
          <span>{candidate.namespace}.{candidate.type}</span>
        </div>
      )}
      <div className="ddp-probe-hud">
        <span><AimOutlined /></span>
        <div><strong>{t("inspecting")}</strong><small>{t("inspectionTarget")}</small></div>
        <kbd>ESC</kbd>
        <em>{t("inspectionEscape")}</em>
      </div>
    </div>,
    document.body,
  );
}
