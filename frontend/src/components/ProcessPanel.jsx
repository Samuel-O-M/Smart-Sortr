import React from 'react';

export default function ProcessPanel({
  processMessage,
  onCommit,
  onUndo,
  onClear,
  loadingCommit,
  loadingInit,
  loadingPrediction
}) {
  return (
    <div className="h-full w-full bg-[#F0F0F0] flex flex-col items-center justify-around px-8">
      <div
        className={`w-full flex flex-col h-[40%] rounded-xl py-4 ${
          processMessage ? 'bg-blue-500' : 'bg-blue-300'
        } text-white`}
      >
        <div className="w-full h-full overflow-y-auto hide-scrollbar flex flex-col items-center justify-start">
          <pre className="text-center whitespace-pre-wrap m-0">
            {processMessage || "No messages"}
          </pre>
        </div>
      </div>

      <button
        className="w-1/2 text-sm bg-gray-700 text-white rounded-full h-12"
        onClick={onClear}
      >
        Clear Logs
      </button>

      <button
        className="w-3/4 bg-green-500 hover:bg-green-600 text-xl text-white font-semibold rounded-full disabled:opacity-50 h-16"
        onClick={onCommit}
        disabled={loadingCommit || loadingInit || loadingPrediction}
      >
        Commit
      </button>

      <button
        className="w-3/4 bg-red-500 hover:bg-red-600 text-xl text-white font-semibold rounded-full disabled:opacity-50 h-16"
        onClick={onUndo}
        disabled={loadingCommit || loadingInit || loadingPrediction}
      >
        Undo
      </button>

      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
