# Use the official Bun image
FROM oven/bun:latest

WORKDIR /app

# Copy root package files
COPY package.json ./
COPY bun.lock* ./

# Copy all workspace package files
COPY packages/core/package.json ./packages/core/
COPY packages/console/package.json ./packages/console/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN bun install

# Copy the rest of the application code
COPY . .

# Expose the Vite dev port
EXPOSE 5173

# Run vite in host mode
CMD ["sh", "-c", "cd packages/console && bun run dev -- --host"]
