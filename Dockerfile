# ==============================================================
# HYDRA DISCORD MUSIC BOT - PRODUCTION DOCKERFILE
# ==============================================================
FROM node:20-bookworm-slim

# Install system dependencies (FFmpeg for audio processing and build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    make \
    g++ \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Create directory for persistent SQLite database
RUN mkdir -p /app/data && chown -R node:node /app

# Switch to non-root user for enhanced security
USER node

# Expose optional web dashboard port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production

# Start HYDRA
CMD ["npm", "start"]
