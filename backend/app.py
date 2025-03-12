import os
import random
import shutil
import base64
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


# Hardcoded working folder path
WORKING_DIR = r"C:\Users\Samu\Desktop\folder"
INPUT_FOLDER = os.path.join(WORKING_DIR, "input")

# Ensure the input folder exists
os.makedirs(INPUT_FOLDER, exist_ok=True)
# Ensure the trash folder exists as one of the categories
TRASH_FOLDER = os.path.join(WORKING_DIR, "trash")
os.makedirs(TRASH_FOLDER, exist_ok=True)

# ----------------- Endpoint: / -----------------
@app.route('/')
def hello_world():
    return 'Hello, World!'

# ----------------- Endpoint: /folder -----------------
@app.route('/folder', methods=['POST'])
def manage_folder():
    """
    Create or delete a folder in the working directory.
    Expected JSON format: 
      {"operation": "create" or "delete", "folder_name": "name"}
    """
    data = request.json
    operation = data.get("operation")
    folder_name = data.get("folder_name")
    
    if not operation or not folder_name:
        return jsonify({"error": "Operation and folder name required"}), 400
    
    # Do not allow deletion of the protected input folder.
    if operation == "delete" and folder_name.lower() == "input":
        return jsonify({"error": "Cannot delete the input folder"}), 400

    folder_path = os.path.join(WORKING_DIR, folder_name)
    
    try:
        if operation == "create":
            os.makedirs(folder_path, exist_ok=True)
            return jsonify({"message": f"Folder '{folder_name}' created."})
        elif operation == "delete":
            shutil.rmtree(folder_path)
            return jsonify({"message": f"Folder '{folder_name}' deleted."})
        else:
            return jsonify({"error": "Invalid operation"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
# ----------------- Endpoint: /image -----------------
@app.route('/image', methods=['GET'])
def get_image():
    """
    Return the next image from the input folder along with its file name.
    The image is returned as a base64 encoded string.
    """
    images = [f for f in os.listdir(INPUT_FOLDER)
              if os.path.isfile(os.path.join(INPUT_FOLDER, f))]
    
    if not images:
        return jsonify({"error": "No images found in input folder"}), 404
    
    image_file = images[0]
    image_path = os.path.join(INPUT_FOLDER, image_file)
    
    # Read and encode the image in base64
    with open(image_path, "rb") as img:
        image_data = base64.b64encode(img.read()).decode('utf-8')
    
    return jsonify({
        "image_file": image_file,
        "image_data": image_data,
        "mime_type": "image/jpeg"
    })

# ----------------- Endpoint: /classify -----------------
@app.route('/classify', methods=['POST'])
def classify_image():
    """
    Given an image file name (located in the input folder),
    return a JSON object with random classification percentages for each category folder.
    Expected JSON format: {"image_file": "example.jpg"}
    """
    data = request.json
    image_file = data.get("image_file")
    
    if not image_file:
        return jsonify({"error": "No image file specified"}), 400

    image_path = os.path.join(INPUT_FOLDER, image_file)
    if not os.path.exists(image_path):
        return jsonify({"error": "Image not found in input folder"}), 404
    
    # List all category folders (all subfolders in WORKING_DIR except 'input')
    folders = [d for d in os.listdir(WORKING_DIR)
               if os.path.isdir(os.path.join(WORKING_DIR, d)) and d.lower() != "input"]
    
    if not folders:
        return jsonify({"error": "No category folders found"}), 404
    
    # Generate random scores for each folder
    scores = {folder: random.randint(1, 100) for folder in folders}
    total_score = sum(scores.values())
    predictions = {folder: round(score / total_score, 2) for folder, score in scores.items()}
    
    return jsonify({
        "image_file": image_file,
        "predictions": predictions
    })

# ----------------- Endpoint: /update -----------------
@app.route('/update', methods=['POST'])
def update_changes():
    """
    Process an array of actions to update changes.
    Each action should contain:
      "image": filename of the image (from input folder)
      "target_folder": destination folder name (category or trash)
    
    Example payload:
      [
        {"image": "photo1.jpg", "target_folder": "Nature"},
        {"image": "photo2.jpg", "target_folder": "trash"}
      ]
    
    This endpoint moves each image from the input folder to the corresponding target folder.
    """
    actions = request.json
    if not isinstance(actions, list):
        return jsonify({"error": "Expected a list of actions"}), 400
    
    results = []
    for action in actions:
        image_file = action.get("image")
        target_folder = action.get("target_folder")
        if not image_file or not target_folder:
            results.append({"image": image_file, "status": "failed", "reason": "Missing image or target_folder"})
            continue
        
        source_path = os.path.join(INPUT_FOLDER, image_file)
        destination_folder = os.path.join(WORKING_DIR, target_folder)
        destination_path = os.path.join(destination_folder, image_file)
        
        if not os.path.exists(source_path):
            results.append({"image": image_file, "status": "failed", "reason": "Image not found in input folder"})
            continue
        
        try:
            os.makedirs(destination_folder, exist_ok=True)
            shutil.move(source_path, destination_path)
            results.append({"image": image_file, "status": "success", "moved_to": target_folder})
        except Exception as e:
            results.append({"image": image_file, "status": "failed", "reason": str(e)})
    
    return jsonify({"results": results})

# ----------------- Run the Flask App -----------------
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
