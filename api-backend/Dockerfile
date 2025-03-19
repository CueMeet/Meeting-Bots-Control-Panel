# Use the official Node.js 20 image as a base image
FROM public.ecr.aws/docker/library/node:20.11.0

# Set the working directory
WORKDIR /app

# Install aws-cli and jq using apt-get
RUN apt-get update && apt-get install -y \
    jq \
    make \
    libssl-dev \ 
    openssl \ 
    && rm -rf /var/lib/apt/lists/*

# Copy package.json and yarn.lock
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn cache clean && yarn install

# Copy the rest of the application code
COPY . .

# Build the NestJS application
RUN yarn build

# Expose the port on which the app runs
EXPOSE 4000

# Start the application
CMD ["yarn", "start:prod"]
