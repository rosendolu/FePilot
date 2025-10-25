# 🚀 FePilot - Development Efficiency Toolkit

> A comprehensive VS Code extension toolkit designed to boost development productivity

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue.svg)](https://marketplace.visualstudio.com/items?itemName=rosendolu.node-deps-tree)
[![GitHub](https://img.shields.io/badge/GitHub-FePilot-green.svg)](https://github.com/rosendolu/FePilot)

## 🎯 Project Mission

**Development Efficiency** - Through intelligent tools and visual interfaces, enable developers to focus on core business logic, reduce repetitive work, and enhance development efficiency and code quality.

## 📦 Project Structure

FePilot is a multi-application project containing the following three core tools:

### 1. 🌳 Node Deps Tree - Dependency Management Visualization

**VS Code Extension** | [📦 Install](https://marketplace.visualstudio.com/items?itemName=rosendolu.node-deps-tree)

> Advanced VS Code extension providing graphical dependency management, hover information, visual package operations, and monorepo support

#### ✨ Core Features

-   **🎨 Graphical Dependency Visualization** - Intuitive tree structure display of npm package dependencies
-   **🔍 Smart Hover Information** - View package version, description, and status details on hover
-   **📦 Visual Package Management** - Add, remove, and open packages through graphical interface
-   **🏗️ Monorepo Support** - Automatic workspace detection and multi-package management
-   **⚡ Automatic Type File Updates** - Intelligent TypeScript declaration file management

#### 🚀 Efficiency Benefits

-   **Reduce Command Line Operations** - Graphical interface replaces complex npm commands
-   **Dependency Relationships at a Glance** - Quickly understand project dependency structure
-   **Smart Package Management** - Automatic package type detection, reducing configuration errors
-   **Monorepo Friendly** - Seamless support for complex project structures

### 2. 📊 NPM Package Info - Package Information Display

**Information Display Tool** | In Development

> Display npm link, npm version information, and outdated package information

#### ✨ Core Features

-   **📋 Package Version Information** - Clear display of current package versions and update status
-   **🔗 Link Status Detection** - Show npm link status and associated information
-   **⚠️ Outdated Package Alerts** - Intelligent detection and alerts for packages that need updates
-   **📈 Version Comparison** - Visual comparison between current and latest versions

#### 🚀 Efficiency Benefits

-   **Version Management Visualization** - Quickly understand project package status
-   **Update Notifications** - Timely package update information
-   **Dependency Health Check** - Ensure project dependency currency

### 3. ⚛️ React Component - React Component Management

**React Component Tool** | Planned

> React component management and development tools

#### ✨ Planned Features

-   **🧩 Component Library Management** - Unified management of React components
-   **📝 Component Documentation Generation** - Automatic component documentation generation
-   **🔍 Component Search** - Quick search and locate components
-   **📦 Component Packaging** - One-click packaging and publishing of components

#### 🚀 Efficiency Benefits

-   **Component Reusability** - Improve component development efficiency
-   **Documentation Automation** - Reduce documentation maintenance costs
-   **Team Collaboration** - Unified component development standards

## 🛠️ Tech Stack

-   **TypeScript** - Type-safe JavaScript
-   **VS Code API** - Extension development framework
-   **pnpm** - Efficient package manager
-   **Monorepo** - Multi-package project management
-   **GitHub Actions** - Automated CI/CD

## 🚀 Quick Start

### Requirements

-   VS Code 1.99.0 or higher
-   Node.js 20+
-   pnpm 10.18.3+

### Install Node Deps Tree

1. Open VS Code
2. Go to Extensions panel (Ctrl+Shift+X)
3. Search for "Node Deps Tree"
4. Click Install

### Build from Source

```bash
# Clone the project
git clone https://github.com/rosendolu/FePilot.git
cd FePilot

# Install dependencies
pnpm install

# Build the project
pnpm run build

# Development mode
pnpm --filter node-dependency run watch
```

<!-- ## 📈 Development Efficiency Results

### Traditional Development vs FePilot Efficiency

| Operation                  | Traditional Method                 | FePilot Method                      | Efficiency Gain |
| -------------------------- | ---------------------------------- | ----------------------------------- | --------------- |
| View Dependencies          | Command Line + Manual Analysis     | Graphical Tree Display              | **5x**          |
| Add New Package            | Command Line + Manual Config       | Visual Interface Operation          | **3x**          |
| Package Version Management | Manual Check + Update              | Smart Alerts + One-click Update     | **4x**          |
| Monorepo Management        | Complex Config + Multiple Commands | Auto Detection + Unified Management | **6x**          | -->

## 🤝 Contributing

We welcome all forms of contributions!

### Development Workflow

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Create a Pull Request

### Code Standards

-   Use TypeScript strict mode
-   Follow ESLint configuration
-   Write unit tests
-   Update documentation

## 📄 License

This project is licensed under the [Apache 2.0 License](LICENSE)

## 🆘 Support & Feedback

-   **Issue Reports**: [GitHub Issues](https://github.com/rosendolu/FePilot/issues)
-   **Feature Requests**: [GitHub Discussions](https://github.com/rosendolu/FePilot/discussions)
-   **VS Code Extension**: [Node Deps Tree](https://marketplace.visualstudio.com/items?itemName=rosendolu.node-deps-tree)

## 🌟 Acknowledgments

Thanks to all developers who have contributed to the FePilot project!

---

<div align="center">

**Make Development More Efficient, Make Code More Elegant** ✨

[![Star](https://img.shields.io/github/stars/rosendolu/FePilot?style=social)](https://github.com/rosendolu/FePilot)
[![Fork](https://img.shields.io/github/forks/rosendolu/FePilot?style=social)](https://github.com/rosendolu/FePilot/fork)

</div>
