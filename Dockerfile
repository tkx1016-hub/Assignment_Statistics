# ==========================================
# STAGE 1: Build & Compile the Application
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency configuration files
COPY package*.json ./

# Install all development and runtime dependencies
RUN npm ci

# Copy all source files
COPY . .

# Run linter and compile both Client (Vite) and Server (esbuild CJS bundle)
RUN npm run lint
RUN npm run build

# ==========================================
# STAGE 2: Lightweight Production Runtime Image
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment flags
ENV NODE_ENV=production
ENV PORT=3000

# Copy package config files
COPY package*.json ./

# Install only production dependencies to save container size
RUN npm ci --omit=dev

# Copy compiled folders from build stage (client files + server bundle)
COPY --from=builder /app/dist ./dist

# The standard container routes traffic under port 3000
EXPOSE 3000

# Run compiled CJS Express app
CMD ["npm", "start"]
