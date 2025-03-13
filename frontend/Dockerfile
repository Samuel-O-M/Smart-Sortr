# Use an official Node v20 image based on Alpine Linux
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package files first to leverage Docker cache for dependency installs
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the app for production (Vite builds to the "dist" folder by default)
RUN npm run build

# Install a lightweight static file server to serve the production build
RUN npm install -g serve

# Expose the port that serve will use (3001 in this example)
EXPOSE 3001

# Start the container by serving the built app from the "dist" folder
CMD ["serve", "-s", "dist", "-l", "3001"]

# docker build -t smart-sortr-frontend .
# docker run -p 3001:3001 smart-sortr-frontend