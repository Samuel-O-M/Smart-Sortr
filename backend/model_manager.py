import os
import json
import io
import argparse
import hashlib
import math
import base64
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms
from torchvision.models import ResNet50_Weights
from PIL import Image
from dotenv import load_dotenv


ARTIFACTS_DIR = "./model_artifacts"
if not os.path.exists(ARTIFACTS_DIR):
    os.makedirs(ARTIFACTS_DIR)
MODEL_PATH = os.path.join(ARTIFACTS_DIR, "model.pth")
TRAINING_DATA_HASH_PATH = os.path.join(ARTIFACTS_DIR, "hashed_training_data.json")

load_dotenv()
WORKING_DIR = os.getenv("WORKING_DIR")
SAMPLE_DIR = os.getenv("SAMPLE_DIR")
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

NUM_EPOCHS = 5
BATCH_SIZE = 16
LEARNING_RATE = 0.005


test_transforms = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

# hardcode the training mode
mode = "mild"

if mode == "none":
    train_transforms = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
elif mode == "mild":
    train_transforms = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(degrees=10),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
elif mode == "heavy":
    train_transforms = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(degrees=45),
        transforms.ColorJitter(brightness=0.5, contrast=0.5, saturation=0.5),
        transforms.RandomResizedCrop(224, scale=(0.8, 1.0)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

def load_image(source):
    """
    Loads an image from a file path or bytes.
    If the image is in palette mode (P), first converts it to RGBA to handle transparency,
    then converts to RGB.
    """
    if isinstance(source, bytes):
        image = Image.open(io.BytesIO(source))
    else:
        image = Image.open(source)
    if image.mode == "P":
        image = image.convert("RGBA")
    return image.convert("RGB")

def process_image_input(data):
    """
    Processes the input image data, which can be:
      - a valid file path,
      - a base64-encoded string, or
      - raw bytes.
    Returns a PIL Image.
    """
    if isinstance(data, str):
        if os.path.exists(data):
            return load_image(data)
        else:
            try:
                image_bytes = base64.b64decode(data)
            except Exception as e:
                raise ValueError("Invalid image data: not a valid file path or base64 string") from e
            return load_image(image_bytes)
    elif isinstance(data, bytes):
        return load_image(data)
    else:
        raise ValueError("Unsupported type for image data")


def get_category_image_paths(working_dir):
    """
    Scan the working directory for category folders (excluding only 'input')
    and return a sorted list of category names and a list of (image_path, category) tuples.
    """
    allowed_extensions = {".jpg", ".jpeg", ".png"}
    categories = []
    data = []  # list of tuples: (image_path, category)
    for item in os.listdir(working_dir):
        item_path = os.path.join(working_dir, item)
        if os.path.isdir(item_path) and item.lower() != 'input':
            categories.append(item)
            for file in os.listdir(item_path):
                ext = os.path.splitext(file)[1].lower()
                if ext in allowed_extensions:
                    file_path = os.path.join(item_path, file)
                    data.append((file_path, item))
    return sorted(list(set(categories))), data


class CategoryDataset(Dataset):
    """
    Dataset for images organized in category folders.
    """
    def __init__(self, data, category_to_idx, transform):
        self.data = data
        self.category_to_idx = category_to_idx
        self.transform = transform

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        image_path, category = self.data[idx]
        image = load_image(image_path)
        if self.transform:
            image = self.transform(image)
        label = self.category_to_idx[category]
        return image, label
    
class UpdateDataset(torch.utils.data.Dataset):
    """
    Dataset for new images provided via user feedback.
    Assumes that the image path (the 'image_path' key) encodes the category via its parent folder name.
    """
    def __init__(self, image_infos, category_to_idx, transform):
        self.image_infos = image_infos
        self.category_to_idx = category_to_idx
        self.transform = transform

    def __len__(self):
        return len(self.image_infos)

    def __getitem__(self, idx):
        info = self.image_infos[idx]
        image_path = info["image_path"]
        category = os.path.basename(os.path.dirname(image_path))
        if category not in self.category_to_idx:
            raise ValueError(f"Category '{category}' not found in known categories.")
        image_data = info["image_data"]
        # process image_data (expected to be base64 string) using helper
        image = process_image_input(image_data)
        if self.transform:
            image = self.transform(image)
        label = self.category_to_idx[category]
        return image, label
    
def train_model(model, dataloader, criterion, optimizer, num_epochs):
    """
    Basic training loop.
    """
    model.train()
    for epoch in range(num_epochs):
        running_loss = 0.0
        for inputs, labels in dataloader:
            inputs = inputs.to(DEVICE)
            labels = labels.to(DEVICE)
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * inputs.size(0)
        epoch_loss = running_loss / len(dataloader.dataset)
        print(f"Epoch {epoch+1}/{num_epochs}, Loss: {epoch_loss:.4f}")
    return model


def compute_training_data_hash(working_dir, categories=None):
    """
    Scans the working directory for category folders (excluding 'input')
    and computes a hash for each image.
    Returns a dictionary with keys 'categories' and 'data' (mapping category to list of image info).
    """
    allowed_extensions = {".jpg", ".jpeg", ".png"}
    training_data = {}
    computed_categories = []
    for item in os.listdir(working_dir):
        item_path = os.path.join(working_dir, item)
        if os.path.isdir(item_path) and item.lower() != 'input':
            computed_categories.append(item)
            images_info = []
            for file in os.listdir(item_path):
                ext = os.path.splitext(file)[1].lower()
                if ext in allowed_extensions:
                    file_path = os.path.join(item_path, file)
                    with open(file_path, "rb") as f:
                        file_data = f.read()
                    file_hash = hashlib.sha256(file_data).hexdigest()
                    images_info.append({"filename": file, "hash": file_hash})
            images_info = sorted(images_info, key=lambda x: x["filename"])
            training_data[item] = images_info
    computed_categories = sorted(list(set(computed_categories)))
    if not categories: # in case this is called from create_working_model
        categories = computed_categories
    return {"categories": categories, "data": training_data}


def create_working_model(working_dir):
    """
    Create a working model:
      - Scan the working directory for category folders (ignoring 'input' and 'trash').
      - Compute a hash for each image and compare with the stored hashed_training_data.json.
      - If the current state matches, load the saved model.
      - Otherwise, fine-tune a pre-trained ResNet50 on these images and update the hash file.
    """
    # try to load existing model
    current_hash = compute_training_data_hash(working_dir)
    if os.path.exists(TRAINING_DATA_HASH_PATH):
        with open(TRAINING_DATA_HASH_PATH, "r") as f:
            stored_hash = json.load(f)
        if stored_hash == current_hash and os.path.exists(MODEL_PATH):
            print("Working directory unchanged, loading existing model.")
            weights = ResNet50_Weights.DEFAULT
            model = models.resnet50(weights=weights)
            for param in model.parameters():
                param.requires_grad = False
            num_classes = len(stored_hash.get("categories", [])) if stored_hash.get("categories", []) else 2
            in_features = model.fc.in_features
            model.fc = nn.Linear(in_features, num_classes)
            model = model.to(DEVICE)
            model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
            return model

    # otherwise, train a new model
    categories, data_paths = get_category_image_paths(working_dir)
    if not categories or not data_paths:
        print("No valid categories with images found in working directory.")
        print("Creating basic fine-tuned model using ImageNet pre-trained weights.")
    if categories:
        categories = sorted(categories)
        category_to_idx = {cat: idx for idx, cat in enumerate(categories)}
    else:
        category_to_idx = {}

    dataset = CategoryDataset(data_paths, category_to_idx, train_transforms)
    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)
    weights = ResNet50_Weights.DEFAULT
    model = models.resnet50(weights=weights)
    for param in model.parameters():
        param.requires_grad = False
    num_classes = len(category_to_idx) if category_to_idx else 2
    in_features = model.fc.in_features
    model.fc = nn.Linear(in_features, num_classes)
    model = model.to(DEVICE)
    if data_paths:
        print("Fine-tuning model on provided categories...")
        criterion = nn.CrossEntropyLoss()
        optimizer = optim.Adam(model.fc.parameters(), lr=LEARNING_RATE)
        model = train_model(model, dataloader, criterion, optimizer, NUM_EPOCHS)
    else:
        print("No training data available, using basic fine-tuned model.")

    torch.save(model.state_dict(), MODEL_PATH)
    with open(TRAINING_DATA_HASH_PATH, "w") as f:
        json.dump(current_hash, f)
    print(f"Model and training data hash saved in {ARTIFACTS_DIR}.")
    return model

