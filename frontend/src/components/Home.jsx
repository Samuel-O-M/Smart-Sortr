import React, { useState, useEffect } from 'react';
import Header from './Header';
import ProcessPanel from './ProcessPanel';
import ImagePreview from './ImagePreview';
import ActionHistory from './ActionHistory';
import FoldersManager from './FoldersManager';

export default function Home() {
  // ================ State variables ================
  const [backendUrl, setBackendUrl] = useState('');
  const [image, setImage] = useState(null); // { image_name, image_data, mime_type }
  const [actionHistory, setActionHistory] = useState([]); 
  const [folders, setFolders] = useState([]); // each folder: { name, is_empty, has_pending, can_delete, prediction }
  const [error, setError] = useState(null);
  const [processMessage, setProcessMessage] = useState('');
  
  const [loadingInit, setLoadingInit] = useState(false);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [loadingCommit, setLoadingCommit] = useState(false);
  
  // For creating folders
  const [newFolderName, setNewFolderName] = useState('');
  
  // New state variable to persist predictions
  const [predictions, setPredictions] = useState({});

  // ================ Detect backend ================
  const detectBackend = async () => {
    // Try port 5000, then 5001
    let url = '';
    try {
      const res = await fetch('http://127.0.0.1:5000/health');
      if (res.ok) {
        url = 'http://127.0.0.1:5000';
      }
    } catch (err) {}
    if (!url) {
      try {
        const res = await fetch('http://127.0.0.1:5001/health');
        if (res.ok) {
          url = 'http://127.0.0.1:5001';
        }
      } catch (err) {}
    }
    if (url) {
      setBackendUrl(url);
      console.log('Connected to backend on', url);
    } else {
      console.error('Backend not found on ports 5000 or 5001.');
      setError('No backend found on ports 5000 or 5001');
    }
  };

  useEffect(() => {
    detectBackend();
  }, []);

  // ================ Initialize model ================
  const initializeModel = async () => {
    if (!backendUrl) return;
    setLoadingInit(true);
    setProcessMessage('Initializing model...');
    console.log('Initializing model...');

    try {
      const res = await fetch(`${backendUrl}/initialize`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error initializing model');
      }
      console.log('Model initialized successfully.');
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoadingInit(false);
      setProcessMessage('');
      // Fetch after successful init
      fetchFolders();
      fetchActionHistory();
      fetchImage();
    }
  };

  // Auto-run initialization after we find the backend
  useEffect(() => {
    if (backendUrl) {
      initializeModel();
    }
  }, [backendUrl]);

  // ================ Fetch Folders ================
  const fetchFolders = async () => {
    try {
      const res = await fetch(`${backendUrl}/folders`);
      if (!res.ok) {
        throw new Error('Error fetching folder list');
      }
      const data = await res.json();
      // Convert the object into an array of folder objects, preserving predictions
      const arr = Object.keys(data.folders).map((folderName) => {
        const f = data.folders[folderName];
        return {
          name: folderName,
          is_empty: !!f.is_empty,
          has_pending: f.has_pending || 0,
          can_delete: !!(f.is_empty && f.has_pending === 0),
          prediction: predictions[folderName] !== undefined ? predictions[folderName] : 'N/A'
        };
      });
      setFolders(arr);
      console.log('Folders updated:', arr);
    } catch (err) {
      console.error(err);
    }
  };

  // ================ Fetch Current Image ================
  const fetchImage = async () => {
    setProcessMessage('Fetching image...');
    console.log('Fetching image...');

    try {
      const res = await fetch(`${backendUrl}/current_image`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'No image found in input folder');
      }
      const data = await res.json();
      setImage(data);
      console.log('Fetched image:', data.image_name);
      // After we have an image, classify it
      classifyImage(data.image_name);
    } catch (err) {
      console.error(err);
      setImage(null);
    } finally {
      setProcessMessage('');
    }
  };

  // ================ Classify Image ================
  const classifyImage = async (imageName) => {
    if (!imageName) return;
    setLoadingPrediction(true);
    setProcessMessage('Classifying image...');
    console.log('Classifying image:', imageName);
  
    // Immediately update folders to show a placeholder prediction
    setFolders((prev) =>
      prev.map((fld) =>
        fld.name.toLowerCase() !== "input" ? { ...fld, prediction: "..." } : fld
      )
    );
  
    try {
      const res = await fetch(`${backendUrl}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_name: imageName })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error classifying image');
      }
      const data = await res.json();
      // Persist actual predictions
      setPredictions(data.predictions);
      // Update folders with actual predictions where available
      setFolders((prev) =>
        prev.map((fld) => {
          if (data.predictions[fld.name] !== undefined) {
            return { ...fld, prediction: data.predictions[fld.name] };
          }
          return fld;
        })
      );
      console.log('Predictions:', data.predictions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPrediction(false);
      setProcessMessage('');
    }
  };
    
  // ================ Fetch Action History ================
  const fetchActionHistory = async () => {
    try {
      const res = await fetch(`${backendUrl}/stack`);
      if (!res.ok) {
        throw new Error('Error fetching stack');
      }
      const data = await res.json();
      // Assume each element is an object: { image_name, target_folder }
      setActionHistory(data.stack);
      console.log('Action history updated:', data.stack);
    } catch (err) {
      console.error(err);
    }
  };

  // ================ Handlers for Folders ================
  const handleCreateFolder = async () => {
    if (!newFolderName) return;
    try {
      const res = await fetch(`${backendUrl}/folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'create', folder_name: newFolderName })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error creating folder');
      }
      console.log(`Folder "${newFolderName}" created.`);
      setNewFolderName('');
      fetchFolders();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFolder = async (folderName) => {
    if (!window.confirm(`Are you sure you want to delete "${folderName}"?`)) return;
    try {
      const res = await fetch(`${backendUrl}/folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'delete', folder_name: folderName })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error deleting folder');
      }
      console.log(`Folder "${folderName}" deleted.`);
      fetchFolders();
    } catch (err) {
      console.error(err);
    }
  };

  const handleFolderClick = async (folderName) => {
    if (!image || !image.image_name) return;
    try {
      const res = await fetch(`${backendUrl}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_name: image.image_name, target_folder: folderName })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error adding action');
      }
      console.log(`Pending action: ${image.image_name} -> ${folderName}`);
      // Combine current image object with the target folder:
      const newAction = { ...image, target_folder: folderName };
      setActionHistory((prev) => [...prev, newAction]);
      // Refresh the image and folders (actionHistory is already updated locally)
      fetchImage();    
      fetchFolders();
    } catch (err) {
      console.error(err);
    }
  };
  

  // ================ Undo and Commit Handlers ================
  const handleUndo = async () => {
    try {
      const res = await fetch(`${backendUrl}/undo`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error undoing action');
      }
      console.log('Undo performed.');
      // Pop the last action from the local actionHistory state
      setActionHistory((prev) => prev.slice(0, -1));
      // Refresh folders and get the next image
      fetchFolders();
      fetchImage();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCommit = async () => {
    setLoadingCommit(true);
    setProcessMessage('Committing...');
    console.log('Committing all pending actions...');
  
    try {
      const res = await fetch(`${backendUrl}/commit`, { method: 'POST' });
      const data = await res.json();
  
      if (!res.ok) {
        console.error("Commit error:", data.error, data.results);
      } else {
        console.log("Commit succeeded:", data.message, data.results);
      }
      
      // Sequentially update state after commit is fully finished.
      await fetchActionHistory();
      await fetchFolders();
      await fetchImage();
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCommit(false);
      setProcessMessage('');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* Top header */}
      <Header />

      {/* Main content area (3 columns) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: process messages + commit/undo */}
        <ProcessPanel
          processMessage={processMessage}
          onUndo={handleUndo}
          onCommit={handleCommit}
          loadingCommit={loadingCommit}
          loadingInit={loadingInit}
          loadingPrediction={loadingPrediction}
        />

        {/* Center: image preview */}
        <ImagePreview image={image} />

        {/* Right: action history */}
        <ActionHistory actionHistory={actionHistory} />
      </div>

      {/* Bottom: folder block */}
      <FoldersManager
        folders={folders}
        newFolderName={newFolderName}
        setNewFolderName={setNewFolderName}
        handleCreateFolder={handleCreateFolder}
        handleFolderClick={handleFolderClick}
        handleDeleteFolder={handleDeleteFolder}
      />
    </div>
  );
}
