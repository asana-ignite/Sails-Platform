# Use the official Bun image
FROM oven/bun:latest

WORKDIR /app

# Copy root package files
COPY package.json bun.lockb* ./

# Copy all workspace package files
COPY packages/core/package.json ./packages/core/
COPY packages/console/package.json ./packages/console/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN bun install

# Copy the rest of the application code
COPY . .

# Generate Prisma Client
RUN cd packages/core && bun x prisma generate

# Expose the port Next.js runs on
EXPOSE 3000

# Default command for development
CMD ["sh", "-c", "cd packages/core && bun run dev"]