def update_model(image_infos, new_categories):
    """
    Update the stored model with new user data.
    
    image_infos: a list of dictionaries with keys:
        - "image_path": the image path (including category folder name)
        - "image_data": base64-encoded image data
        - "mime_type": e.g. "image/jpeg"
        
    new_categories: a list of nonempty folder names.
      (old training categories are a subset of new categories)
    """
    import torch.nn as nn
    from torchvision.models import ResNet50_Weights
    from torch.utils.data import DataLoader

    if not os.path.exists(TRAINING_DATA_HASH_PATH):
        raise FileNotFoundError("Hashed training data file not found. Please run create_working_model first.")
    with open(TRAINING_DATA_HASH_PATH, "r") as f:
        data = json.load(f)
    old_categories = data.get("categories", [])
    if not old_categories:
        raise ValueError("No categories found in training data hash.")
    
    # build updated category list: keep old categories first, then append any new ones (sorted).
    new_categories = sorted(new_categories)
    additional_categories = [cat for cat in new_categories if cat not in old_categories]
    updated_categories = old_categories + additional_categories
    num_old = len(old_categories)
    num_total = len(updated_categories)
    
    # load the old model
    weights = ResNet50_Weights.DEFAULT
    model = models.resnet50(weights=weights)
    for param in model.parameters():
        param.requires_grad = False
    in_features = model.fc.in_features
    # create an fc layer for the old categories
    old_fc = nn.Linear(in_features, num_old)
    model.fc = old_fc
    model = model.to(DEVICE)
    model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
    # create new fc layer with output dim = total updated categories
    new_fc = nn.Linear(in_features, num_total)
    # copy weights for old categories
    with torch.no_grad():
        new_fc.weight.data[:num_old] = model.fc.weight.data
        new_fc.bias.data[:num_old] = model.fc.bias.data
    # replace the fc layer in the model
    model.fc = new_fc
    
    category_to_idx = {cat: idx for idx, cat in enumerate(updated_categories)}
    
    dataset = UpdateDataset(image_infos, category_to_idx, train_transforms)
    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)
    
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.fc.parameters(), lr=LEARNING_RATE)
    print("Updating model with new user data...")
    model = train_model(model, dataloader, criterion, optimizer, NUM_EPOCHS)
    
    # save the updated model and update the training data hash
    torch.save(model.state_dict(), MODEL_PATH)
    current_hash = compute_training_data_hash(WORKING_DIR, updated_categories)
    with open(TRAINING_DATA_HASH_PATH, "w") as f:
        json.dump(current_hash, f)
    print(f"Model updated and training data hash refreshed in {ARTIFACTS_DIR}.")
    return model

