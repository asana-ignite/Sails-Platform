# Use the official Bun image
FROM oven/bun:latest

# Set the working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json bun.lockb* ./
RUN bun install

# Copy the rest of the application code
COPY . .

# Generate Prisma Client
RUN bun x prisma generate

# Expose the port Next.js runs on
EXPOSE 3000

# Default command for development
CMD ["bun", "run", "dev"]
