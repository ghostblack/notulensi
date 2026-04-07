
import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  Quote, 
  Undo, 
  Redo, 
  Type,
  Code2
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
}

const MenuButton = ({ 
  onClick, 
  isActive = false, 
  children, 
  title 
}: { 
  onClick: () => void; 
  isActive?: boolean; 
  children: React.ReactNode;
  title: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`p-2 rounded-lg transition-all ${
      isActive 
        ? 'bg-[#431317] text-white shadow-sm' 
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
    }`}
  >
    {children}
  </button>
);

const RichTextEditor: React.FC<RichTextEditorProps> = ({ content, onChange, placeholder }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({
        html: false, // Keep it clean markdown
        tightLists: true,
        bulletListMarker: '-',
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      // @ts-ignore - getMarkdown comes from the extension
      const markdown = editor.storage.markdown.getMarkdown();
      onChange(markdown);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[500px] p-6 leading-relaxed text-slate-800',
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="flex flex-col w-full h-full border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm transition-all focus-within:border-[#431317]/30 focus-within:ring-1 focus-within:ring-[#431317]/5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-100 bg-slate-50/50 backdrop-blur-sm sticky top-0 z-20">
        <MenuButton 
          onClick={() => editor.chain().focus().toggleBold().run()} 
          isActive={editor.isActive('bold')}
          title="Tebal (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </MenuButton>
        <MenuButton 
          onClick={() => editor.chain().focus().toggleItalic().run()} 
          isActive={editor.isActive('italic')}
          title="Miring (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </MenuButton>
        <div className="w-px h-6 bg-slate-200 mx-1" />
        
        <MenuButton 
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} 
          isActive={editor.isActive('heading', { level: 1 })}
          title="Judul 1"
        >
          <Heading1 className="w-4 h-4" />
        </MenuButton>
        <MenuButton 
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} 
          isActive={editor.isActive('heading', { level: 2 })}
          title="Judul 2"
        >
          <Heading2 className="w-4 h-4" />
        </MenuButton>
        <MenuButton 
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} 
          isActive={editor.isActive('heading', { level: 3 })}
          title="Judul 3"
        >
          <Heading3 className="w-4 h-4" />
        </MenuButton>
        
        <div className="w-px h-6 bg-slate-200 mx-1" />
        
        <MenuButton 
          onClick={() => editor.chain().focus().toggleBulletList().run()} 
          isActive={editor.isActive('bulletList')}
          title="Daftar Simbol"
        >
          <List className="w-4 h-4" />
        </MenuButton>
        <MenuButton 
          onClick={() => editor.chain().focus().toggleOrderedList().run()} 
          isActive={editor.isActive('orderedList')}
          title="Daftar Angka"
        >
          <ListOrdered className="w-4 h-4" />
        </MenuButton>
        
        <div className="w-px h-6 bg-slate-200 mx-1" />
        
        <MenuButton 
          onClick={() => editor.chain().focus().toggleBlockquote().run()} 
          isActive={editor.isActive('blockquote')}
          title="Kutipan"
        >
          <Quote className="w-4 h-4" />
        </MenuButton>

        <div className="flex-1" />
        
        <MenuButton 
          onClick={() => editor.chain().focus().undo().run()} 
          title="Urungkan (Ctrl+Z)"
        >
          <Undo className="w-4 h-4" />
        </MenuButton>
        <MenuButton 
          onClick={() => editor.chain().focus().redo().run()} 
          title="Ulangi (Ctrl+Y)"
        >
          <Redo className="w-4 h-4" />
        </MenuButton>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
        <style dangerouslySetInnerHTML={{ __html: `
          .ProseMirror p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left;
            color: #adb5bd;
            pointer-events: none;
            height: 0;
          }
          .ProseMirror {
            outline: none !important;
          }
          .ProseMirror h1 { font-size: 1.5rem; font-weight: 800; margin-bottom: 1rem; text-align: center; text-transform: uppercase; }
          .ProseMirror h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.75rem; text-align: center; text-transform: uppercase; }
          .ProseMirror h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; text-align: center; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; }
        `}} />
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default RichTextEditor;
