import React from 'react';

export default function ProcessPanel({
  processMessage,
  onCommit,
  onUndo,
  loadingCommit,
  loadingInit,
  loadingPrediction
}) {
  return (
    <div className="h-full w-full bg-[#F0F0F0] flex flex-col items-center justify-around px-8">

      <div
        className={`w-full flex items-center justify-center h-[40%] rounded-xl ${
          processMessage ? 'bg-blue-500' : 'bg-blue-300'
        } text-white`}
      >
        {processMessage ? (
          <p className="text-center">{processMessage}</p>
        ) : (
          <p className="text-center">No messages</p>
        )}
      </div>

      <button
        className="w-full bg-green-500 hover:bg-green-600 text-xl text-white font-semibold rounded-full disabled:opacity-50 h-[15%]"
        onClick={onCommit}
        disabled={loadingCommit || loadingInit || loadingPrediction}
      >
        Commit
      </button>

      <button
        className="w-full bg-red-500 hover:bg-red-600 text-xl text-white font-semibold rounded-full disabled:opacity-50 h-[15%]"
        onClick={onUndo}
        disabled={loadingCommit || loadingInit || loadingPrediction}
      >
        Undo
      </button>
    </div>
  );
}
