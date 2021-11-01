#!/bin/bash

#  This script maintains a git branch which mirrors main but in a form that
#  what will eventually be deployed to npm, allowing npm dependencies to use:
#
#      "graphql-executor": "git://github.com/yaacovCR/graphql-executor.git#npm"
#
#  Additionally it use use to push Deno build to `deno` branch.

BRANCH=$1
DIST_DIR=$2

# Exit immediately if any subcommand terminated
set -e

if [ -z "${BRANCH}" ]; then
 echo 'Must provide BRANCH as first argument!'
 exit 1;
fi;

if [ -z "${DIST_DIR}" ]; then
 echo 'Must provide DIST_DIR as second argument!'
 exit 1;
fi;

if [ -z "${GITHUB_TOKEN}" ]; then
 echo 'Must provide GITHUB_TOKEN as environment variable!'
 exit 1;
fi;

if [ -z "${GITHUB_ACTOR}" ]; then
 echo 'Must provide GITHUB_ACTOR as environment variable!'
fi;

if [ ! -d $DIST_DIR ]; then
 echo "Directory '${DIST_DIR}' does not  exist!"
 exit 1;
fi;

# Create empty directory
rm -rf $BRANCH
git clone -b $BRANCH -- "https://${GITHUB_ACTOR}:${GITHUB_TOKEN}@github.com/yaacovCR/graphql-executor.git" $BRANCH

# Remove existing files first
rm -rf $BRANCH/**/*
rm -rf $BRANCH/*

# Copy over necessary files
cp -r $DIST_DIR/* $BRANCH/

# Reference current commit
HEAD_REV=`git rev-parse HEAD`
echo $HEAD_REV

# Deploy
cd $BRANCH
git config user.name "GitHub Action Script"
git config user.email "please@open.issue"
git add -A .
if git diff --staged --quiet; then
  echo "Nothing to publish"
else
  git commit -a -m "Deploy $HEAD_REV to '$BRANCH' branch"
  git push
  echo "Pushed"
fi