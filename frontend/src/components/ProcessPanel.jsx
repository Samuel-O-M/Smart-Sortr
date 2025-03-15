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
    <div className="bg-blue-100 w-64 p-4 flex flex-col items-center justify-start">
      {/* Fixed-size area for process messages */}
      <div
        className="bg-blue-300 text-white w-full mb-4 flex items-center justify-center"
        style={{ height: '80px' }} // for example, a fixed height
      >
        {processMessage ? (
          <p className="text-center px-2">{processMessage}</p>
        ) : (
          <p className="text-center px-2">No messages</p>
        )}
      </div>

      <button
        className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded mb-2 disabled:opacity-50"
        onClick={onCommit}
        disabled={loadingCommit || loadingInit || loadingPrediction}
      >
        Commit
      </button>

      <button
        className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded disabled:opacity-50"
        onClick={onUndo}
        disabled={loadingCommit || loadingInit || loadingPrediction}
      >
        Undo
      </button>
    </div>
  );
}
