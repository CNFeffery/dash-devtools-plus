import React, {useRef, useState} from "react";
import {Alert, Button, Empty, Modal, Radio} from "antd";
import {AlignLeftOutlined, CheckOutlined, CodeOutlined} from "@ant-design/icons";
import PropCodeEditor from "./PropCodeEditor";
import {
  updateComponentProp,
} from "./componentPropEditor";

export default function PropEditorModal({edit, onCancel, onUpdated, t}) {
  const [mode, setMode] = useState(edit.mode);
  const [drafts, setDrafts] = useState({
    string: "", number: "", boolean: "false", json: "",
    ...(edit.mode ? {[edit.mode]: edit.text} : {}),
  });
  const [submitError, setSubmitError] = useState(null);
  const [editorError, setEditorError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formatStatus, setFormatStatus] = useState(null);
  const codeEditor = useRef(null);
  const text = drafts[mode] ?? "";
  const chooseMode = next => {
    setMode(next);
    setSubmitError(null);
    setEditorError(false);
    setFormatStatus(null);
  };
  const submit = () => {
    if (!mode || saving || editorError) return;
    setSaving(true);
    try {
      const inspection = updateComponentProp(edit.reference, edit.name, mode, text);
      onUpdated(inspection);
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      centered
      width={760}
      zIndex={100040}
      rootClassName="ddp-ant-root ddp-prop-editor-root"
      className="ddp-prop-editor-modal"
      title={<span className="ddp-prop-editor-title"><CodeOutlined />{t("editPropValue")}</span>}
      onCancel={onCancel}
      maskClosable={false}
      footer={[
        <Button key="cancel" onClick={onCancel}>{t("cancel")}</Button>,
        <Button key="apply" type="primary" icon={<CheckOutlined />} loading={saving}
          disabled={!mode || editorError} onClick={submit}>
          {t("propEditorApply")}
        </Button>,
      ]}
    >
      <div className="ddp-prop-editor-target">
        <span>{edit.reference.namespace}.{edit.reference.type}</span>
        <code>{edit.name}</code>
      </div>
      <div className="ddp-prop-editor-toolbar">
        <div>
          <span className="ddp-prop-editor-label">{t("propEditorType")}</span>
          <Radio.Group value={mode} onChange={event => chooseMode(event.target.value)}
            optionType="button" buttonStyle="solid" aria-label={t("propEditorType")}
            options={["string", "number", "boolean", "json"].map(value => ({
              value, label: t(`propEditorMode_${value}`),
            }))} />
        </div>
        {(mode === "string" || mode === "json") && <Button
          icon={<AlignLeftOutlined />} disabled={editorError}
          onClick={() => setFormatStatus(codeEditor.current?.format() ? "propEditorFormatted" : "propEditorFormatFailed")}
        >{t("propEditorFormat")}</Button>}
      </div>
      <div className="ddp-prop-editor-surface">
        {!mode ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("propEditorChooseType")} />
        ) : mode === "boolean" ? (
          <div className="ddp-prop-editor-boolean">
            <span>{t("propEditorBooleanHint")}</span>
            <Radio.Group value={text} onChange={event => {
              setDrafts(current => ({...current, boolean: event.target.value}));
              setSubmitError(null);
            }} options={[{value: "true", label: "True"}, {value: "false", label: "False"}]} />
          </div>
        ) : (
          <PropCodeEditor key={mode} ref={codeEditor} value={text} mode={mode} t={t}
            label={`${t("propValue")} · ${edit.name}`}
            onError={() => setEditorError(true)}
            onChange={value => {
              setDrafts(current => ({...current, [mode]: value}));
              setSubmitError(null);
              setFormatStatus(null);
            }} />
        )}
      </div>
      <div className="ddp-prop-editor-help">
        {mode && <span>{t(`propEditorHint_${mode}`)}</span>}
        <small>{t("propEditorRuntimeHint")}</small>
        {formatStatus && <small role="status">{t(formatStatus)}</small>}
      </div>
      {(submitError || editorError) && (
        <Alert showIcon type="error" title={t(editorError ? "propEditorLoadFailed" : submitError)} />
      )}
    </Modal>
  );
}
