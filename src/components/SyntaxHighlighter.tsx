import { Prism as Highlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface Props {
  language: string
  children: string
}

export function SyntaxHighlighter({ language, children }: Props) {
  return (
    <Highlighter
      style={oneDark}
      language={language}
      PreTag="div"
      customStyle={{ borderRadius: 8, fontSize: 13, margin: '16px 0' }}
    >
      {children}
    </Highlighter>
  )
}
