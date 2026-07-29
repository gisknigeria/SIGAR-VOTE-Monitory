FROM node:22-alpine
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app
COPY package.json ./
RUN npm install --omit=dev=false

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000
USER app

CMD ["npm", "start"]
