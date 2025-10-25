# 📦 VSCode Extension Publishing Guide

## 🎯 Publishing Goal

Publish the `node-dependencies` extension to the Visual Studio Code Marketplace

## 📋 Pre-Publishing Checklist

### 1. Account Setup

-   [ ] Create Visual Studio Marketplace publisher account
-   [ ] Obtain Personal Access Token (PAT)
-   [ ] Install VSCE (Visual Studio Code Extension) tool

### 2. Code Preparation

-   [ ] Ensure all features work correctly
-   [ ] Complete code review and testing
-   [ ] Update version number
-   [ ] Prepare release notes

## 🚀 Detailed Publishing Steps

### Step 1: Install Required Tools

```bash
# Install VSCE tool
npm install -g @vscode/vsce

# Verify installation
vsce --version
```

### Step 2: Create Publisher Account

1. Visit [Visual Studio Marketplace](https://marketplace.visualstudio.com/)
2. Click "Publish extensions"
3. Sign in with Microsoft account
4. Create publisher account, choose a unique publisher ID (e.g., `your-publisher-id`)

### Step 3: Obtain Personal Access Token

1. Visit [Azure DevOps](https://dev.azure.com/)
2. Go to User Settings → Personal Access Tokens
3. Create new Token with permissions:
    - **Marketplace**: Manage
4. Copy and save the Token

### Step 4: Configure Publishing Environment

```bash
# Login to publisher account
vsce login your-publisher-id

# Enter Personal Access Token
```

### Step 5: Prepare Publishing Files

#### 5.1 Update package.json Configuration

Ensure the following fields are correctly configured:

```json
{
    "name": "node-dependencies",
    "displayName": "Node Dependencies",
    "description": "Advanced VS Code extension for npm package management...",
    "version": "1.0.0",
    "publisher": "your-publisher-id",
    "license": "Apache-2.0",
    "repository": {
        "type": "git",
        "url": "https://github.com/your-username/your-repo"
    },
    "homepage": "https://github.com/your-username/your-repo",
    "bugs": {
        "url": "https://github.com/your-username/your-repo/issues"
    },
    "keywords": ["npm", "dependencies", "package-manager", "visualization", "monorepo"],
    "categories": ["Package Managers", "Visualization", "Other"],
    "engines": {
        "vscode": "^1.99.0"
    }
}
```

#### 5.2 Create Required Files

**Create LICENSE file** (`LICENSE`):

```
Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

Copyright 2024 Your Name

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

**Create CHANGELOG.md**:

```markdown
# Change Log

All notable changes to the "Node Dependencies" extension will be documented in this file.

## [1.0.0] - 2024-01-XX

### Added

-   Graphical dependency visualization with hierarchical tree structure
-   Icon-based package type distinction (dependencies, devDependencies, peerDependencies)
-   Interactive hover information for package details
-   Visual package management (add, remove, open operations)
-   Monorepo support with automatic workspace detection
-   Context-aware dependency graphs
-   Automatic TypeScript declaration file updates
```

### Step 6: Build and Test

```bash
# Navigate to project directory
cd /path/to/your/project/apps/node-dependency

# Install dependencies
pnpm install

# Compile TypeScript
pnpm run compile

# Run linting
pnpm run lint

# Package extension (test)
pnpm run package
```

### Step 7: Publish to Marketplace

#### 7.1 Initial Release

```bash
# Publish extension
vsce publish

# Or specify version
vsce publish 1.0.0
```

#### 7.2 Subsequent Updates

```bash
# Update patch version (1.0.0 -> 1.0.1)
pnpm run version:patch

# Update minor version (1.0.0 -> 1.1.0)
pnpm run version:minor

# Update major version (1.0.0 -> 2.0.0)
pnpm run version:major
```

### Step 8: Verify Release

> Verifying the extension will take some time
> After verification

1. Visit [Visual Studio Marketplace](https://marketplace.visualstudio.com/)
2. Search for "Node Dependencies"
3. Verify extension information displays correctly
4. Test installation and basic functionality

## 🔧 Post-Publishing Maintenance

### Version Management Strategy

```bash
# Bug fixes
pnpm run version:patch

# New features
pnpm run version:minor

# Breaking changes
pnpm run version:major
```

### Monitoring and Maintenance

-   [ ] Monitor user feedback and ratings
-   [ ] Respond to user issues promptly
-   [ ] Regularly update dependencies
-   [ ] Fix reported issues

## 📊 Publishing Checklist

### Pre-Publishing Checks

-   [ ] All features tested and working
-   [ ] README.md information complete
-   [ ] package.json configuration correct
-   [ ] LICENSE file exists
-   [ ] CHANGELOG.md updated
-   [ ] No linting errors in code
-   [ ] Extension packages successfully

### Post-Publishing Verification

-   [ ] Extension visible in Marketplace
-   [ ] Installation links work correctly
-   [ ] Extension loads properly in VS Code
-   [ ] All functionality works correctly
-   [ ] Documentation links are correct

## 🚨 Common Issues and Solutions

### Publishing Failures

```bash
# Check publisher permissions
vsce ls-publishers

# Re-login
vsce logout
vsce login your-publisher-id
```

### Version Conflicts

```bash
# Check current version
vsce show node-dependencies

# Force update version
vsce publish --no-yarn
```

### Dependency Issues

```bash
# Clean and reinstall
rm -rf node_modules
pnpm install
pnpm run compile
```

## 📈 Post-Publishing Promotion

1. **GitHub Release**: Create a Release in your GitHub repository
2. **Social Media**: Share in relevant technical communities
3. **Documentation**: Improve usage documentation and examples
4. **Feedback Collection**: Establish user feedback channels

This detailed publishing guide covers the complete process from preparation to publishing, ensuring your extension can be successfully published to the Visual Studio Marketplace.

## 🎯 Key Points:

1. **Pre-publishing Preparation**: Account setup, tool installation, code review
2. **Detailed Steps**: Complete workflow from VSCE installation to final publishing
3. **Required Files**: LICENSE, CHANGELOG.md and other essential files
4. **Version Management**: Publishing strategy for patch, minor, and major versions
5. **Post-Publishing Maintenance**: Monitoring, updates, and user feedback handling

## 🚀 Commands Ready to Execute:

```bash
# 1. Install publishing tool
npm install -g @vscode/vsce

# 2. Navigate to project directory
cd /path/to/your/project/apps/node-dependency

# 3. Compile and test
pnpm install
pnpm run compile
pnpm run lint

# 4. Login to publisher account
vsce login your-publisher-id

# 5. Publish extension
vsce publish
```

## 📋 Tasks to Complete Before Publishing:

1. **Create LICENSE file** (Apache 2.0)
2. **Create CHANGELOG.md file**
3. **Ensure all features are tested and working**
4. **Create publisher account on Visual Studio Marketplace**

This guide provides a complete publishing workflow with detailed explanations from preparation to post-publishing maintenance. You can follow this guide step by step to ensure your extension is successfully published to the Marketplace.
