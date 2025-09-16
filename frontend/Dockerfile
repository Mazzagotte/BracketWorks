
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN npm ci || yarn install || pnpm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
