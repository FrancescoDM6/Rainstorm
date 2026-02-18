import useThreadStore from './hooks/useThreadStore'
import ThreadView from './components/ThreadView'
import ThreadSidebar from './components/ThreadSidebar'

function App() {
  const {
    threads,
    activeThread,
    activeThreadId,
    activeEntryId,
    setActiveEntryId,
    addThread,
    deleteThread,
    switchThread,
    addEntry,
    updateEntryContent,
    setEntryQuestions,
    setEntryLoading
  } = useThreadStore()

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <ThreadSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        onSwitch={switchThread}
        onNew={addThread}
        onDelete={deleteThread}
      />

      <main className="flex-1 p-8 overflow-y-auto">
        <header className="max-w-2xl mx-auto mb-8 flex items-center justify-between">
          <h1 className="text-xl font-light text-gray-400">Rainstorm</h1>
          <button
            onClick={addThread}
            className="md:hidden w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-lg cursor-pointer"
          >
            +
          </button>
        </header>

        <ThreadView
          thread={activeThread}
          activeEntryId={activeEntryId}
          setActiveEntryId={setActiveEntryId}
          addEntry={addEntry}
          updateEntryContent={updateEntryContent}
          setEntryQuestions={setEntryQuestions}
          setEntryLoading={setEntryLoading}
        />
      </main>
    </div>
  )
}

export default App
