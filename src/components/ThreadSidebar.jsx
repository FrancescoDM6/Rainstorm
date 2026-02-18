export default function ThreadSidebar({ threads, activeThreadId, onSwitch, onNew, onDelete }) {
  return (
    <aside className="w-60 shrink-0 bg-gray-900 border-r border-gray-800 p-4 hidden md:block overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-gray-400">Threads</h2>
        <button
          onClick={onNew}
          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-lg cursor-pointer"
        >
          +
        </button>
      </div>

      <ul className="space-y-1">
        {threads.map(thread => {
          const isActive = thread.id === activeThreadId
          const title = thread.title || thread.entries[0]?.content?.slice(0, 40) || 'New thread'
          const truncated = title.length >= 40 ? title + '...' : title

          return (
            <li key={thread.id}>
              <button
                onClick={() => onSwitch(thread.id)}
                className={`
                  w-full text-left text-xs px-3 py-2 rounded
                  transition-colors duration-150 cursor-pointer
                  group flex items-center justify-between
                  ${isActive
                    ? 'bg-gray-800 text-gray-200'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}
                `}
              >
                <span className="truncate">{truncated}</span>
                {threads.length > 1 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation()
                      if (window.confirm('Delete this thread?')) {
                        onDelete(thread.id)
                      }
                    }}
                    className="ml-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    x
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
