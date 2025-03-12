import React, { useState, useEffect } from 'react';

function Home() {
  const BACKEND_URL = 'http://127.0.0.1:5000';
  const [image, setImage] = useState(null); // { image_file, image_data, mime_type }
  const [predictions, setPredictions] = useState(null);
  const [folders, setFolders] = useState([]); // list of folder names from classification
  const [error, setError] = useState(null);
  const [pendingStack, setPendingStack] = useState([]);
  const [showCommitModal, setShowCommitModal] = useState(false);

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

  // Fetch pending actions stack
  const fetchStack = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/stack`);
      if (response.ok) {
        const data = await response.json();
        setPendingStack(data.stack);
      }
    } catch (err) {
      console.error('Error fetching stack:', err);
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
        setFolders(Object.keys(data.predictions));
        setError(null);
      }
    } catch (err) {
      setError('Error classifying image');
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchImage();
    fetchStack();
  }, []);

  // When a new image is loaded, classify it
  useEffect(() => {
    if (image && image.image_file) {
      classifyImage(image.image_file);
    }
  }, [image]);

  // Handle folder click: add the pending action
  const handleFolderClick = async (folder) => {
    if (!image || !image.image_file) return;
    try {
      const response = await fetch(`${BACKEND_URL}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: image.image_file, target_folder: folder })
      });
      if (!response.ok) {
        const err = await response.json();
        alert('Error adding action: ' + (err.error || 'Unknown error'));
      } else {
        const result = await response.json();
        console.log('Pending action added:', result);
        // Refresh the pending actions and fetch the next image
        fetchStack();
        fetchImage();
      }
    } catch (err) {
      alert('Error adding action');
    }
  };

  // Undo the last pending action
  const handleUndo = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/undo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (!response.ok) {
        alert('Error undoing action: ' + (data.error || 'Unknown error'));
      } else {
        console.log('Undo result:', data);
        // Set the undone image as the current image if available
        if (data.restored_image) {
          setImage(data.restored_image);
        } else {
          fetchImage();
        }
        fetchStack();
      }
    } catch (err) {
      alert('Error undoing action');
    }
  };
  
  // Commit all pending actions
  const handleCommit = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const err = await response.json();
        alert('Error committing actions: ' + (err.error || 'Unknown error'));
      } else {
        const result = await response.json();
        console.log('Commit result:', result);
        alert('Commit successful.');
        fetchStack();
        fetchImage();
      }
    } catch (err) {
      alert('Error committing actions');
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
        <div className="flex justify-between mb-4">
          <button 
            className="w-1/3 bg-red-500 hover:bg-red-600 text-white py-2 rounded mr-2"
            onClick={handleUndo}
          >
            Undo
          </button>
          <button 
            className="w-1/3 bg-green-500 hover:bg-green-600 text-white py-2 rounded"
            onClick={() => setShowCommitModal(true)}
          >
            Commit
          </button>
        </div>
      </main>
      
      {/* Folder buttons from classification predictions */}
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
        </div>
      </div>
      
      {/* Pending Actions Stack */}
      <section className="w-full max-w-md mt-6 bg-white shadow-md rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-2">Pending Actions</h2>
        {pendingStack.length === 0 ? (
          <p>No pending actions</p>
        ) : (
          <ul>
            {pendingStack.map((action, index) => (
              <li key={index} className="flex items-center space-x-4 mb-2">
                {action.preview && (
                  <img 
                    src={`data:${action.mime_type};base64,${action.preview}`}
                    alt={action.image}
                    className="w-16 h-16 object-cover rounded"
                  />
                )}
                <div>
                  <p className="font-semibold">{action.image}</p>
                  <p className="text-sm">Target: {action.target_folder}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Commit Confirmation Modal */}
      {showCommitModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
            <p className="mb-4">
              Are you sure you want to commit all pending actions?
            </p>
            <div className="flex justify-end space-x-2">
              <button 
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded"
                onClick={() => setShowCommitModal(false)}
              >
                Cancel
              </button>
              <button 
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded"
                onClick={() => {
                  handleCommit();
                  setShowCommitModal(false);
                }}
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
