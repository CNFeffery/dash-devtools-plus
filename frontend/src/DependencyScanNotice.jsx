import React from "react";
import {Alert} from "antd";

export default function DependencyScanNotice({scan, t}) {
  if (scan?.status !== "partial") return null;
  return (
    <Alert
      className="ddp-inline-alert"
      type="warning"
      showIcon
      message={t("dependencyScanPartial")}
      description={
        <ul>
          {(scan.issues || []).map((issue) => (
            <li key={`${issue.module}:${issue.reason}`}>
              <code>{issue.module}</code>: {t(`dependencyScan_${issue.reason}`)}
            </li>
          ))}
        </ul>
      }
    />
  );
}
