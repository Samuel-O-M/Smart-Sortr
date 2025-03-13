# Use the official Python 3.11.5 slim image as the base image
FROM python:3.11.5-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file and install dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code into the container
COPY . .

# Override the PORT environment variable to 5001 in Docker
ENV PORT=5001

# Expose the port that the Flask app uses
EXPOSE 5001

# Set the command to run the Flask app
CMD ["python", "app.py"]

# docker build -t smart-sortr-backend .
# docker run -p 5001:5001 smart-sortr-backend