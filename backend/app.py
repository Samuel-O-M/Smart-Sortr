import os
import random
import shutil
import base64
import json
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import platform
import threading
from functools import wraps
import time
import uuid

current_user = None
HEARTBEAT_TIMEOUT = 30

def require_connection(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        global current_user
        token = request.headers.get("X-User-Token")
        if current_user is not None and (time.time() - current_user["last_seen"]) > HEARTBEAT_TIMEOUT:
            current_user = None
        if current_user is None:
            if token:
                return jsonify({"error": "User token expired. Please call /heartbeat to register."}), 403
            else:
                return jsonify({"error": "No user token provided. Please call /heartbeat to register."}), 403
        else:
            if token != current_user["token"]:
                return jsonify({"error": "Another user is currently connected. Try again later."}), 429
            else:
                current_user["last_seen"] = time.time()
                return f(*args, **kwargs)
    return wrapper


# custom functions
from model_manager import create_working_model, predict

app = Flask(__name__)
CORS(app)

# load folder paths
load_dotenv()


WORKING_DIR = os.getenv("WORKING_DIR")
SAMPLE_DIR = os.getenv("SAMPLE_DIR")

INPUT_FOLDER = os.path.join(WORKING_DIR, "input")
os.makedirs(INPUT_FOLDER, exist_ok=True)

TRASH_FOLDER = os.path.join(WORKING_DIR, "trash")
os.makedirs(TRASH_FOLDER, exist_ok=True)


# =================== Global Process Lock ===================

# process_lock = threading.Lock()

# def single_process(func):
#     @wraps(func)
#     def wrapper(*args, **kwargs):
#         if process_lock.locked():
#             return jsonify({"message": "Another process is currently running. Please wait."}), 429
#         with process_lock:
#             return func(*args, **kwargs)
#     return wrapper


# =================== Global Variables ===================

# this could be optimized --- from collections import OrderedDict

update_stack = [] # stack of update actions (storing image names)

update_stack_dict = {} # dictionary with keys
    #     "image_name"
    # and value
    #     "target_folder": target_folder
    # predictions are not stored, they are recalculated

folders = {} # dictionary with keys
    #     "folder_name"
    # and values
    #     "is_empty": True/False
    #     "has_pending": True/False
    # thus => can_delete = is_empty and has_pending == 0


# =================== Helper Functions ===================

def get_image_data(image_path):
    with open(image_path, "rb") as img:
        image_data = base64.b64encode(img.read()).decode('utf-8')
    return image_data

def load_sample_data():
    """
    Clears the contents of the data folder (WORKING_DIR/data) and then
    copies all files and subdirectories from the sample data folder (SAMPLE_DIR)
    into it, making an exact copy.
    """
        
    if not os.path.exists(SAMPLE_DIR):
        print("No sample data folder found at:", SAMPLE_DIR)
        return

    if os.path.exists(WORKING_DIR):
        try:
            shutil.rmtree(WORKING_DIR)
        except Exception as e:
            print(f"Error clearing {WORKING_DIR}: {e}")
            return

    os.makedirs(WORKING_DIR, exist_ok=True)
    
    # Copy all contents from SAMPLE_DIR to data_dir.
    for item in os.listdir(SAMPLE_DIR):
        source_item = os.path.join(SAMPLE_DIR, item)
        dest_item = os.path.join(WORKING_DIR, item)
        try:
            if os.path.isdir(source_item):
                shutil.copytree(source_item, dest_item)
            else:
                shutil.copy2(source_item, dest_item)
        except Exception as e:
            print(f"Error copying {source_item} to {dest_item}: {e}")

@app.route('/heartbeat', methods=['GET'])
def heartbeat():
    global current_user
    token = request.headers.get("X-User-Token")
    if current_user is not None and (time.time() - current_user["last_seen"]) > HEARTBEAT_TIMEOUT:
        current_user = None
    if current_user is None:
        if not token:
            token = str(uuid.uuid4())
        current_user = {"token": token, "last_seen": time.time()}
        return jsonify({"message": "Heartbeat registered", "token": token})
    else:
        if token != current_user["token"]:
            return jsonify({"error": "Another user is currently connected. Try again later."}), 429
        else:
            current_user["last_seen"] = time.time()
            return jsonify({"message": "Heartbeat updated", "token": token})

@app.route('/')
def hello_world():
    return 'Hello, World!'

@app.route('/initialize', methods=['POST'])
@require_connection
# @single_process
def api_initialize_model_endpoint():

    # clear global variables
    global update_stack
    global update_stack_dict
    global folders

    update_stack = []
    update_stack_dict = {}
    folders = {}

    try:
        print("Initializing model...")

        load_sample_data()

        create_working_model(WORKING_DIR)

        # process folders in the working directory
        for f in os.listdir(WORKING_DIR):
            folder_path = os.path.join(WORKING_DIR, f)
            if os.path.isdir(folder_path) and f.lower() not in ['input', 'trash']:
                is_empty = (len(os.listdir(folder_path)) == 0)
                folders[f] = {
                    "is_empty": is_empty,
                    "has_pending": 0
                }

        # also add "input" and "trash" folders
        folders["input"] = {
            "is_empty": (len(os.listdir(INPUT_FOLDER)) == 0),
            "has_pending": 0
        }
        folders["trash"] = {
            "is_empty": (len(os.listdir(TRASH_FOLDER)) == 0),
            "has_pending": 0
        }

        return jsonify({"message": "Model initialization complete.", "folders": folders})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =================== API Endpoints ===================

@app.route('/image_data', methods=['POST'])
@require_connection
# @single_process
def api_get_image_data():
    """
    Returns the image data for a given image name.
    """
    data = request.json
    image_name = data.get("image_name")
    
    if not image_name:
        return jsonify({"error": "No image file specified"}), 400
    
    image_path = os.path.join(INPUT_FOLDER, image_name)
    if not os.path.exists(image_path):
        return jsonify({"error": "Image not found in input folder"}), 404
    
    image_data = get_image_data(image_path)
    return jsonify({
        "image_name": image_name,
        "image_data": image_data,
        "mime_type": "image/jpeg"
    })

@app.route('/stack', methods=['GET'])
@require_connection
# @single_process
def api_get_stack():
    """
    Returns the current pending actions stored in update_stack.
    """
    return jsonify({"stack": update_stack})

@app.route('/update', methods=['POST'])
@require_connection
# @single_process
def api_add_to_stack():
    """
    Adds a pending action to update_stack.
    Expected payload: { "image_name": <image_name>, "target_folder": <folder_name> }
    The entry added will be { "image_name": <image_name>, "target_folder": <folder_name> }.
    After adding, refresh the folders (to update has_pending).
    """
    global update_stack
    global update_stack_dict
    global folders

    data = request.json
    if not isinstance(data, dict):
        return jsonify({"error": "Expected a JSON object with keys 'image' and 'target_folder'"}), 400
    
    image_name = data.get("image_name")
    target_folder = data.get("target_folder")

    if not target_folder:
        return jsonify({"error": "Target folder not specified"}), 400
    
    source_path = os.path.join(INPUT_FOLDER, image_name)
    if not os.path.exists(source_path):
        return jsonify({"error": "Image not found in input folder"}), 404
    
    if image_name in update_stack:
        return jsonify({"error": "Image already pending action"}), 400

    update_stack.append(image_name)
    update_stack_dict[image_name] = target_folder
    folders[target_folder]["has_pending"] += 1
    return jsonify({
        "message": f"Pending action added for image '{image_name}' to move to '{target_folder}'.",
        "stack": update_stack
    })

@app.route('/undo', methods=['POST'])
@require_connection
# @single_process
def api_pop_from_stack():
    """
    Removes the last pending action from update_stack.
    Returns the restored image (if available) and the updated stack.
    Also refreshes folders.
    """
    global update_stack
    global update_stack_dict
    global folders

    if not update_stack:
        return jsonify({"error": "No actions to undo"}), 400
    
    image_name = update_stack.pop()
    target_folder = update_stack_dict[image_name]
    del update_stack_dict[image_name]

    folders[target_folder]["has_pending"] -= 1
    
    return jsonify({
        "message": f"Removed pending action for image '{image_name}' targeting '{target_folder}'.",
        "stack": update_stack}
    )

@app.route('/folders', methods=['GET'])
@require_connection
# @single_process
def api_get_folders():
    """
    Returns the list of folders in the working directory.    
    """
    global folders
    return jsonify({"folders": folders})

@app.route('/folder', methods=['POST'])
@require_connection
# @single_process
def api_manage_folder():
    """
    Create or delete a folder.
    Expected payload: { "operation": "create"/"delete", "folder_name": <name> }
    After performing the operation, refresh the folders global variable.
    """
    data = request.json
    operation = data.get("operation")
    folder_name = data.get("folder_name")
    
    if not operation or not folder_name:
        return jsonify({"error": "Operation and folder name required"}), 400
    
    # prevent deletion of the 'input' or 'trash' folders
    if operation == "delete" and (folder_name.lower() == "input" or folder_name.lower() == "trash"):
        return jsonify({"error": "Cannot delete the input or trash folder"}), 400

    folder_path = os.path.join(WORKING_DIR, folder_name)
    
    try:
        global folders
        message = ""
        if operation == "create":
            if folder_name in folders:
                return jsonify({"error": f"Folder '{folder_name}' already exists."}), 400
            os.makedirs(folder_path, exist_ok=True)
            folders[folder_name] = {"is_empty": True, "has_pending": 0}
            message = f"Folder '{folder_name}' created."
        elif operation == "delete":
            if folder_name not in folders:
                return jsonify({"error": f"Folder '{folder_name}' does not exist."}), 400
            if not folders[folder_name]["is_empty"]:
                return jsonify({"error": f"Folder '{folder_name}' is not empty and thus cannot be deleted."}), 400
            shutil.rmtree(folder_path)
            del folders[folder_name]
            message = f"Folder '{folder_name}' deleted."
        else:
            return jsonify({"error": "Invalid operation"}), 400
        
        return jsonify({"message": message})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/current_image', methods=['GET'])
@require_connection
# @single_process
def api_get_current_image():
    """
    Returns the first image from the input folder that is not pending.
    """
    global update_stack
    global folders

    pending_set = set(update_stack)  # for O(1) tests

    found = None
    with os.scandir(INPUT_FOLDER) as entries:
        for entry in entries:
            if entry.is_file() and entry.name not in pending_set:
                found = entry.name
                break

    if not found:
        folders["input"]["is_empty"] = True
        return jsonify({"error": "No images found in input folder"}), 404

    image_name = found
    image_path = os.path.join(INPUT_FOLDER, image_name)
    image_data = get_image_data(image_path)

    return jsonify({
        "image_name": image_name,
        "image_data": image_data,
        "mime_type": "image/jpeg"
    })

@app.route('/classify', methods=['POST'])
@require_connection
# @single_process
def api_classify_image():
    """
    Returns classification predictions for a given image.
    Expected payload: { "image_name": <filename> }
    Returns a dictionary mapping each category (excluding 'input' and 'trash') 
    to its score (0–100) if available or "N/A" if not.
    """
    global folders

    data = request.json
    image_name = data.get("image_name")
    
    if not image_name:
        return jsonify({"error": "No image file specified"}), 400

    image_path = os.path.join(INPUT_FOLDER, image_name)
    if not os.path.exists(image_path):
        return jsonify({"error": "Image not found in input folder"}), 404
    
    image_data = get_image_data(image_path)
    
    try:
        predictions = predict(image_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
    # build full dictionary with the score or "N/A"
    full_predictions = {}
    for category in folders:
        if category.lower() == "input":
            continue
        if category in predictions:
            full_predictions[category] = predictions[category]
        else:
            full_predictions[category] = "N/A"
    
    return jsonify({
        "predictions": full_predictions
    })

@app.route('/commit', methods=['POST'])
@require_connection
# # @single_process
def api_commit_actions():
    """
    Processes all pending actions:
      - Moves each image from the input folder to its target folder.
      - Updates the model using the newly committed images.
      - Clears update_stack.
      - Refreshes folders.
    """
    global update_stack
    global update_stack_dict
    global folders

    results = {"moved": [], "errors": []}
    changes_made = False
    
    while update_stack:

        image_name = update_stack.pop()
        image_path = os.path.join(INPUT_FOLDER, image_name)
        target_folder = update_stack_dict[image_name]
        target_path = os.path.join(WORKING_DIR, target_folder, image_name)

        del update_stack_dict[image_name]
        folders[target_folder]["has_pending"] -= 1

        
        if not os.path.exists(image_path):
            results["errors"].append(f"Image '{image_name}' not found in input folder.")
            continue
        
        try:
            os.makedirs(os.path.join(WORKING_DIR, target_folder), exist_ok=True)
            shutil.move(image_path, target_path)
            results["moved"].append(image_name)

            folders[target_folder]["is_empty"] = False

            changes_made = True

        except Exception as e:
            results["errors"].append(f"Error moving '{image_name}' to '{target_folder}': {str(e)}")
    
    # update with the newly committed images
    if changes_made:
        try:
            create_working_model(WORKING_DIR)
        except Exception as e:
            results["errors"].append(f"Error retraining model: {str(e)}")
    
    if results["errors"]:
        return jsonify({"error": "Errors occurred during commit.", "results": results}), 400
    else:
        return jsonify({"message": "Commit completed successfully.", "results": results}), 200


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
