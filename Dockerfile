FROM node:16

# Установка необходимых зависимостей
RUN apt-get update && apt-get install -y \
    libreoffice \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Создание директории для временных файлов
RUN mkdir -p uploads && chmod 777 uploads

EXPOSE 3000
CMD ["node", "server.js"] 