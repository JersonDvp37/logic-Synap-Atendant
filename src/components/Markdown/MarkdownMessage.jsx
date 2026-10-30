import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import styles from "./MarkdownMessage.module.css";

export default function MarkdownMessage({ content, whatsapp = false }) {
  const normalizedContent = normalizeListSpacing(content);
  const source = whatsapp ? normalizeWhatsAppMarkdown(normalizedContent) : normalizedContent;

  return (
    <div className={styles.root} data-markdown>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        skipHtml
        components={{
          a: ({ children, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
        }}
      >
        {source || ""}
      </ReactMarkdown>
    </div>
  );
}

function normalizeListSpacing(value = "") {
  return value
    .split("```")
    .map((segment, index) => index % 2 === 0
      ? segment.replace(/([^\n])\n(?=\s*(?:[-+*]|\d+\.)\s+)/g, "$1\n\n")
      : segment)
    .join("```");
}

function normalizeWhatsAppMarkdown(value = "") {
  return value
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,!?:;])/g, "$1**$2**")
    .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,!?:;])/g, "$1*$2*")
    .replace(/(^|[\s(])~([^~\n]+)~(?=$|[\s).,!?:;])/g, "$1~~$2~~");
}
