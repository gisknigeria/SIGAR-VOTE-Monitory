FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev=false

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

CMD ["npm", "start"]
