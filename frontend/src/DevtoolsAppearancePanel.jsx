import React from "react";
import {
  BgColorsOutlined,
  CloudOutlined,
  CheckOutlined,
  CodeOutlined,
  DoubleLeftOutlined,
  EyeOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  WarningOutlined,
  ApartmentOutlined,
} from "@ant-design/icons";
import {NATIVE_DEVTOOLS_THEME_IDS} from "./nativeDevtoolsTheme";

const THEMES = [
  {
    id: NATIVE_DEVTOOLS_THEME_IDS.native,
    previewClass: "is-native",
    nameKey: "nativeToolbarThemeName",
    labelKey: "nativeToolbarThemeLabel",
    descriptionKey: "nativeToolbarThemeDescription",
    featureKeys: ["nativeToolbarFeaturePlacement", "nativeToolbarFeatureOriginal"],
  },
  {
    id: NATIVE_DEVTOOLS_THEME_IDS.luminousDock,
    previewClass: "is-luminous",
    nameKey: "luminousToolbarThemeName",
    labelKey: "luminousToolbarThemeLabel",
    descriptionKey: "luminousToolbarThemeDescription",
    featureKeys: ["luminousToolbarFeatureSurface", "luminousToolbarFeatureFocus"],
  },
  {
    id: NATIVE_DEVTOOLS_THEME_IDS.paperAtelier,
    previewClass: "is-paper",
    nameKey: "paperToolbarThemeName",
    labelKey: "paperToolbarThemeLabel",
    descriptionKey: "paperToolbarThemeDescription",
    featureKeys: ["paperToolbarFeatureSurface", "paperToolbarFeatureStructure"],
  },
  {
    id: NATIVE_DEVTOOLS_THEME_IDS.mintCircuit,
    previewClass: "is-mint",
    nameKey: "mintToolbarThemeName",
    labelKey: "mintToolbarThemeLabel",
    descriptionKey: "mintToolbarThemeDescription",
    featureKeys: ["mintToolbarFeatureSurface", "mintToolbarFeatureFocus"],
  },
  {
    id: NATIVE_DEVTOOLS_THEME_IDS.coralStudio,
    previewClass: "is-coral",
    nameKey: "coralToolbarThemeName",
    labelKey: "coralToolbarThemeLabel",
    descriptionKey: "coralToolbarThemeDescription",
    featureKeys: ["coralToolbarFeatureSurface", "coralToolbarFeatureEnergy"],
  },
];

function NativeToolbarIcon({label, selector, fallback: Fallback}) {
  const source = selector
    ? document.querySelector(selector)
    : [...document.querySelectorAll(".dash-debug-menu__content .dash-debug-menu__button")]
      .find((button) => button.textContent?.trim().startsWith(label))?.querySelector("svg");
  const paths = source ? [...source.querySelectorAll("path")] : [];
  if (!source?.getAttribute("viewBox") || !paths.length) return <Fallback />;

  return (
    <svg viewBox={source.getAttribute("viewBox")} fill="currentColor" aria-hidden="true">
      {paths.map((path, index) => (
        <path
          key={index}
          d={path.getAttribute("d") || ""}
          fill={path.getAttribute("fill") || undefined}
          fillOpacity={path.getAttribute("fill-opacity") || undefined}
        />
      ))}
    </svg>
  );
}

function AvailableStatusIconFallback() {
  return (
    <svg viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <path d="M9.854 5.146a.5.5 0 0 1 0 .708l-3.5 3.5a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L6 8.293l3.146-3.147a.5.5 0 0 1 .708 0M13.5 7A6.5 6.5 0 1 1 7 .5 6.507 6.507 0 0 1 13.5 7m-1 0A5.5 5.5 0 1 0 7 12.5 5.507 5.507 0 0 0 12.5 7" />
    </svg>
  );
}

