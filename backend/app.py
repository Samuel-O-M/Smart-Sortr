import os
import random
import shutil
import base64
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Hardcoded working folder path
WORKING_DIR = r"C:\Users\Samu\Desktop\folder"
INPUT_FOLDER = os.path.join(WORKING_DIR, "input")
os.makedirs(INPUT_FOLDER, exist_ok=True)
# Protected trash folder (and any others that might exist)
TRASH_FOLDER = os.path.join(WORKING_DIR, "trash")
os.makedirs(TRASH_FOLDER, exist_ok=True)

# Global in-memory stack for pending actions
update_stack = []

def get_pending_images():
    # Returns list of image filenames that are already pending
    return [action["image"] for action in update_stack]

# ----------------- Endpoint: / -----------------
@app.route('/')
def hello_world():
    return 'Hello, World!'

# ----------------- Endpoint: /folder -----------------
@app.route('/folder', methods=['POST'])
def manage_folder():
    data = request.json
    operation = data.get("operation")
    folder_name = data.get("folder_name")
    
    if not operation or not folder_name:
        return jsonify({"error": "Operation and folder name required"}), 400
    
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
    # Only list images that are not already pending (i.e. not in the update_stack)
    pending = get_pending_images()
    images = [f for f in os.listdir(INPUT_FOLDER)
              if os.path.isfile(os.path.join(INPUT_FOLDER, f)) and f not in pending]
    
    if not images:
        return jsonify({"error": "No images found in input folder"}), 404
    
    image_file = images[0]
    image_path = os.path.join(INPUT_FOLDER, image_file)
    
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
def add_to_stack():
    """
    Instead of immediately moving the image, add the action to the pending stack.
    Expected payload: {"image": "photo.jpg", "target_folder": "CategoryName"}
    """
    data = request.json
    if not isinstance(data, dict):
        return jsonify({"error": "Expected a JSON object with keys 'image' and 'target_folder'"}), 400
    
    image_file = data.get("image")
    target_folder = data.get("target_folder")
    if not image_file or not target_folder:
        return jsonify({"error": "Missing image or target_folder"}), 400
    
    source_path = os.path.join(INPUT_FOLDER, image_file)
    if not os.path.exists(source_path):
        return jsonify({"error": "Image not found in input folder"}), 404
    
    # Prevent duplicate pending actions for the same image
    if image_file in get_pending_images():
        return jsonify({"error": "Image already pending action"}), 400
    
    update_stack.append({
        "image": image_file,
        "target_folder": target_folder,
        "source_folder": INPUT_FOLDER
    })
    
    return jsonify({
        "message": f"Pending action added for image '{image_file}' to move to '{target_folder}'.",
        "stack": update_stack
    })

# ----------------- Endpoint: /undo -----------------
@app.route('/undo', methods=['POST'])
def undo_last_action():
    if not update_stack:
        return jsonify({"error": "No actions to undo"}), 400
    
    last_action = update_stack.pop()
    image_file = last_action["image"]
    image_path = os.path.join(INPUT_FOLDER, image_file)
    image_info = None
    if os.path.exists(image_path):
        with open(image_path, "rb") as img:
            image_data = base64.b64encode(img.read()).decode('utf-8')
        image_info = {
            "image_file": image_file,
            "image_data": image_data,
            "mime_type": "image/jpeg"
        }
    
    return jsonify({
        "message": f"Removed pending action for image '{image_file}' targeting '{last_action['target_folder']}'.",
        "stack": update_stack,
        "restored_image": image_info
    })

# ----------------- Endpoint: /stack -----------------
@app.route('/stack', methods=['GET'])
def get_stack():
    """
    Returns the list of pending actions.
    For each action, include the image preview (base64 encoded), the image name, and the target folder.
    """
    stack_with_previews = []
    for action in update_stack:
        image_file = action["image"]
        image_path = os.path.join(INPUT_FOLDER, image_file)
        preview_data = None
        mime_type = "image/jpeg"
        if os.path.exists(image_path):
            with open(image_path, "rb") as img:
                preview_data = base64.b64encode(img.read()).decode('utf-8')
        stack_with_previews.append({
            "image": image_file,
            "target_folder": action["target_folder"],
            "preview": preview_data,
            "mime_type": mime_type
        })
    return jsonify({"stack": stack_with_previews})

# ----------------- Endpoint: /commit -----------------
@app.route('/commit', methods=['POST'])
def commit_actions():
    """
    Process all pending actions in the stack.
    Moves each image from the input folder to its target folder.
    On success, the stack is cleared.
    """
    results = {"moved": [], "errors": []}
    
    while update_stack:
        action = update_stack.pop(0)  # process actions in order
        image_file = action["image"]
        target_folder = action["target_folder"]
        source_path = os.path.join(INPUT_FOLDER, image_file)
        destination_folder = os.path.join(WORKING_DIR, target_folder)
        destination_path = os.path.join(destination_folder, image_file)
        
        if not os.path.exists(source_path):
            results["errors"].append(f"Image '{image_file}' not found in input folder.")
            continue
        
        try:
            os.makedirs(destination_folder, exist_ok=True)
            shutil.move(source_path, destination_path)
            results["moved"].append(image_file)
        except Exception as e:
            results["errors"].append(f"Error moving '{image_file}': {str(e)}")
    
    return jsonify({
        "message": "Commit completed.",
        "results": results
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
