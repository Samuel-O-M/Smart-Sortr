import React, { useState, useEffect } from 'react';

function Home() {
  const BACKEND_URL = 'http://127.0.0.1:5000';
  const [image, setImage] = useState(null); // { image_file, image_data, mime_type }
  const [predictions, setPredictions] = useState(null);
  const [pendingActions, setPendingActions] = useState([]); // list of { image, target_folder }
  const [folders, setFolders] = useState([]); // list of folder names
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState(null);

  // Fetch the current image from /image endpoint
  const fetchImage = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/image`);
      if (!response.ok) {
        const err = await response.json();
        setError(err.error || 'Error fetching image');
        setImage(null);
        setPredictions(null);
      } else {
        const data = await response.json();
        setImage(data);
        setError(null);
      }
    } catch (err) {
      setError('Error fetching image');
    }
  };

  // Classify the current image using /classify endpoint
  const classifyImage = async (imageFile) => {
    try {
      const response = await fetch(`${BACKEND_URL}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_file: imageFile })
      });
      if (!response.ok) {
        const err = await response.json();
        setError(err.error || 'Error classifying image');
        setPredictions(null);
        setFolders([]);
      } else {
        const data = await response.json();
        setPredictions(data.predictions);
        // Use folder names from the classification result
        setFolders(Object.keys(data.predictions));
        setError(null);
      }
    } catch (err) {
      setError('Error classifying image');
    }
  };

  // Fetch image on mount
  useEffect(() => {
    fetchImage();
  }, []);

  // Once an image is loaded, automatically classify it
  useEffect(() => {
    if (image && image.image_file) {
      classifyImage(image.image_file);
    }
  }, [image]);

  // Record an update action when a folder is clicked
  const handleFolderClick = (folder) => {
    if (image && image.image_file) {
      setPendingActions(prev => [...prev, { image: image.image_file, target_folder: folder }]);
    }
  };

  // Commit pending update actions to the backend via /update endpoint
  const commitChanges = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingActions)
      });
      if (!response.ok) {
        const err = await response.json();
        alert('Error committing changes: ' + (err.error || 'Unknown error'));
      } else {
        const result = await response.json();
        console.log('Commit result:', result);
        // Clear pending actions and fetch the next image
        setPendingActions([]);
        fetchImage();
      }
    } catch (err) {
      alert('Error committing changes');
    } finally {
      setShowModal(false);
    }
  };

  const addFolder = async () => {
    const folderName = prompt("Enter new folder name:");
    if (!folderName) return;
    
    try {
      const response = await fetch("http://localhost:5000/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "create", folder_name: folderName })
      });
      
      const data = await response.json();
      // Display the exact response from the endpoint as a formatted JSON string.
      alert(JSON.stringify(data, null, 2));
      
      // Optionally, if the folder was created successfully, update the folder list.
      if (response.ok) {
        setFolders(prev => [...prev, folderName]);
      }
    } catch (error) {
      alert("Error creating folder: " + error.message);
    }
  };


  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-800">Image Classification App</h1>
      </header>
      <main className="w-full max-w-md bg-white shadow-md rounded-lg p-6">
        {error && <div className="text-red-500 mb-4">{error}</div>}
        {image ? (
          <div>
            <img 
              src={`data:${image.mime_type};base64,${image.image_data}`} 
              alt="Current" 
              className="w-full h-auto rounded mb-4 object-cover" 
            />
            {predictions && (
              <div className="mb-4">
                <h2 className="text-xl font-semibold mb-2">Predictions</h2>
                <ul>
                  {Object.entries(predictions).map(([folder, score]) => (
                    <li key={folder}>
                      {folder}: {(score * 100).toFixed(2)}%
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div>No image available</div>
        )}
        <button 
          className="w-full bg-purple-500 hover:bg-purple-600 text-white py-2 rounded mb-4"
          onClick={() => setShowModal(true)}
          disabled={pendingActions.length === 0}
        >
          Commit Changes ({pendingActions.length})
        </button>
      </main>
      {/* Scrollable folder row */}
      <div className="w-full max-w-md mt-4 overflow-x-auto">
        <div className="flex space-x-4">
          {folders.map(folder => (
            <button 
              key={folder}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded whitespace-nowrap"
              onClick={() => handleFolderClick(folder)}
            >
              {folder}
            </button>
          ))}
          <button 
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded whitespace-nowrap"
            onClick={addFolder}
          >
            + Add Folder
          </button>
        </div>
      </div>

      {/* Commit Changes Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
            <h2 className="text-xl font-semibold mb-4">Confirm Commit</h2>
            <ul className="mb-4">
              {pendingActions.map((action, index) => (
                <li key={index}>
                  {action.image} → {action.target_folder}
                </li>
              ))}
            </ul>
            <div className="flex justify-end space-x-2">
              <button 
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button 
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
                onClick={commitChanges}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Home;
