import os
import json
import io
import argparse
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms
from torchvision.models import ResNet50_Weights
from PIL import Image
from dotenv import load_dotenv

# Create artifacts directory and update model and categories paths accordingly.
ARTIFACTS_DIR = "./model_artifacts"
if not os.path.exists(ARTIFACTS_DIR):
    os.makedirs(ARTIFACTS_DIR)
MODEL_PATH = os.path.join(ARTIFACTS_DIR, "model.pth")
CATEGORIES_PATH = os.path.join(ARTIFACTS_DIR, "categories.json")

WORKING_DIR = os.getenv("WORKING_DIR")
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

NUM_EPOCHS = 5
BATCH_SIZE = 16
LEARNING_RATE = 0.001

# Default test transforms (not affected by mode)
test_transforms = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

# Global variable for training transforms.
train_transforms = None

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

def get_category_image_paths(working_dir):
    """
    Scan the working directory for category folders (ignoring 'input' and 'trash')
    and return a sorted list of category names and a list of (image_path, category) tuples.
    """
    allowed_extensions = {".jpg", ".jpeg", ".png"}
    categories = []
    data = []  # List of tuples: (image_path, category)
    for item in os.listdir(working_dir):
        item_path = os.path.join(working_dir, item)
        if os.path.isdir(item_path) and item.lower() not in ['input', 'trash']:
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

class UpdateDataset(Dataset):
    """
    Dataset for new images provided via user feedback.
    Assumes that the image_file path encodes the category (its parent folder name).
    """
    def __init__(self, image_infos, category_to_idx, transform):
        self.image_infos = image_infos
        self.category_to_idx = category_to_idx
        self.transform = transform

    def __len__(self):
        return len(self.image_infos)

    def __getitem__(self, idx):
        info = self.image_infos[idx]
        image_file = info["image_file"]
        category = os.path.basename(os.path.dirname(image_file))
        if category not in self.category_to_idx:
            raise ValueError(f"Category '{category}' not found in known categories.")
        image_data = info["image_data"]
        image = load_image(image_data)
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

def create_working_model(working_dir):
    """
    Create a working model:
      - Scan the working directory for category folders (ignoring 'input' and 'trash').
      - If valid images exist, fine-tune a pre-trained ResNet50 on these images.
      - Otherwise, return a basic fine-tuned model.
      - Save the model (MODEL_PATH) and the list of categories (CATEGORIES_PATH).
    """
    categories, data = get_category_image_paths(working_dir)
    if not categories or not data:
        print("No valid categories with images found in working directory.")
        print("Creating basic fine-tuned model using ImageNet pre-trained weights.")

    if categories:
        categories = sorted(categories)
        category_to_idx = {cat: idx for idx, cat in enumerate(categories)}
    else:
        category_to_idx = {}

    # Load pre-trained ResNet50 using the new 'weights' parameter and freeze its parameters
    weights = ResNet50_Weights.DEFAULT
    model = models.resnet50(weights=weights)
    for param in model.parameters():
        param.requires_grad = False

    num_classes = len(category_to_idx) if category_to_idx else 2
    in_features = model.fc.in_features
    model.fc = nn.Linear(in_features, num_classes)
    model = model.to(DEVICE)

    if data:
        dataset = CategoryDataset(data, category_to_idx, train_transforms)
        dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)
        criterion = nn.CrossEntropyLoss()
        optimizer = optim.Adam(model.fc.parameters(), lr=LEARNING_RATE)
        print("Fine-tuning model on provided categories...")
        model = train_model(model, dataloader, criterion, optimizer, NUM_EPOCHS)
    else:
        print("No training data available, using basic fine-tuned model.")

    torch.save(model.state_dict(), MODEL_PATH)
    with open(CATEGORIES_PATH, "w") as f:
        json.dump({"categories": categories}, f)
    print(f"Model and category mapping saved in {ARTIFACTS_DIR}.")
    return model

