export default function QuestionPanel({ questions, loading, isActive }) {
  if (!questions?.length && !loading) return null

  return (
    <div
      className={`
        mt-2 p-3 rounded-lg
        bg-gray-900/50 border border-gray-700/50
        transition-opacity duration-300
        ${isActive ? 'opacity-100' : 'opacity-30 hover:opacity-70'}
      `}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-xs">
          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
          <span>Thinking laterally...</span>
        </div>
      ) : (
        <ul className="space-y-2">
          {questions.map((question, i) => (
            <li
              key={i}
              className="text-xs text-gray-400 leading-relaxed pl-3 border-l-2 border-gray-700"
            >
              {question}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
