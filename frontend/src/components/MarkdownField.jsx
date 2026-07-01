import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import Placeholder from '@tiptap/extension-placeholder';
import { TableKit } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';

const GRID_SIZE = 6;

const TABLE_PRESETS = [
  { rows: 2, cols: 2, label: '2 × 2' },
  { rows: 2, cols: 3, label: '2 × 3' },
  { rows: 3, cols: 2, label: '3 × 2' },
  { rows: 3, cols: 3, label: '3 × 3' },
  { rows: 4, cols: 3, label: '4 × 3' },
  { rows: 4, cols: 4, label: '4 × 4' },
];

function TableInsertMenu({ editor }) {
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [hoverRows, setHoverRows] = useState(0);
  const [hoverCols, setHoverCols] = useState(0);
  const [customRows, setCustomRows] = useState('3');
  const [customCols, setCustomCols] = useState('3');

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  function insertTable(rows, cols) {
    if (!editor || rows < 1 || cols < 1) return;

    editor
      .chain()
      .focus()
      .insertTable({ rows, cols, withHeaderRow: true })
      .run();

    setOpen(false);
    setHoverRows(0);
    setHoverCols(0);
  }

  function handleCustomInsert(event) {
    event.preventDefault();
    const rows = Number.parseInt(customRows, 10);
    const cols = Number.parseInt(customCols, 10);
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) {
      return;
    }
    insertTable(rows, cols);
  }

  const previewLabel =
    hoverRows > 0 && hoverCols > 0 ? `${hoverRows} × ${hoverCols}` : 'Select size';

  return (
    <div className="table-insert" ref={menuRef}>
      <button
        type="button"
        className="markdown-field__toolbar-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        Insert table
      </button>

      {open && (
        <div className="table-insert__panel" role="dialog" aria-label="Choose table size">
          <p className="table-insert__preview">{previewLabel}</p>

          <div
            className="table-insert__grid"
            onMouseLeave={() => {
              setHoverRows(0);
              setHoverCols(0);
            }}
          >
            {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
              const rowIndex = Math.floor(index / GRID_SIZE);
              const colIndex = index % GRID_SIZE;
              const rows = rowIndex + 1;
              const cols = colIndex + 1;
              const isActive =
                hoverRows > 0 && hoverCols > 0 && rows <= hoverRows && cols <= hoverCols;

              return (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  type="button"
                  className={`table-insert__cell${isActive ? ' table-insert__cell--active' : ''}`}
                  aria-label={`${rows} rows by ${cols} columns`}
                  onMouseEnter={() => {
                    setHoverRows(rows);
                    setHoverCols(cols);
                  }}
                  onClick={() => insertTable(rows, cols)}
                />
              );
            })}
          </div>

          <div className="table-insert__presets">
            {TABLE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="table-insert__preset"
                onClick={() => insertTable(preset.rows, preset.cols)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <form className="table-insert__custom" onSubmit={handleCustomInsert}>
            <label className="table-insert__custom-field">
              Rows
              <input
                type="number"
                className="form__input table-insert__custom-input"
                min="1"
                max="20"
                value={customRows}
                onChange={(event) => setCustomRows(event.target.value)}
              />
            </label>
            <label className="table-insert__custom-field">
              Columns
              <input
                type="number"
                className="form__input table-insert__custom-input"
                min="1"
                max="10"
                value={customCols}
                onChange={(event) => setCustomCols(event.target.value)}
              />
            </label>
            <button type="submit" className="table-insert__custom-submit">
              Insert
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function TaskListButton({ editor }) {
  return (
    <button
      type="button"
      className="markdown-field__toolbar-btn"
      aria-pressed={editor.isActive('taskList')}
      onClick={() => editor.chain().focus().toggleTaskList().run()}
    >
      Checkbox list
    </button>
  );
}

export default function MarkdownField({
  label,
  initialMarkdown,
  onChange,
  placeholder,
  className = '',
  editorClassName = '',
  enableTables = false,
}) {
  const extensions = useMemo(() => {
    const items = [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ];

    if (enableTables) {
      items.push(
        TableKit.configure({
          table: { resizable: false },
        }),
      );
    }

    items.push(
      Markdown.configure({
        markedOptions: { gfm: true },
      }),
      Placeholder.configure({
        placeholder: placeholder || '',
        emptyEditorClass: 'markdown-field__editor--empty',
      }),
    );

    return items;
  }, [enableTables, placeholder]);

  const editor = useEditor({
    extensions,
    content: initialMarkdown || '',
    contentType: 'markdown',
    editorProps: {
      attributes: {
        class: `markdown-field__editor markdown-content ${editorClassName}`.trim(),
        'aria-label': label,
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getMarkdown());
    },
  });

  return (
    <div className={`markdown-field ${className}`.trim()}>
      <div className="markdown-field__header">
        <span className="form__label markdown-field__label">{label}</span>
        {editor && (
          <div className="markdown-field__toolbar">
            <TaskListButton editor={editor} />
            {enableTables && <TableInsertMenu editor={editor} />}
          </div>
        )}
      </div>
      <div className="markdown-field__surface">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
