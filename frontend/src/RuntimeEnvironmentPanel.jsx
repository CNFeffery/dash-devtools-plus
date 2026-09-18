import React, {useCallback, useEffect, useState} from "react";
import {Alert, Button, Skeleton, Tooltip} from "antd";
import {
  CheckOutlined,
  CloudServerOutlined,
  CodeOutlined,
  CopyOutlined,
  DesktopOutlined,
  GlobalOutlined,
  ProductOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {endpointUrl} from "./utils";
import {buildEnvironmentReport, collectBrowserEnvironment} from "./runtimeEnvironment";

function SignalCard({icon, label, value, detail, tone}) {
  return (
    <article className={`ddp-environment-signal is-${tone}`}>
      <span className="ddp-environment-signal-icon">{icon}</span>
      <div>
        <small>{label}</small>
        <strong title={value}>{value || "—"}</strong>
        <span title={detail}>{detail}</span>
      </div>
    </article>
  );
}

function SectionHeading({icon, eyebrow, title}) {
  return (
    <div className="ddp-environment-section-heading">
      <span>{icon}</span>
      <div><small>{eyebrow}</small><h3>{title}</h3></div>
    </div>
  );
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export default function RuntimeEnvironmentPanel({endpoint, isActive, t}) {
  const [environment, setEnvironment] = useState(null);
  const [browser, setBrowser] = useState(() => collectBrowserEnvironment());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    setBrowser(collectBrowserEnvironment());
    try {
      const response = await fetch(endpointUrl(endpoint), {cache: "no-store"});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setEnvironment(await response.json());
    } catch (loadError) {
      console.warn("[dash-devtools-plus] Runtime environment request failed", loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (isActive && !environment) load();
  }, [isActive]);

  const handleCopy = async () => {
    if (!environment) return;
    try {
      await copyText(buildEnvironmentReport(environment, browser));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (copyError) {
      console.warn("[dash-devtools-plus] Environment report copy failed", copyError);
    }
  };

  const app = environment?.application || {};
  const python = environment?.python || {};
  const server = environment?.server || {};
  const dependencies = environment?.dependencies?.libraries || [];
  const browserName = [browser.name, browser.version].filter(Boolean).join(" ");
  const operatingSystem = [server.operatingSystem, server.osRelease].filter(Boolean).join(" ");

  return (
    <section className="ddp-panel ddp-environment-panel" aria-label={t("runtimeEnvironmentTitle")}>
      <div className="ddp-workspace-header">
        <div className="ddp-workspace-title">
          <span className="ddp-workspace-icon ddp-environment-workspace-icon" aria-hidden="true"><DesktopOutlined /></span>
          <div>
            <div className="ddp-eyebrow">{t("runtimeEnvironmentEyebrow")}</div>
            <h2>{t("runtimeEnvironmentTitle")}</h2>
          </div>
        </div>
        <div className="ddp-workspace-actions">
          <Button
            className={`ddp-environment-copy ${copied ? "is-copied" : ""}`}
            type="primary"
            icon={copied ? <CheckOutlined /> : <CopyOutlined />}
            disabled={!environment}
            onClick={handleCopy}
          >
            {t(copied ? "environmentCopied" : "copyEnvironmentReport")}
          </Button>
          <Tooltip title={t("refresh")}>
            <Button className="ddp-refresh-button" icon={<ReloadOutlined />} onClick={load} loading={loading} aria-label={t("refresh")} />
          </Tooltip>
        </div>
      </div>

      {error && <Alert className="ddp-inline-alert" type="error" showIcon message={t("runtimeEnvironmentError")} action={<Button size="small" onClick={load}>{t("refresh")}</Button>} />}

      {!environment && loading ? (
        <div className="ddp-environment-loading"><Skeleton active paragraph={{rows: 11}} /></div>
      ) : (
        <div className="ddp-environment-scroll">
          <div className="ddp-environment-intro">
            <div>
              <strong>{t("environmentIntroTitle")}</strong>
              <p>{t("environmentIntroDescription")}</p>
            </div>
          </div>

          <div className="ddp-environment-signal-grid">
            <SignalCard icon={<CodeOutlined />} label={t("pythonRuntime")} value={`Python ${python.version || "—"}`} detail={python.implementation} tone="python" />
            <SignalCard icon={<ProductOutlined />} label={t("dashRuntime")} value={`Dash ${app.dashVersion || "—"}`} detail={`Devtools Plus ${app.devtoolsPlusVersion || "—"}`} tone="dash" />
            <SignalCard icon={<CloudServerOutlined />} label={t("serverEnvironment")} value={operatingSystem} detail={server.architecture} tone="server" />
            <SignalCard
              icon={<GlobalOutlined />}
              label={t("browserEnvironment")}
              value={browserName}
              detail={`${browser.platform} · ${browser.language} · ${browser.viewport}`}
              tone="browser"
            />
          </div>

          <article className="ddp-environment-card ddp-environment-dependencies">
            <div className="ddp-environment-dependency-header">
              <SectionHeading icon={<ProductOutlined />} eyebrow={t("applicationImports")} title={t("environmentDependencies")} />
            </div>
            <p>{t("environmentDependenciesHint")}</p>
            <pre className="ddp-environment-dependency-list">
              {dependencies.length
                ? dependencies.map((library) => `${library.name}==${library.version}`).join("\n")
                : t("environmentNoDependencies")}
            </pre>
          </article>
        </div>
      )}
    </section>
  );
}
