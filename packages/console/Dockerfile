# Use node image for development
FROM node:20-slim

WORKDIR /app

# Install dependencies first for better caching
COPY package.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the Vite dev port
EXPOSE 5173

# Run vite in host mode
CMD ["npm", "run", "dev"]
