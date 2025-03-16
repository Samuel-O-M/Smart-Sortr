import React, { useState, useEffect } from 'react';
import Header from './Header';
import ProcessPanel from './ProcessPanel';
import ImagePreview from './ImagePreview';
import ActionHistory from './ActionHistory';
import FoldersManager from './FoldersManager';

export default function Home() {
  // ================ State variables ================
  const [backendUrl, setBackendUrl] = useState('');
  const [userToken, setUserToken] = useState(null);
  const [image, setImage] = useState(null); // { image_name, image_data, mime_type }
  const [actionHistory, setActionHistory] = useState([]); 
  const [folders, setFolders] = useState([]); // each folder: { name, is_empty, has_pending, can_delete, prediction }
  const [error, setError] = useState(null);
  const [processMessage, setProcessMessage] = useState('');
  
  const [loadingInit, setLoadingInit] = useState(false);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [loadingCommit, setLoadingCommit] = useState(false);
  
  // New state variable to persist predictions
  const [predictions, setPredictions] = useState({});

  // Helper to append log messages (new messages on top)
  const appendLog = (msg) => {
    setProcessMessage(prev => msg + "\n" + prev);
  };

  // Clear logs handler
  const clearLogs = () => {
    setProcessMessage('');
  };

  // ================ Detect backend ================
  const detectBackend = async () => {
    const envBackendUrl = import.meta.env.VITE_BACKEND_URL;
    if (!envBackendUrl) {
      setError("No backend URL provided in .env");
      appendLog("No backend URL provided in .env");
      return;
    }
    try {
      const res = await fetch(`${envBackendUrl}/heartbeat`);
      const data = await res.json();
      if (!res.ok) {
        if (data.error && data.error.includes("Another user is currently connected")) {
          console.error("Another user is currently connected. Try again later.");
          appendLog("Try again later\nAnother user is currently connected");
          setError("Another user is currently connected. Try again later.");
          return;
        } else {
          console.error("Backend did not respond properly");
          appendLog("Backend did not respond properly");
          setError("Backend did not respond properly");
          return;
        }
      }
      // Successful connection
      setBackendUrl(envBackendUrl);
      if (data.token) setUserToken(data.token);
      console.log("Connected to backend on", envBackendUrl);
      appendLog(`Connected to backend on ${envBackendUrl}`);
    } catch (err) {
      console.error("Error connecting to backend", err);
      appendLog("Error connecting to backend");
      setError("Error connecting to backend");
    }
  };
      
  // ================ Heartbeat ================
  const sendHeartbeat = async () => {
    if (!backendUrl) return;
    try {
      const res = await fetch(`${backendUrl}/heartbeat`, {
        headers: { "X-User-Token": userToken ? userToken : "" }
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error && data.error.includes("Another user is currently connected")) {
          console.error("Another user is currently connected. Try again later.");
          appendLog("Try again later\nAnother user is currently connected");
          setError("Another user is currently connected. Try again later.");
          return;
        }
      }
      if (res.ok && data.token) {
        setUserToken(data.token);
      }
    } catch (err) {
      console.error("Heartbeat error:", err);
      appendLog("Heartbeat error occurred");
    }
  };
  
  useEffect(() => {
    detectBackend();
  }, []);

  useEffect(() => {
    if (backendUrl) {
      let intervalId;
      const timeoutId = setTimeout(() => {
        sendHeartbeat();
        intervalId = setInterval(sendHeartbeat, 10000);
      }, 5000);
      return () => {
        clearTimeout(timeoutId);
        if (intervalId) clearInterval(intervalId);
      };
    }
  }, [backendUrl, userToken]);
    
  // ================ Initialize model ================
  const initializeModel = async () => {
    if (!backendUrl || !userToken) return;
    setLoadingInit(true);
    appendLog('Initializing model...');
    console.log('Initializing model...');

    try {
      const res = await fetch(`${backendUrl}/initialize`, { 
        method: 'POST',
        headers: { "X-User-Token": userToken }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error initializing model');
      }
      console.log('Model initialized successfully.');
      appendLog('Model initialized successfully');
    } catch (err) {
      console.error(err);
      appendLog('Error initializing model');
      setError(err.message);
    } finally {
      setLoadingInit(false);
      // Fetch after successful init
      fetchFolders();
      fetchActionHistory();
      fetchImage();
    }
  };

  // Auto-run initialization after we find the backend and token
  useEffect(() => {
    if (backendUrl && userToken) {
      initializeModel();
    }
  }, [backendUrl, userToken]);

  // ================ Fetch Folders ================
  const fetchFolders = async () => {
    appendLog('Fetching folders...');
    try {
      const res = await fetch(`${backendUrl}/folders`, {
        headers: { "X-User-Token": userToken }
      });
      if (!res.ok) {
        throw new Error('Error fetching folder list');
      }
      const data = await res.json();
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
      appendLog('Folders updated');
    } catch (err) {
      console.error(err);
      appendLog('Error fetching folders');
    }
  };

  // ================ Fetch Current Image ================
  const fetchImage = async () => {
    appendLog('Fetching image...');
    console.log('Fetching image...');

    try {
      const res = await fetch(`${backendUrl}/current_image`, {
        headers: { "X-User-Token": userToken }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'No image found in input folder');
      }
      const data = await res.json();
      setImage(data);
      console.log('Fetched image:', data.image_name);
      appendLog('Fetched image');
      classifyImage(data.image_name);
    } catch (err) {
      console.error(err);
      appendLog('Error fetching image');
      setImage(null);
    }
  };

  // ================ Classify Image ================
  const classifyImage = async (imageName) => {
    if (!imageName) return;
    setLoadingPrediction(true);
    appendLog('Classifying image...');
    console.log('Classifying image:', imageName);
  
    // Update folders to show a placeholder prediction
    setFolders((prev) =>
      prev.map((fld) =>
        fld.name.toLowerCase() !== "input" ? { ...fld, prediction: "..." } : fld
      )
    );
  
    try {
      const res = await fetch(`${backendUrl}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', "X-User-Token": userToken },
        body: JSON.stringify({ image_name: imageName })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error classifying image');
      }
      const data = await res.json();
      setPredictions(data.predictions);
      setFolders((prev) =>
        prev.map((fld) => {
          if (data.predictions[fld.name] !== undefined) {
            return { ...fld, prediction: data.predictions[fld.name] };
          }
          return fld;
        })
      );
      console.log('Predictions:', data.predictions);
      appendLog('Predictions updated');
    } catch (err) {
      console.error(err);
      appendLog('Error classifying image');
    } finally {
      setLoadingPrediction(false);
    }
  };
    
  // ================ Fetch Action History ================
  const fetchActionHistory = async () => {
    appendLog('Fetching action history...');
    try {
      const res = await fetch(`${backendUrl}/stack`, {
        headers: { "X-User-Token": userToken }
      });
      if (!res.ok) {
        throw new Error('Error fetching stack');
      }
      const data = await res.json();
      setActionHistory(data.stack);
      console.log('Action history updated:', data.stack);
      appendLog('Action history updated');
    } catch (err) {
      console.error(err);
      appendLog('Error fetching action history');
    }
  };

  // ================ Handlers for Folders ================
  const handleCreateFolder = async (folderName) => {
    if (!folderName) return;
    try {
      const res = await fetch(`${backendUrl}/folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', "X-User-Token": userToken },
        body: JSON.stringify({ operation: 'create', folder_name: folderName })
      });
      console.log(`Folder "${folderName}" created.`);
      appendLog(`Folder created: ${folderName}`);
      fetchFolders();
    } catch (err) {
      console.error(err);
      appendLog('Error creating folder');
    }
  };
  
  const handleDeleteFolder = async (folderName) => {
    if (!window.confirm(`Are you sure you want to delete "${folderName}"?`)) return;
    try {
      const res = await fetch(`${backendUrl}/folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', "X-User-Token": userToken },
        body: JSON.stringify({ operation: 'delete', folder_name: folderName })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error deleting folder');
      }
      console.log(`Folder "${folderName}" deleted.`);
      appendLog(`Folder deleted: ${folderName}`);
      fetchFolders();
    } catch (err) {
      console.error(err);
      appendLog('Error deleting folder');
    }
  };

  const handleFolderClick = async (folderName) => {
    if (!image || !image.image_name) return;
    try {
      const res = await fetch(`${backendUrl}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', "X-User-Token": userToken },
        body: JSON.stringify({ image_name: image.image_name, target_folder: folderName })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error adding action');
      }
      console.log(`Pending action: ${image.image_name} -> ${folderName}`);
      appendLog(`New pending action`);
      const newAction = { ...image, target_folder: folderName };
      setActionHistory((prev) => [...prev, newAction]);
      fetchImage();    
      fetchFolders();
    } catch (err) {
      console.error(err);
      appendLog('Error processing folder action');
    }
  };
  
  // ================ Undo and Commit Handlers ================
  const handleUndo = async () => {
    try {
      const res = await fetch(`${backendUrl}/undo`, { 
        method: 'POST',
        headers: { "X-User-Token": userToken }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error undoing action');
      }
      console.log('Undo performed.');
      appendLog('Undo performed');
      setActionHistory((prev) => prev.slice(0, -1));
      fetchFolders();
      fetchImage();
    } catch (err) {
      console.error(err);
      appendLog('Error undoing action');
    }
  };

  const handleCommit = async () => {
    if (actionHistory.length === 0) {
      appendLog('Error: No actions to commit');
      return;
    }
    setLoadingCommit(true);
    appendLog('Committing all pending actions...');
    console.log('Committing all pending actions...');
    
    try {
      const res = await fetch(`${backendUrl}/commit`, { 
        method: 'POST',
        headers: { "X-User-Token": userToken }
      });
      const data = await res.json();
  
      if (!res.ok) {
        console.error("Commit error:", data.error);
        appendLog('Error committing actions');
      } else {
        console.log("Commit succeeded:", data.message);
        appendLog('Commit succeeded');
      }
      
      await fetchActionHistory();
      await fetchFolders();
      await fetchImage();
    } catch (err) {
      console.error(err);
      appendLog('Error committing actions');
    } finally {
      setLoadingCommit(false);
    }
  };
  
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <div className="h-[14%]">
        <Header />
      </div>
  
      <div className="h-[64%] flex overflow-hidden">
        <div className="w-[25%]">
          <ProcessPanel
            processMessage={processMessage}
            onCommit={handleCommit}
            onUndo={handleUndo}
            onClear={clearLogs}
            loadingCommit={loadingCommit}
            loadingInit={loadingInit}
            loadingPrediction={loadingPrediction}
          />
        </div>

        <div className="w-[50%]">
          <ImagePreview image={image} />
        </div>
  
        <div className="w-[25%]">
          <ActionHistory actionHistory={actionHistory} />
        </div>
      </div>
  
      <div className="h-[22%]">
        <FoldersManager
          folders={folders}
          handleCreateFolder={handleCreateFolder}
          handleFolderClick={handleFolderClick}
          handleDeleteFolder={handleDeleteFolder}
        />
      </div>
    </div>
  );
}
