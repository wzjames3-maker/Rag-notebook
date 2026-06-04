"use client";

import { useEffect, useRef } from "react";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { Editor, rootCtx, defaultValueCtx, editorStateCtx, serializerCtx } from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import { nord } from "@milkdown/theme-nord";

interface MilkdownEditorProps {
  defaultValue: string;
  onChange: (content: string) => void;
}

function EditorInner({ defaultValue, onChange }: MilkdownEditorProps) {
  const onChangeRef = useRef(onChange);
  const lastContentRef = useRef(defaultValue);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const { get } = useEditor((container) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, container);
        ctx.set(defaultValueCtx, defaultValue);
      })
      .use(commonmark)
      .use(gfm)
      .config(nord),
    [defaultValue]
  );

  // Poll for content changes
  useEffect(() => {
    const interval = setInterval(() => {
      const editor = get();
      if (!editor) return;

      try {
        const content = editor.action((ctx) => {
          const state = ctx.get(editorStateCtx);
          const serializer = ctx.get(serializerCtx);
          return serializer(state.doc);
        });

        if (content !== lastContentRef.current) {
          lastContentRef.current = content;
          onChangeRef.current(content);
        }
      } catch {
        // Editor not ready yet
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [get]);

  return <Milkdown />;
}

export function NoteEditor({ defaultValue, onChange }: MilkdownEditorProps) {
  return (
    <MilkdownProvider>
      <EditorInner defaultValue={defaultValue} onChange={onChange} />
    </MilkdownProvider>
  );
}
