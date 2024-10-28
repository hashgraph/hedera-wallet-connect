#! /bin/bash

# This script is just for testing to ensure the docker image is working.

# Build the serve image
docker build --target serve -t docs-serve .

# Run the serve container with proper signal handling
docker run -p 3001:3000 --init --rm docs-serve