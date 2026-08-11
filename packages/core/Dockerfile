# Use the official Bun image
FROM oven/bun:latest

WORKDIR /app

# Copy root package files
COPY package.json bun.lock* bun.lockb* ./

# Copy all workspace package files
COPY packages/core/package.json ./packages/core/
COPY packages/console/package.json ./packages/console/
COPY packages/shared/package.json ./packages/shared/
COPY packages/plugin-sdk/package.json ./packages/plugin-sdk/
COPY packages/plugin-script/package.json ./packages/plugin-script/
COPY packages/plugin-approval/package.json ./packages/plugin-approval/
COPY packages/plugin-expression/package.json ./packages/plugin-expression/
COPY packages/plugin-notification/package.json ./packages/plugin-notification/
COPY packages/plugin-record-event/package.json ./packages/plugin-record-event/

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
