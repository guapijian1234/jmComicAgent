import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

/**
 * Renders assistant output as GitHub-flavoured markdown.
 *
 * - remark-gfm: tables, strikethrough, task lists, autolinks.
 * - remark-breaks: a single newline becomes a <br>, matching the soft-wrap
 *   behaviour the chat used to get from `whitespace-pre-wrap`.
 *
 * Styling lives under the `.md` scope in globals.css so this stays declarative.
 * Links are forced to open externally — the renderer must not navigate away
 * from the app, and Electron's setWindowOpenHandler routes target=_blank to
 * the system browser.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          )
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
