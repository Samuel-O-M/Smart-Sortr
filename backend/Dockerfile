# Use the official Python 3.11.5 slim image as the base image
FROM python:3.11.5-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file and install dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=5001

# Expose the port that the Flask app uses
EXPOSE 5001

# Set the command to run the Flask app
CMD ["python", "app.py"]

# docker build -t smart-sortr-backend .
# docker run -p 5001:5001 -v "$(pwd)/data:/app/data" smart-sortr-backend