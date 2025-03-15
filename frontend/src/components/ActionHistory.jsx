import React from 'react';

export default function ActionHistory({ actionHistory }) {
  return (
    <div className="w-64 bg-yellow-100 flex flex-col">
      {/* Fixed title bar */}
      <div className="bg-yellow-300 text-black font-semibold px-2 py-2">
        Action History
      </div>
      {/* Scrollable list of pending actions */}
      <div className="flex-1 overflow-y-auto p-2">
        {actionHistory && actionHistory.length > 0 ? (
          actionHistory.map((action, idx) => (
            <div
              key={idx}
              className="mb-2 p-2 border border-gray-300 bg-white shadow-sm"
            >
              <p className="text-sm font-semibold">
                {action.image_name || 'Untitled'}
              </p>
              <p className="text-xs">
                to {action.target_folder || 'Unknown Folder'}
              </p>
              {action.image_data && action.mime_type && (
                <img
                  src={`data:${action.mime_type};base64,${action.image_data}`}
                  alt={action.image_name}
                  className="mt-2 w-full h-auto"
                />
              )}
            </div>
          ))
        ) : (
          <p className="text-gray-700">No pending actions</p>
        )}
      </div>
    </div>
  );
}
