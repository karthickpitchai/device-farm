FROM node:18-slim

# Install Android SDK and ADB
RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    openjdk-11-jdk \
    usbutils \
    && rm -rf /var/lib/apt/lists/*

# Install Android command line tools
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=${PATH}:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools

RUN mkdir -p ${ANDROID_HOME}/cmdline-tools && \
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip && \
    unzip commandlinetools-linux-9477386_latest.zip -d ${ANDROID_HOME}/cmdline-tools && \
    mv ${ANDROID_HOME}/cmdline-tools/cmdline-tools ${ANDROID_HOME}/cmdline-tools/latest && \
    rm commandlinetools-linux-9477386_latest.zip

# Accept licenses and install platform tools
RUN yes | sdkmanager --licenses && \
    sdkmanager "platform-tools"

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create necessary directories
RUN mkdir -p uploads/screenshots uploads/apks logs

# Expose port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]