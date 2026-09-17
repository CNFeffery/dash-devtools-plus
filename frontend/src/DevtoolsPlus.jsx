import React, {useCallback, useEffect, useMemo, useState} from "react";
import {Button, ConfigProvider, Drawer, Segmented, Tabs, Tooltip} from "antd";
import {
  ApartmentOutlined,
  BgColorsOutlined,
  CameraOutlined,
  CloseOutlined,
  DashboardOutlined,
  GlobalOutlined,
  ProductOutlined,
  ScanOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import CallbackPanel from "./CallbackPanel";
import ComponentInspectorPanel from "./ComponentInspectorPanel";
import ComponentProbeOverlay from "./ComponentProbeOverlay";
import DependenciesPanel from "./DependenciesPanel";
import DevtoolsAppearancePanel from "./DevtoolsAppearancePanel";
import {createNestedInspection} from "./componentInspector";
import ServerMetricsPanel, {useServerMetrics} from "./ServerMetricsPanel";
import StateSnapshotsPanel from "./StateSnapshotsPanel";
import {createTranslator, normalizeLocale} from "./i18n";
import {getAntdLocale} from "./i18n/antd";
import {createDevtoolsTheme} from "./theme";
import {usesInternalTabScroll} from "./utils";
import {syncNativeErrorFrameTheme} from "./nativeErrorFrameTheme";
import {
  NATIVE_DEVTOOLS_THEME_IDS,
  applyNativeDevtoolsTheme,
  readNativeDevtoolsTheme,
  writeNativeDevtoolsTheme,
} from "./nativeDevtoolsTheme";
import brandLogoUrl from "../../imgs/devtools-plus-logo.svg";

const POPUP_ID = "dash-devtools-plus";
const {useDevtool, useDevtoolMenuButtonClassName} = window.dash_component_api.devtool;

function initialLocale(defaultLocale) {
  try {
    return normalizeLocale(
      localStorage.getItem("dash_devtools_plus_locale") ||
        defaultLocale ||
        navigator.language,
    );
  } catch {
    return normalizeLocale(defaultLocale || navigator.language);
  }
}

function initialNativeDevtoolsTheme() {
  try {
    return readNativeDevtoolsTheme(window.localStorage);
  } catch {
    return NATIVE_DEVTOOLS_THEME_IDS.native;
  }
}

function BrandMark() {
  return (
    <span className="ddp-brand-mark" aria-hidden="true">
      <img className="ddp-brand-logo" src={brandLogoUrl} alt="" />
    </span>
  );
}

function EnabledDevtoolsPlus({
  defaultLocale = "en",
  accentColor = "#119DFF",
  callbacksEndpoint = "_dash-devtools-plus/callbacks",
  dependenciesEndpoint = "_dash-devtools-plus/dependencies",
  serverMetricsEndpoint = "_dash-devtools-plus/server-metrics",
}) {
  const {popup, setPopup} = useDevtool();
  const isOpen = popup === POPUP_ID;
  const buttonClassName = useDevtoolMenuButtonClassName(POPUP_ID);
  const [locale, setLocale] = useState(() => initialLocale(defaultLocale));
  const [nativeDevtoolsTheme, setNativeDevtoolsTheme] = useState(initialNativeDevtoolsTheme);
  const [activeTab, setActiveTab] = useState("callbacks");
  const [inspectionTrail, setInspectionTrail] = useState([]);
  const inspection = inspectionTrail[inspectionTrail.length - 1] || null;
  const [isInspecting, setIsInspecting] = useState(false);
  const t = useMemo(() => createTranslator(locale), [locale]);
  const antdLocale = useMemo(() => getAntdLocale(locale), [locale]);
  const antdTheme = useMemo(() => createDevtoolsTheme(accentColor), [accentColor]);
  const serverMetrics = useServerMetrics(serverMetricsEndpoint);

  useEffect(() => {
    try {
      localStorage.setItem("dash_devtools_plus_locale", locale);
    } catch {
      // Local storage is optional; switching still works for this session.
    }
  }, [locale]);

  useEffect(() => {
    const root = document.documentElement;
    applyNativeDevtoolsTheme(root, nativeDevtoolsTheme, accentColor);
    syncNativeErrorFrameTheme(document);
    try {
      writeNativeDevtoolsTheme(window.localStorage, nativeDevtoolsTheme);
    } catch {
      // Browser storage is optional; the selected style still applies live.
    }
    // Dash unmounts toolbar content while collapsed. Keep the root marker so
    // the chosen skin still styles the collapsed toggle; a page reload starts
    // from persisted storage, and selecting native removes the marker.
  }, [nativeDevtoolsTheme, accentColor]);

  const close = () => setPopup("");
  const startInspection = useCallback(() => {
    setActiveTab("inspector");
    setIsInspecting(true);
    setPopup("");
  }, [setPopup]);
  const cancelInspection = useCallback(() => {
    setIsInspecting(false);
    setActiveTab("inspector");
    setPopup(POPUP_ID);
  }, [setPopup]);
  const completeInspection = useCallback((result) => {
    setInspectionTrail([result]);
    setIsInspecting(false);
    setActiveTab("inspector");
    setPopup(POPUP_ID);
  }, [setPopup]);
  const inspectNestedComponent = useCallback((component, propName, valuePath) => {
    setInspectionTrail((current) => {
      const parent = current[current.length - 1];
      const nested = createNestedInspection(parent, component, propName, valuePath);
      return nested ? [...current, nested] : current;
    });
  }, []);
  const navigateInspectionTrail = useCallback((index) => {
    setInspectionTrail((current) => current.slice(0, index + 1));
  }, []);

  return (
    <ConfigProvider locale={antdLocale} theme={antdTheme}>
      <button
        id="dash-devtools-plus-button"
        type="button"
        className={buttonClassName}
        onClick={() => {
          if (isInspecting) cancelInspection();
          else setPopup(isOpen ? "" : POPUP_ID);
        }}
        aria-label="Devtools Plus"
        aria-expanded={isOpen}
      >
        <SearchOutlined className="dash-debug-menu__icon" />
        Devtools Plus
      </button>

      <Drawer
        open={isOpen}
        onClose={close}
        placement="left"
        closable={false}
        width="min(1180px, calc(100vw - 24px))"
        destroyOnHidden={false}
        maskClosable
        keyboard
        zIndex={100001}
        rootClassName="ddp-ant-root"
        className="ddp-drawer"
        style={{"--ddp-primary": accentColor}}
        title={
          <div className="ddp-drawer-header">
            <div className="ddp-brand">
              <BrandMark />
              <div>
                <div className="ddp-brand-title">
                  <strong>{t("title")}</strong>
                </div>
                <span>{t("subtitle")}</span>
              </div>
            </div>
            <div className="ddp-header-actions">
              <div className="ddp-language-control" title={t("language")}>
                <GlobalOutlined className="ddp-language-icon" aria-hidden="true" />
                <Segmented
                  className="ddp-language-segmented"
                  size="small"
                  aria-label={t("language")}
                  value={locale}
                  onChange={setLocale}
                  options={[
                    {value: "en", label: "English"},
                    {value: "zh-CN", label: "简体中文"},
                  ]}
                />
              </div>
              <Tooltip title={t("close")}>
                <Button
                  type="text"
                  icon={<CloseOutlined />}
                  onClick={close}
                  aria-label={t("close")}
                />
              </Tooltip>
            </div>
          </div>
        }
      >
        <div className="ddp-content">
          <Tabs
            className={`ddp-main-tabs ${usesInternalTabScroll(activeTab) ? "has-pane-scroll" : ""}`}
            activeKey={activeTab}
            onChange={setActiveTab}
            animated={false}
            destroyOnHidden={false}
            items={[
              {
                key: "callbacks",
                label: <span className="ddp-tab-label"><ApartmentOutlined />{t("callbacksNav")}</span>,
                children: (
                  <CallbackPanel
                    endpoint={callbacksEndpoint}
                    isActive={isOpen && activeTab === "callbacks"}
                    accentColor={accentColor}
                    t={t}
                  />
                ),
              },
              {
                key: "server",
                label: <span className="ddp-tab-label"><DashboardOutlined />{t("serverMetricsNav")}</span>,
                children: (
                  <ServerMetricsPanel
                    monitor={serverMetrics}
                    t={t}
                  />
                ),
              },
              {
                key: "inspector",
                label: <span className="ddp-tab-label"><ScanOutlined />{t("componentInspectorNav")}</span>,
                children: (
                  <ComponentInspectorPanel
                    inspection={inspection}
                    inspectionTrail={inspectionTrail}
                    onInspectComponent={inspectNestedComponent}
                    onNavigate={navigateInspectionTrail}
                    onStart={startInspection}
                    t={t}
                  />
                ),
              },
              {
                key: "snapshots",
                label: <span className="ddp-tab-label"><CameraOutlined />{t("stateSnapshotsNav")}</span>,
                children: <StateSnapshotsPanel locale={locale} t={t} />,
              },
              {
                key: "dependencies",
                label: <span className="ddp-tab-label"><ProductOutlined />{t("dependenciesNav")}</span>,
                children: (
                  <DependenciesPanel
                    endpoint={dependenciesEndpoint}
                    isActive={isOpen && activeTab === "dependencies"}
                    accentColor={accentColor}
                    t={t}
                  />
                ),
              },
              {
                key: "appearance",
                label: <span className="ddp-tab-label"><BgColorsOutlined />{t("devtoolsAppearanceNav")}</span>,
                children: (
                  <DevtoolsAppearancePanel
                    value={nativeDevtoolsTheme}
                    onChange={setNativeDevtoolsTheme}
                    t={t}
                  />
                ),
              },
            ]}
          />
        </div>
      </Drawer>
      <ComponentProbeOverlay
        active={isInspecting}
        accentColor={accentColor}
        onCancel={cancelInspection}
        onSelect={completeInspection}
        t={t}
      />
    </ConfigProvider>
  );
}

export default function DevtoolsPlus({enabled = false, ...props}) {
  // The server derives this flag from Dash's resolved debug state. Keeping the
  // guard outside the hook-using component also prevents telemetry preloading
  // and every other side effect when only dev_tools_ui was enabled.
  if (!enabled) {
    return null;
  }
  return <EnabledDevtoolsPlus {...props} />;
}
