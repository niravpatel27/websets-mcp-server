FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --ignore-scripts

COPY . .

# Build both transports
RUN npm run build

EXPOSE 8080

ENV PORT=8080

# Install express for HTTP transport
RUN npm install express

# Copy the HTTP server wrapper
COPY docker-server.mjs ./docker-server.mjs

CMD ["node", "docker-server.mjs"]