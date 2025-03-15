import React from 'react';

export default function FoldersBlock({
  folders,
  newFolderName,
  setNewFolderName,
  handleCreateFolder,
  handleFolderClick,
  handleDeleteFolder,
}) {
  // Filter folders for the first row (folders with images)
  const foldersWithImages = folders.filter(
    (f) => !f.is_empty && f.name !== 'input'
  );

  // Sort folders by prediction descending, treating "N/A" as 0
  const sortedFoldersWithImages = [...foldersWithImages].sort((a, b) => {
    const aScore = a.prediction !== 'N/A' ? Number(a.prediction) : 0;
    const bScore = b.prediction !== 'N/A' ? Number(b.prediction) : 0;
    return bScore - aScore;
  });

  return (
    <>
      <div className="bg-gray-200 p-2">
        {/* First row: Folders with Images */}
        <div className="overflow-x-auto whitespace-nowrap mb-2 hide-scrollbar">
          <p className="font-semibold">Folders with Images:</p>
          <div className="flex space-x-2">
          {sortedFoldersWithImages.length > 0 ? (
              sortedFoldersWithImages.map((folder) => (
                <div key={folder.name} className="inline-block">
                  <button
                    className="px-3 py-1 bg-white border rounded shadow"
                    onClick={() => handleFolderClick(folder.name)}
                  >
                    {folder.name}{' '}
                    {folder.prediction && folder.prediction !== 'N/A'
                      ? folder.prediction === "..." 
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
              ))
            ) : (
              // Render a placeholder folder element when no folders are available
              <div className="inline-block">
                <div className="px-3 py-1 bg-gray-300 border rounded shadow opacity-50">
                  Folder
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Second row: Empty or Pending Folders */}
        <div className="overflow-x-auto whitespace-nowrap mt-2 hide-scrollbar">
          <p className="font-semibold">Empty or Pending Folders:</p>
          <div className="flex space-x-2 items-center">
            {/* "+" button and input for creating a new folder */}
            <div className="flex items-center space-x-1">
              <button
                className="px-3 py-1 bg-blue-500 text-white rounded shadow"
                onClick={handleCreateFolder}
              >
                + Create Folder
              </button>
              <input
                type="text"
                className="border px-2 py-1 rounded"
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
              />
            </div>
            {folders
              .filter((f) => f.is_empty || f.name === 'input')
              .map((folder) => {
                if (folder.name.toLowerCase() === 'input') {
                  // Skip special folders
                  return null;
                }
                return (
                  <div key={folder.name} className="inline-block">
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
    </>
  );
}
