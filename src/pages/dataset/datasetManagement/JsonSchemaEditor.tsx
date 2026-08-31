import { useRef } from 'react';
import { Button } from 'antd';
import { Editor, type OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';

export interface JsonSchemaEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  height?: number;
}

const EDITOR_OPTIONS: MonacoEditor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  lineNumbers: 'on',
  wordWrap: 'on',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  fontSize: 13,
  tabSize: 2,
  folding: true,
  renderLineHighlight: 'line',
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  scrollbar: {
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
  },
  padding: { top: 8, bottom: 8 },
};

export default function JsonSchemaEditor({
  value = '',
  onChange,
  onBlur,
  height = 168,
}: JsonSchemaEditorProps) {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.onDidBlurEditorWidget(() => {
      onBlurRef.current?.();
    });
  };

  const handlePrettify = () => {
    const raw = editorRef.current?.getValue() ?? value;
    if (!raw.trim()) return;
    try {
      const pretty = JSON.stringify(JSON.parse(raw), null, 2);
      editorRef.current?.setValue(pretty);
      onChange?.(pretty);
      onBlurRef.current?.();
    } catch {
      onBlurRef.current?.();
    }
  };

  return (
    <div>
      <div
        className="dataset-json-schema-editor"
        style={{
          position: 'relative',
          border: '1px solid #d9d9d9',
          borderRadius: 8,
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        <Button
          type="link"
          size="small"
          htmlType="button"
          onClick={handlePrettify}
          style={{
            position: 'absolute',
            top: 6,
            right: 10,
            zIndex: 2,
            padding: 0,
            height: 'auto',
            fontSize: 12,
            lineHeight: 1.2,
          }}
        >
          {"Prettify"}
        </Button>
        <Editor
          height={height}
          language="json"
          theme="vs"
          value={value}
          onMount={handleMount}
          onChange={(next) => onChange?.(next ?? '')}
          options={EDITOR_OPTIONS}
          loading={
            <div
              style={{
                height,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(9,25,64,0.35)',
                fontSize: 13,
              }}
            >
              Loading…
            </div>
          }
        />
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(9,25,64,0.45)' }}>
        {"必须是合法的 JSON Schema 对象"}
      </div>
    </div>
  );
}
