
# 1. Use an existing Node.js runtime image
FROM node:24-alpine

# 2. Create the working directory inside the image
WORKDIR /app

# 3. Copy dependency declarations
COPY package*.json ./

# 4. Install only production dependencies
RUN npm ci --omit=dev

# 5. Copy application source code
COPY app.js server.js db.js test-db.js ./

# 6. Document the application port
EXPOSE 3000

# 7. Start the application
CMD ["npm", "start"]
