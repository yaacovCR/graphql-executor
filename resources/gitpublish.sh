#!/bin/sh

# Exit immediately if any subcommand terminated
trap "exit 1" ERR

# This script maintains a git branch which mirrors master but in a form that
# what will eventually be deployed to npm, allowing npm dependencies to use:
#
#     "graphql": "git://github.com/graphql/graphql-js.git#npm"
#

if [ ! -d "./dist" ]; then
 echo 'Directory `dist` does not  exist, please run `npm run build`!'
 exit 1;
fi;

# Create empty npm directory
rm -rf npm
git clone -b npm "https://${GH_TOKEN}@github.com/graphql/graphql-js.git" npm

# Remove existing files first
rm -rf npm/**/*
rm -rf npm/*

# Copy over necessary files
cp -r dist/* npm/

# Reference current commit
HEADREV=`git rev-parse HEAD`
echo $HEADREV

# Deploy
cd npm
git config user.name "GitHub Action Script"
git config user.email "please@open.issue"
git add -A .
if git diff --staged --quiet; then
  echo "Nothing to publish"
else
  git commit -a -m "Deploy $HEADREV to NPM branch"
  git push > /dev/null 2>&1
  echo "Pushed"
fi