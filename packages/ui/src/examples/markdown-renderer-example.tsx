import type React from "react";
import { MarkdownRenderer } from "../markdown-renderer";

const sampleMarkdown = `# Markdown Renderer Example

This is a **bold text** and this is *italic text*.

## Code Examples

Here's some inline \`code\` and a code block:

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

const user = {
  name: "John",
  age: 30,
  isActive: true
};
\`\`\`

## Links and Lists

Here's a [link to React](https://reactjs.org) and a list:

- First item
- Second item with **bold text**
- Third item with *italic text*
- Fourth item with \`inline code\`

### Numbered Lists

1. First numbered item
2. Second numbered item
3. Third numbered item

## Tables

| Feature | Support | Notes |
|---------|---------|-------|
| Headers | ✅ | H1-H6 supported |
| Bold/Italic | ✅ | **bold** and *italic* |
| Code | ✅ | Inline and blocks |
| Links | ✅ | External links open in new tab |
| Lists | ✅ | Both ordered and unordered |
| Tables | ✅ | GitHub Flavored Markdown |

## Blockquotes

> This is a blockquote with some important information.
> 
> It can span multiple lines and contain **formatted text**.

## Task Lists

- [x] Install react-markdown
- [x] Create markdown renderer component
- [ ] Add syntax highlighting
- [ ] Add custom styling
- [ ] Test with various markdown features

## Mixed Content

You can combine **bold**, *italic*, and \`code\` in the same line. You can also have [links](https://example.com) with different formatting.

### Horizontal Rule

---

This content comes after a horizontal rule.

## Strikethrough and More

~~This text is strikethrough~~ and this is normal text.

### Nested Content

This is a level 3 heading with some content below it.

#### Even More Nested

This is a level 4 heading.`;

export const MarkdownRendererExample: React.FC = () => {
  return (
    <div className="w-full">
      <MarkdownRenderer content={sampleMarkdown} />
    </div>
  );
};
