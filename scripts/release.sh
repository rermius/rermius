#!/bin/bash

# Release script - Automates the release process
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 0.0.1

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if version is provided
if [ -z "$1" ]; then
    print_error "Version is required!"
    echo ""
    echo "Usage: ./scripts/release.sh <version>"
    echo "Example: ./scripts/release.sh 0.0.1"
    exit 1
fi

VERSION="$1"
TAG="v${VERSION}"

# Remove 'v' prefix if user provided it
if [[ "$VERSION" == v* ]]; then
    VERSION="${VERSION#v}"
    TAG="v${VERSION}"
fi

# Validate version format (basic semver check)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$ ]]; then
    print_error "Invalid version format: $VERSION"
    echo "Expected format: X.Y.Z or X.Y.Z-prerelease or X.Y.Z+build"
    exit 1
fi

print_info "Starting release process for version: ${GREEN}$VERSION${NC} (tag: ${GREEN}$TAG${NC})"
echo ""

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not a git repository!"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
print_info "Current branch: $CURRENT_BRANCH"

# Check if there are uncommitted changes (before updating version)
if ! git diff-index --quiet HEAD --; then
    print_warning "You have uncommitted changes!"
    print_info "These will be included in the version bump commit."
    echo ""
fi

# Step 1: Update version files
print_info "Step 1: Updating version files..."
if node scripts/update-version.js "$VERSION"; then
    print_success "Version files updated"
else
    print_error "Failed to update version files"
    exit 1
fi
echo ""

# Wait a moment for file system to sync
sleep 1

# Step 2: Check if there are changes to commit
if git diff-index --quiet HEAD --; then
    print_warning "No changes to commit (version might already be $VERSION)"
else
    # Step 2: Add only necessary files and commit changes
    print_info "Step 2: Staging version files..."
    git add package.json 2>/dev/null || true
    git add src-tauri/Cargo.toml 2>/dev/null || true
    git add src-tauri/tauri.conf.json 2>/dev/null || true
    
    # Wait for Cargo to update Cargo.lock if needed
    sleep 1
    
    # Add Cargo.lock if it exists and has changes
    if [ -f "src-tauri/Cargo.lock" ]; then
        git add src-tauri/Cargo.lock 2>/dev/null || true
        print_info "Cargo.lock staged"
    fi
    
    # Wait a moment for git to process
    sleep 0.5
    
    print_info "Committing version changes..."
    if git commit -m "release: version to $VERSION"; then
        print_success "Changes committed"
    else
        print_error "Failed to commit changes"
        exit 1
    fi
    echo ""
fi

# Step 3: Check if tag already exists
if git rev-parse "$TAG" >/dev/null 2>&1; then
    print_warning "Tag $TAG already exists!"
    read -p "Delete and recreate? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Deleting existing tag..."
        git tag -d "$TAG" 2>/dev/null || true
        git push origin ":refs/tags/$TAG" 2>/dev/null || true
        print_success "Tag deleted"
    else
        print_info "Skipping tag creation"
        exit 0
    fi
fi

# Step 3: Create git tag
print_info "Step 3: Creating git tag $TAG..."
if git tag "$TAG"; then
    print_success "Tag $TAG created"
else
    print_error "Failed to create tag"
    exit 1
fi
echo ""

# Step 4: Push changes and tag
print_info "Step 4: Pushing changes and tag to remote..."
read -p "Push to remote? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Push current branch
    if git push origin "$CURRENT_BRANCH"; then
        print_success "Changes pushed to $CURRENT_BRANCH"
    else
        print_error "Failed to push changes"
        exit 1
    fi
    
    # Push tag
    if git push origin "$TAG"; then
        print_success "Tag $TAG pushed to remote"
    else
        print_error "Failed to push tag"
        exit 1
    fi
    echo ""
else
    print_warning "Skipping push. You can push manually later:"
    echo "  git push origin $CURRENT_BRANCH"
    echo "  git push origin $TAG"
    echo ""
fi

# Step 5: Instructions for GitHub Release
print_success "Release preparation complete!"
echo ""
print_info "Next steps:"
echo "  1. Go to: https://github.com/$(git config --get remote.origin.url | sed -E 's/.*github.com[:/](.*)\.git/\1/')/releases/new"
echo "  2. Select tag: $TAG"
echo "  3. Add release notes"
echo "  4. Click 'Publish release'"
echo ""
print_info "The workflows will automatically:"
echo "  • Build for Windows, macOS, and Linux"
echo "  • Upload artifacts to the release page"
echo ""