def update_model(image_infos):
    """
    Update the stored model with new user data.
    image_infos: a list of dictionaries with keys:
        - "image_file": path string (assumed to contain the category folder)
        - "image_data": raw bytes of the image
        - "mime_type": e.g. "image/jpeg"
    """
    if not os.path.exists(CATEGORIES_PATH):
        raise FileNotFoundError("Categories mapping file not found. Please run create_working_model first.")
    with open(CATEGORIES_PATH, "r") as f:
        data = json.load(f)
    categories = data.get("categories", [])
    if not categories:
        raise ValueError("No categories found in mapping.")
    category_to_idx = {cat: idx for idx, cat in enumerate(categories)}

    dataset = UpdateDataset(image_infos, category_to_idx, train_transforms)
    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)

    weights = ResNet50_Weights.DEFAULT
    model = models.resnet50(weights=weights)
    for param in model.parameters():
        param.requires_grad = False
    num_classes = len(categories)
    in_features = model.fc.in_features
    model.fc = nn.Linear(in_features, num_classes)
    model = model.to(DEVICE)
    model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.fc.parameters(), lr=LEARNING_RATE)
    print("Updating model with new user data...")
    model = train_model(model, dataloader, criterion, optimizer, NUM_EPOCHS)

    torch.save(model.state_dict(), MODEL_PATH)
    print(f"Model updated and saved in {ARTIFACTS_DIR}.")
    return model

def predict(image_file):
    """
    Predict the category scores for a given image file.
    Returns a dictionary mapping each category to a score (0–100).
    """
    if not os.path.exists(CATEGORIES_PATH):
        raise FileNotFoundError("Categories mapping file not found. Please run create_working_model first.")
    with open(CATEGORIES_PATH, "r") as f:
        data = json.load(f)
    categories = data.get("categories", [])
    if not categories:
        raise ValueError("No categories found in mapping.")

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

    image = load_image(image_file)
    image_tensor = test_transforms(image).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        outputs = model(image_tensor)
        probs = torch.softmax(outputs, dim=1).cpu().numpy()[0]

    scores = {cat: float(round(prob * 100, 2)) for cat, prob in zip(categories, probs)}
    return scores

if __name__ == "__main__":
    import sys
    load_dotenv()

    working_dir = os.getenv("WORKING_DIR")
    if working_dir is None:
        print("WORKING_DIR environment variable is not set.")
        sys.exit(1)

    # Locate the input folder inside the working directory.
    input_folder = os.path.join(working_dir, "input")
    if not os.path.isdir(input_folder):
        print(f"Input folder '{input_folder}' not found in working directory.")
        sys.exit(1)

    # Get the first three image files from the input folder.
    allowed_extensions = {".jpg", ".jpeg", ".png"}
    input_files = [f for f in os.listdir(input_folder)
                   if os.path.splitext(f)[1].lower() in allowed_extensions]
    if not input_files:
        print("No valid images found in the input folder.")
        sys.exit(1)
    first_three_files = input_files[:3]

    # Loop over the three modes.
    for current_mode in ["none", "mild", "heavy"]:
        # Set the training transforms based on the current mode.
        if current_mode == "none":
            train_transforms = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
            ])
        elif current_mode == "mild":
            train_transforms = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.RandomHorizontalFlip(),
                transforms.RandomRotation(degrees=10),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
            ])
        elif current_mode == "heavy":
            train_transforms = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.RandomHorizontalFlip(),
                transforms.RandomRotation(degrees=45),
                transforms.ColorJitter(brightness=0.5, contrast=0.5, saturation=0.5),
                transforms.RandomResizedCrop(224, scale=(0.8, 1.0)),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
            ])

        print("\n" + "=" * 50)
        print(f"Testing mode: {current_mode.upper()}")
        print("=" * 50)

        # Create the working model using the current training transforms.
        create_working_model(working_dir)

        # Run prediction for each of the first three images.
        for file_name in first_three_files:
            image_path = os.path.join(input_folder, file_name)
            print(f"\nRunning prediction for image: {file_name}")
            scores = predict(image_path)
            print("Prediction scores:")
            for category, score in scores.items():
                print(f"  {category}: {score}%")
