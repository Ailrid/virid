#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Error: Please specify the version number to be released! For example: ./publish.sh 0.3.0"
  exit 1
fi

NEW_VERSION=$1

echo "Change the version number uniformly to ${NEW_VERSION}..."
pnpm -r exec node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); pkg.version = process.argv[1]; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');" "${NEW_VERSION}"

echo "Cleaning old dist and building packages..."
pnpm clean
pnpm build

echo "Publishing to npm..."
pnpm -r publish --access public --no-git-checks

echo "Successfully published! All packages have been updated to ${NEW_VERSION}"