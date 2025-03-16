import React from 'react';

export default function ActionHistory({ actionHistory }) {
  return (
    <div className="h-full w-full bg-[#F0F0F0] flex flex-col">
      {/* Title Block */}
      <div className="flex items-center m-6 bg-[#1B1F23] h-12 rounded-lg justify-center">
        <h2 className="text-white font-semibold text-xl">Action History</h2>
      </div>

      {/* Actions List Block */}
      <div
        className="flex-1 p-4 overflow-y-auto hide-scrollbar"
      >
        {actionHistory && actionHistory.length > 0 ? (
          [...actionHistory].reverse().map((action, idx) => (
            <div
              key={idx}
              className="flex items-center mb-4 p-2 border"
              style={{ borderColor: "#BDC3C7" }}
            >
              {/* Left: Fixed-size Image Preview */}
              <div
                className="flex-shrink-0 mr-4"
                style={{ width: "80px", height: "80px" }}
              >
                {action.image_data && action.mime_type ? (
                  <img
                    src={`data:${action.mime_type};base64,${action.image_data}`}
                    alt={action.image_name || "Untitled"}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-300 flex items-center justify-center text-xs text-gray-700">
                    No Image
                  </div>
                )}
              </div>

              {/* Right: Text Details (Name and Folder) */}
              <div className="flex flex-col overflow-hidden">
                <span
                  className="font-semibold truncate"
                  title={action.image_name || "Untitled"}
                >
                  {action.image_name || "Untitled"}
                </span>
                <span
                  className="text-sm truncate"
                  title={`To folder ${action.target_folder || "Unknown Folder"}`}
                >
                  To folder {action.target_folder || "Unknown Folder"}
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-700">No pending actions</p>
        )}
      </div>

      {/* Inline CSS to hide scrollbar */}
      <style jsx = "true">{`
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
