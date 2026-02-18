import { useRef, useEffect } from 'react'

export default function NoteCard({ id, content, isActive, onContentChange, onFocus }) {
  const textareaRef = useRef(null)

  useEffect(() => {
    if (isActive && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isActive])

  return (
    <div
      className={`
        relative rounded-lg transition-all duration-200
        ${isActive
          ? 'bg-gray-800 ring-2 ring-blue-500 shadow-lg shadow-blue-500/20'
          : 'bg-gray-800/50 hover:bg-gray-800/70'}
      `}
    >
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => onContentChange(id, e.target.value)}
        onFocus={() => onFocus(id)}
        placeholder="Drop a thought here..."
        className="
          w-full h-full min-h-[120px] p-4
          bg-transparent text-gray-100
          placeholder-gray-500 resize-none
          focus:outline-none
          text-sm leading-relaxed
        "
      />
    </div>
  )
}
