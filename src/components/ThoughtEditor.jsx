import { useRef, useEffect } from 'react'

export default function ThoughtEditor({ content, isActive, isFirst, onChange, onFocus }) {
  const textareaRef = useRef(null)

  useEffect(() => {
    if (isActive && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isActive])

  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }, [content])

  return (
    <textarea
      ref={textareaRef}
      value={content}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      placeholder={isFirst ? 'What are you thinking?' : 'Continue your thought...'}
      className={`
        w-full p-4 rounded-lg resize-none
        bg-gray-800/50 text-gray-100
        placeholder-gray-500
        text-sm leading-relaxed
        transition-all duration-200
        focus:outline-none
        ${isActive
          ? 'bg-gray-800 ring-2 ring-blue-500 shadow-lg shadow-blue-500/20'
          : 'hover:bg-gray-800/70'}
      `}
      rows={1}
    />
  )
}
