FROM node:22

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

RUN useradd -m appuser && chown -R appuser /app
USER appuser

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]