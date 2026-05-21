FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    fonts-noto-cjk \
    ca-certificates \
    python3 \
    python3-pip \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PPTX_PYTHON=python3

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN pip3 install --break-system-packages --no-cache-dir -r skills/pptx/requirements.txt

RUN npm run build:web

EXPOSE 3000

CMD ["npm", "run", "start:web"]
