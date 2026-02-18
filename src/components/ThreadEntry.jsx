import ThoughtEditor from './ThoughtEditor'
import QuestionList from './QuestionList'

export default function ThreadEntry({ entry, isActive, isFirst, queuePosition, onContentChange, onFocus, onQuestionClick }) {
  return (
    <div className="relative">
      {entry.inspiredBy && (
        <div className="mb-2 ml-4 text-xs text-blue-400/70 italic">
          <span className="text-gray-600 mr-1">&larr;</span>
          {entry.inspiredBy}
        </div>
      )}

      <ThoughtEditor
        content={entry.content}
        isActive={isActive}
        isFirst={isFirst}
        onChange={(content) => onContentChange(entry.id, content)}
        onFocus={() => onFocus(entry.id)}
      />

      <QuestionList
        questions={entry.questions}
        loading={entry.questionsLoading}
        queuePosition={queuePosition}
        onQuestionClick={onQuestionClick}
      />
    </div>
  )
}