function ToolbarPreview({variant}) {
  const dashVersion = document.querySelector(".dash-debug-menu__version")?.textContent?.trim() || "v4.4";
  return (
    <div className={`ddp-toolbar-theme-preview ${variant}`} aria-hidden="true">
      <div className="ddp-toolbar-preview-canvas">
        <i /><i /><i />
        <div className="ddp-toolbar-preview-dock">
          <span className="ddp-toolbar-preview-button is-plus">
            <SearchOutlined />Devtools Plus
          </span>
          <span className="ddp-toolbar-preview-button is-cloud">
            <NativeToolbarIcon label="Plotly Cloud" fallback={CloudOutlined} />Plotly Cloud
          </span>
          <span className="ddp-toolbar-preview-button">
            <NativeToolbarIcon label="Errors" fallback={WarningOutlined} />Errors
          </span>
          <span className="ddp-toolbar-preview-button">
            <NativeToolbarIcon label="Callbacks" fallback={ApartmentOutlined} />Callbacks
          </span>
          <i className="ddp-toolbar-preview-divider" />
          <span className="ddp-toolbar-preview-version">{dashVersion}</span>
          <i className="ddp-toolbar-preview-divider" />
          <span className="ddp-toolbar-preview-status">
            Server<NativeToolbarIcon
              selector=".dash-debug-menu__status.dash-debug-menu__button--available svg"
              fallback={AvailableStatusIconFallback}
            />
          </span>
          <i className="ddp-toolbar-preview-divider" />
          <span className="ddp-toolbar-preview-toggle">
            <NativeToolbarIcon selector=".dash-debug-menu__toggle--expanded svg" fallback={DoubleLeftOutlined} />
          </span>
        </div>
      </div>
    </div>
  );
}

function ThemeCard({theme, selected, onSelect, t}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`ddp-toolbar-theme-card ${theme.previewClass} ${selected ? "is-selected" : ""}`}
      onClick={() => onSelect(theme.id)}
    >
      <div className="ddp-toolbar-theme-card-heading">
        <span className="ddp-toolbar-theme-card-icon" aria-hidden="true">
          {theme.id === NATIVE_DEVTOOLS_THEME_IDS.native
            ? <SafetyCertificateOutlined />
            : <BgColorsOutlined />}
        </span>
        <div>
          <small>{t(theme.labelKey)}</small>
          <strong>{t(theme.nameKey)}</strong>
        </div>
        <span className="ddp-toolbar-theme-selection" aria-hidden="true">
          {selected ? <CheckOutlined /> : null}
        </span>
      </div>

      <ToolbarPreview variant={theme.previewClass} />

      <p>{t(theme.descriptionKey)}</p>
      <div className="ddp-toolbar-theme-features">
        {theme.featureKeys.map((featureKey) => (
          <span key={featureKey}><CheckOutlined />{t(featureKey)}</span>
        ))}
      </div>
    </button>
  );
}

export default function DevtoolsAppearancePanel({value, onChange, t}) {
  return (
    <section className="ddp-panel ddp-appearance-panel" aria-label={t("devtoolsAppearanceTitle")}>
      <div className="ddp-workspace-header">
        <div className="ddp-workspace-title">
          <span className="ddp-workspace-icon ddp-appearance-workspace-icon" aria-hidden="true">
            <BgColorsOutlined />
          </span>
          <div>
            <div className="ddp-eyebrow">{t("devtoolsAppearanceEyebrow")}</div>
            <h2>{t("devtoolsAppearanceTitle")}</h2>
          </div>
        </div>
      </div>

      <div className="ddp-appearance-intro">
        <span aria-hidden="true"><EyeOutlined /></span>
        <div>
          <strong>{t("devtoolsAppearanceIntroTitle")}</strong>
          <p>{t("devtoolsAppearanceIntroDescription")}</p>
        </div>
      </div>

      <div
        className="ddp-toolbar-theme-list"
        role="radiogroup"
        aria-label={t("devtoolsAppearanceThemeGroup")}
      >
        {THEMES.map((theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            selected={value === theme.id}
            onSelect={onChange}
            t={t}
          />
        ))}
      </div>

      <div className="ddp-appearance-footnote">
        <CodeOutlined aria-hidden="true" />
        <span>{t("devtoolsAppearanceFootnote")}</span>
      </div>
    </section>
  );
}
