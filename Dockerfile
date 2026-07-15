# Use official Node.js image as the base
FROM node:20-slim AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application files
COPY . .

# Build the application (Vite build + Server esbuild bundling)
RUN npm run build

# Production stage
FROM node:20-slim AS runner

# Set environment to production and disable HMR
ENV NODE_ENV=production
ENV PORT=3000

# Set working directory
WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled assets and server bundles from the builder
COPY --from=builder /app/dist ./dist
# Copy DB helper and types since they are required dynamically or for server
COPY --from=builder /app/server-db.json ./server-db.json

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
