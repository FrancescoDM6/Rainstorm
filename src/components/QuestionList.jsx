export default function QuestionList({ questions, loading, queuePosition, onQuestionClick }) {
  if (!questions?.length && !loading && !queuePosition) return null

  return (
    <div className="mt-2 ml-4 pl-4 border-l-2 border-gray-700/50">
      {queuePosition > 0 ? (
        <div className="flex items-center gap-2 text-gray-500 text-xs py-1">
          <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
          <span>Queued (#{queuePosition})...</span>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-xs py-1">
          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
          <span>Thinking laterally...</span>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {questions.map((question, i) => (
            <li key={i}>
              <button
                onClick={() => onQuestionClick(question)}
                className="
                  text-left text-xs text-gray-400 leading-relaxed
                  py-1 px-2 -ml-2 rounded
                  hover:text-blue-300 hover:bg-blue-500/10
                  transition-colors duration-150
                  cursor-pointer w-full
                "
              >
                {question}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
