import React, {useState} from "react";
import {Button, Empty, Segmented} from "antd";
import {ApiOutlined, ExportOutlined} from "@ant-design/icons";

export default function FastApiDocsPanel({docs, t}) {
  const [selected, setSelected] = useState("docs");
  const available = [
    docs?.docsUrl && {value: "docs", label: "Swagger UI", url: docs.docsUrl},
    docs?.redocUrl && {value: "redoc", label: "ReDoc", url: docs.redocUrl},
  ].filter(Boolean);
  const current = available.find((item) => item.value === selected) || available[0];

  return (
    <section className="ddp-panel ddp-fastapi-docs-panel" aria-label={t("fastapiDocsNav")}>
      <div className="ddp-workspace-header">
        <div className="ddp-workspace-title">
          <span className="ddp-workspace-icon" aria-hidden="true"><ApiOutlined /></span>
          <div>
            <div className="ddp-eyebrow">FASTAPI</div>
            <h2>{t("fastapiDocsTitle")}</h2>
          </div>
        </div>
        {current && (
          <Button
            href={current.url}
            target="_blank"
            rel="noopener noreferrer"
            icon={<ExportOutlined />}
          >
            {t("fastapiDocsOpenSeparate")}
          </Button>
        )}
      </div>

      {current ? (
        <div className="ddp-fastapi-docs-workspace">
          <div className="ddp-fastapi-docs-controls">
            <Segmented
              aria-label={t("fastapiDocsSwitcher")}
              value={current.value}
              onChange={setSelected}
              options={available.map(({value, label}) => ({value, label}))}
            />
            <span className="ddp-fastapi-docs-path" title={current.url}>{current.url}</span>
          </div>
          <iframe
            key={current.value}
            className="ddp-fastapi-docs-frame"
            src={current.url}
            title={`${t("fastapiDocsTitle")} · ${current.label}`}
          />
        </div>
      ) : (
        <div className="ddp-fastapi-docs-empty">
          <Empty description={t("fastapiDocsUnavailable")} />
        </div>
      )}
    </section>
  );
}
