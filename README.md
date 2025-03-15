# Image Categorization & Model Management System

This project is a full-stack application designed for managing image categorization through a machine learning model. It consists of a Flask backend for model training, updating, and image folder management, and a React frontend for user interaction, including image preview, action history, and folder management.

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Todos & Future Improvements](#todos--future-improvements)
- [License](#license)

## Features

- **Model Initialization:** Automatically scans a working directory for image categories, computes image hashes, and fine-tunes a pre-trained ResNet50 model.
- **Dynamic Folder Management:** Create, delete, and update folders with pending image actions.
- **Image Prediction & Classification:** Classify images using the fine-tuned model and update predictions in real time.
- **Model Update:** Update the model by adding new user data with a partial fine-tuning mechanism (to be improved to complete retrain in the future).
- **Action History & Undo:** Manage pending actions with undo and commit functionalities.

## Project Structure

```
.
├── backend
│   ├── sample_data/         # Example images and folders for testing
│   ├── app.py               # Main Flask application with API endpoints
│   ├── model_manager.py     # Model creation, training, updating, and prediction logic
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── .env
│   └── .gitignore
├── frontend
│   ├── public/
│   ├── src
│   │   ├── assets/
│   │   └── components
│   │       ├── ActionHistory.jsx    # Renders the list of user actions
│   │       ├── FoldersManager.jsx   # Manages folder creation, deletion, and actions
│   │       ├── Header.jsx           # Top navigation/header component
│   │       ├── Home.jsx             # Main container rendering the UI layout
│   │       ├── ImagePreview.jsx     # Displays the currently selected image
│   │       └── ProcessPanel.jsx     # Panel for showing process messages and commit/undo actions
│   ├── package.json
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── .env
│   └── .gitignore
└── README.md                # Project documentation and instructions
```

## Requirements

- **Python 3.7+**
- **Node.js & npm**
- **PyTorch**
- **Flask**
- **dotenv**

## Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/Samuel-O-M/Smart-Sortr.git
   cd Smart-Sortr
   ```

2. **Setup the Backend:**

   - Create a virtual environment and activate it:
   
     ```bash
     python -m venv venv
     venv\Scripts\activate  # on Unix use: source venv/bin/activate
     ```
     
   - Install the required Python packages:
   
     ```bash
     pip install -r requirements.txt
     ```

3. **Setup the Frontend:**

   - Navigate to the frontend directory:
   
     ```bash
     cd frontend
     ```
     
   - Install frontend dependencies:
   
     ```bash
     npm install
     ```

## Usage

1. **Backend:**  
   Run the Flask application with:
   
   ```bash
   python app.py
   ```
   
   The backend listens on the port specified in your environment variables (default is 5000).

2. **Frontend:**
   Run the React application with::
   
   ```bash
   npm run dev
   ```
   
   Open your browser and navigate to `http://localhost:3000` to use the interface.

## API Endpoints

- **GET `/health`**  
  Returns a simple status message indicating the backend is running.
  
- **POST `/initialize`**  
  Initializes the model by loading the working directory, setting up folders, and training (if needed).
  
- **GET `/folders`**  
  Returns a list of folders and their statuses.
  
- **POST `/folder`**  
  Creates or deletes a folder based on the provided operation.
  
- **GET `/current_image`**  
  Fetches the next image from the input folder that is not pending.
  
- **POST `/classify`**  
  Classifies the current image and returns category scores.
  
- **POST `/commit`**  
  Commits pending actions (moves images to folders, updates the model).

For full details on the API usage, check the source code in `app.py`.


## Todos & Future Improvements

- **Model Training:**  
  - [ ] Test fine-tuning to ensure it maintains consistent performance regardless of training order.  
  - [ ] If results are unsatisfactory, replace partial fine-tuning with complete retraining when new data is added.

- **Frontend Redesign:**  
  - [ ] Redesign the UI for improved aesthetics and usability.  
  - [ ] Improve responsiveness and the overall look of the frontend.

- **Feature Enhancements:**  
  - [ ] Add user authentication.  
  - [ ] Enable multi-user functionality (currently, global variables restrict usage to a single user).  
  - [ ] Enhance error handling and logging in both the backend and frontend.


## License

This project is licensed under the [MIT License](LICENSE).
