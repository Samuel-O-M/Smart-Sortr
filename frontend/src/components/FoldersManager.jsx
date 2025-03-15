import React, { useState } from 'react';

export default function FoldersBlock({
  folders,
  handleCreateFolder,
  handleFolderClick,
  handleDeleteFolder,
}) {
  // Filter folders for the top row (folders with images, excluding 'input')
  const foldersWithImages = folders.filter(
    (f) => !f.is_empty && f.name !== 'input'
  );

  // Sort folders by prediction descending, treating "N/A" as 0
  const sortedFoldersWithImages = [...foldersWithImages].sort((a, b) => {
    const aScore = a.prediction !== 'N/A' ? Number(a.prediction) : 0;
    const bScore = b.prediction !== 'N/A' ? Number(b.prediction) : 0;
    return bScore - aScore;
  });

  // Filter for empty or pending folders (including 'input' except we skip it in rendering)
  const emptyOrPendingFolders = folders.filter(
    (f) => f.is_empty || f.name === 'input'
  );

  return (
    <div className="h-full flex flex-col justify-around bg-[#f0f0f0] p-4">
      {/* Top Block */}
      <div className="flex flex-row w-full" style={{ flex: 1 }}>
        {/* Top Left Block */}
        <div className="w-[20%]" />

        {/* Top Right Block */}
        <div className="w-[85%] overflow-x-auto whitespace-nowrap hide-scrollbar flex items-center">
          {sortedFoldersWithImages.length > 0 ? (
            <div className="flex space-x-2">
              {sortedFoldersWithImages.map((folder) => (
                <div key={folder.name} className="inline-block">
                  <button
                    className="px-3 py-1 bg-white border rounded shadow"
                    onClick={() => handleFolderClick(folder.name)}
                  >
                    {folder.name}{' '}
                    {folder.prediction && folder.prediction !== 'N/A'
                      ? folder.prediction === '...'
                        ? `(${folder.prediction})`
                        : `(${folder.prediction}%)`
                      : '(N/A)'}
                  </button>
                  {folder.can_delete && (
                    <button
                      className="ml-1 px-2 text-red-600 border border-red-600 rounded"
                      onClick={() => handleDeleteFolder(folder.name)}
                    >
                      X
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            // placeholder folder element when no folders are available
            <div className="inline-block">
              <div className="px-3 py-1 bg-gray-300 border rounded shadow opacity-50">
                Folder
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Block */}
      <div className="flex flex-row w-full" style={{ flex: 1 }}>
        {/* Bottom Left Block */}
        <div className="w-[20%] flex items-center justify-center">
        <button
          className="px-3 py-1 bg-blue-500 text-white rounded shadow"
          onClick={() => {
            const folderName = window.prompt('Enter folder name:');
            if (folderName) {
              handleCreateFolder(folderName);
            }
          }}
        >
          + Create Folder
        </button>
        </div>

        {/* Bottom Right Block */}
        <div className="w-[85%] overflow-x-auto whitespace-nowrap hide-scrollbar flex items-center">
          {emptyOrPendingFolders.map((folder) => {
            // Skip special folders named "input" if needed
            if (folder.name.toLowerCase() === 'input') {
              return null;
            }
            return (
              <div key={folder.name} className="inline-block mr-2">
                <button
                  className="px-3 py-1 bg-white border rounded shadow"
                  onClick={() => handleFolderClick(folder.name)}
                >
                  {folder.name} (N/A)
                </button>
                {folder.can_delete && (
                  <button
                    className="ml-1 px-2 text-red-600 border border-red-600 rounded"
                    onClick={() => handleDeleteFolder(folder.name)}
                  >
                    X
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
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