def predict(image_data):
    """
    Predict the category scores for a given image.
    Accepts image_data which can be a base64 string, raw bytes, or a valid file path.
    Loads the model from MODEL_PATH, processes the image, and returns a dictionary mapping
    each category to a score (0–100).
    """
    if not os.path.exists(TRAINING_DATA_HASH_PATH):
        raise FileNotFoundError("Hashed training data file not found. Please run create_working_model first.")
    
    with open(TRAINING_DATA_HASH_PATH, "r") as f:
        data = json.load(f)
    categories = data.get("categories", [])
    if not categories:
        raise ValueError("No categories found in training data hash.")
    
    # set up the saved model
    weights = ResNet50_Weights.DEFAULT
    model = models.resnet50(weights=weights)
    for param in model.parameters():
        param.requires_grad = False
    num_classes = len(categories)
    in_features = model.fc.in_features
    model.fc = nn.Linear(in_features, num_classes)
    model = model.to(DEVICE)
    model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
    model.eval()
    
    image = process_image_input(image_data)
    
    image_tensor = test_transforms(image).unsqueeze(0).to(DEVICE)
    
    with torch.no_grad():
        outputs = model(image_tensor)
        probs = torch.softmax(outputs, dim=1).cpu().numpy()[0]
    
    scores = {category: round(prob * 100, 2) for category, prob in zip(categories, probs)}
    return scores


if __name__ == "__main__":

    # test the model_manager functions with sample images

    import sys
    load_dotenv()
    num_images = 8

    sample_dir = os.getenv("SAMPLE_DIR")
    if sample_dir is None:
        print("WORKING_DIR environment variable is not set.")
        sys.exit(1)

    input_folder = os.path.join(sample_dir, "input")
    if not os.path.isdir(input_folder):
        print(f"Input folder '{input_folder}' not found in working directory.")
        sys.exit(1)

    allowed_extensions = {".jpg", ".jpeg", ".png"}
    input_files = [f for f in os.listdir(input_folder)
                   if os.path.splitext(f)[1].lower() in allowed_extensions]
    if not input_files:
        print("No valid images found in the input folder.")
        sys.exit(1)
    first_three_files = input_files[:min(num_images, len(input_files))]

    create_working_model(sample_dir)

    for file_name in first_three_files:
        image_path = os.path.join(input_folder, file_name)
        print(f"\nRunning prediction for image: {file_name}")
        scores = predict(image_path)
        print("Prediction scores:")
        for category, score in scores.items():
            print(f"  {category}: {score}%")
