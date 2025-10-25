import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { NpmApiService, NpmPackageInfo } from '../services/npmApiService';
import { NpmQuickPickProvider } from './npm-search';
const execAsync = promisify(exec);

export class NodeDependenciesView {
    private depNodeProvider: DepNodeProvider;
    private view: vscode.TreeView<Dependency>;
    private workspaceRoot: string | undefined;
    private documentChangeListener: vscode.Disposable | undefined;
    private lastActivePackageJson: string | null = null;
    constructor(context: vscode.ExtensionContext) {
        this.workspaceRoot =
            vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
                ? vscode.workspace.workspaceFolders[0].uri.fsPath
                : undefined;
        // Create the tree data provider
        this.depNodeProvider = new DepNodeProvider(context, this.workspaceRoot);

        // Create the tree view
        this.view = vscode.window.createTreeView('nodeDependencies', {
            treeDataProvider: this.depNodeProvider,
            showCollapseAll: true,
        });

        // Register the view in context subscriptions
        context.subscriptions.push(this.view);

        // Register commands
        this.registerCommands(context);

        // Setup document change listener with view visibility optimization
        this.setupDocumentChangeListener(context);
    }

    private registerCommands(context: vscode.ExtensionContext): void {
        // Refresh command
        const refreshCommand = vscode.commands.registerCommand(
            'nodeDependencies.refreshEntry',
            () => {
                this.depNodeProvider.refresh();
            }
        );

        // Add NPM package command
        const addNpmPackageCommand = vscode.commands.registerCommand(
            'nodeDependencies.addNpmPackage',
            () => {
                NpmQuickPickProvider.showAddPackageQuickPick();
            }
        );

        // Add entry command
        const addCommand = vscode.commands.registerCommand('nodeDependencies.addEntry', () => {
            vscode.window.showInformationMessage('Successfully called add entry.');
        });

        // Edit entry command
        const editCommand = vscode.commands.registerCommand(
            'nodeDependencies.editEntry',
            (node: Dependency) => {
                this.openPackageJsonInEditor(node);
            }
        );

        // Remove package command
        const removeCommand = vscode.commands.registerCommand(
            'nodeDependencies.removePackage',
            (node: Dependency) => {
                this.removePackage(node);
            }
        );

        // Open package homepage command
        const openHomepageCommand = vscode.commands.registerCommand(
            'nodeDependencies.openPackageHomepage',
            (node: Dependency) => {
                vscode.commands.executeCommand(
                    'vscode.open',
                    vscode.Uri.parse(`https://www.npmjs.com/package/${node.label}`)
                );
            }
        );

        // Open package README command
        const openReadmeCommand = vscode.commands.registerCommand(
            'nodeDependencies.openPackageReadme',
            (node: Dependency) => {
                vscode.commands.executeCommand(
                    'vscode.open',
                    vscode.Uri.parse(`https://www.npmjs.com/package/${node.label}#readme`)
                );
            }
        );

        // Open package on npm command
        const openNpmCommand = vscode.commands.registerCommand(
            'nodeDependencies.openNpmPage',
            (node: Dependency) => {
                this.openNpmPage(node);
            }
        );

        // Add all commands to context subscriptions
        context.subscriptions.push(
            refreshCommand,
            addNpmPackageCommand,
            addCommand,
            editCommand,
            removeCommand,
            openHomepageCommand,
            openReadmeCommand,
            openNpmCommand
        );
    }
    public getWorkspaceRoot(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder found');
            return '';
        }
        return workspaceFolders[0].uri.fsPath;
    }

    /**
     * 设置文档切换监听器（仅在视图可见时执行）
     */
    private setupDocumentChangeListener(context: vscode.ExtensionContext): void {
        // 监听视图可见性变化
        this.view.onDidChangeVisibility(e => {
            if (e.visible) {
                // 视图变为可见时，启用文档监听器
                this.enableDocumentListener();
            } else {
                // 视图隐藏时，禁用文档监听器以节省性能
                this.disableDocumentListener();
            }
        });

        // 监听文档切换事件
        this.documentChangeListener = vscode.window.onDidChangeActiveTextEditor(editor => {
            // 只有在视图可见时才处理文档切换
            if (this.view.visible) {
                this.handleDocumentChange();
            }
        });

        // 将监听器添加到上下文订阅中，确保正确清理
        context.subscriptions.push(this.documentChangeListener);
    }

    /**
     * 启用文档监听器
     */
    private enableDocumentListener(): void {
        // 视图变为可见时，立即检查当前文档并刷新
        this.handleDocumentChange();
    }

    /**
     * 禁用文档监听器
     */
    private disableDocumentListener(): void {
        // 视图隐藏时，清理缓存
        this.lastActivePackageJson = null;
    }

    /**
     * 处理文档切换事件
     */
    private handleDocumentChange(): void {
        const currentPackageJson = this.depNodeProvider.getRelevantPackageJsonPath();

        // 只有当 package.json 路径发生变化时才刷新
        if (currentPackageJson && currentPackageJson !== this.lastActivePackageJson) {
            this.lastActivePackageJson = currentPackageJson;
            this.depNodeProvider.refresh();
        }
    }

    /**
     * 在编辑器中打开 package.json
     */
    private async openPackageJsonInEditor(node?: Dependency): Promise<void> {
        let packageJsonPath: string;

        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) {
            return;
        }

        if (node && node.workspaceDir) {
            const packageDir = node.workspaceDir;

            const nodePackageJsonPath = path.join(packageDir, 'package.json');

            if (this.pathExists(nodePackageJsonPath)) {
                packageJsonPath = nodePackageJsonPath;
            } else {
                // 如果包的 package.json 不存在，回退到项目根目录的 package.json
                packageJsonPath = path.join(workspaceRoot, 'package.json');
            }
        } else {
            // 如果没有传入 node，打开项目根目录的 package.json
            packageJsonPath = path.join(workspaceRoot, 'package.json');
        }

        if (this.pathExists(packageJsonPath)) {
            const document = await vscode.workspace.openTextDocument(packageJsonPath);
            const editor = await vscode.window.showTextDocument(document);

            // 如果传入了 node，使用搜索命令定位到对应的依赖
            if (node) {
                await this.searchAndFocusDependency(node);
            }
        } else {
            vscode.window.showErrorMessage('package.json not found');
        }
    }

    /**
     * 使用 VSCode 搜索命令定位到指定依赖
     */
    private async searchAndFocusDependency(node: Dependency): Promise<void> {
        try {
            // 使用 VSCode 的搜索命令，搜索包名并聚焦到第一个结果
            await vscode.commands.executeCommand('editor.actions.findWithArgs', {
                searchString: `"${node.label}"`,
                matchCase: false,
                wholeWord: false,
                regex: false,
            });

            // 等待一下让搜索完成，然后按 F3 跳转到第一个结果
            setTimeout(async () => {
                await vscode.commands.executeCommand('editor.action.nextMatchFindAction');
            }, 100);
        } catch (error) {
            console.error('搜索依赖时出错:', error);
        }
    }

    /**
     * 删除包
     */
    private async removePackage(node: Dependency): Promise<void> {
        // 确认删除
        const confirmMessage = `Are you sure you want to remove ${node.label}?`;
        const result = await vscode.window.showWarningMessage(
            confirmMessage,
            { modal: true },
            'Yes',
            'No'
        );

        if (result !== 'Yes') {
            return;
        }

        try {
            // 获取正确的包目录（包含 package.json 的目录）
            const packageDir = node.workspaceDir;
            if (!packageDir) {
                vscode.window.showErrorMessage(
                    `Failed to remove package: no package directory found`
                );
                return;
            }

            // 使用 npm-search 的删除功能
            await NpmQuickPickProvider.removePackage(node.label, packageDir);

            // 刷新依赖树
            this.depNodeProvider.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to remove package: ${error}`);
        }
    }

    /**
     * 打开包的 NPM 页面
     */
    private async openNpmPage(node: Dependency): Promise<void> {
        const npmUrl = `https://www.npmjs.com/package/${node.label}`;
        await vscode.env.openExternal(vscode.Uri.parse(npmUrl));
    }

    /**
     * 查看包的详细信息
     */
    private async viewPackageInfo(node: Dependency): Promise<void> {
        try {
            // 显示进度指示器
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Loading package information for ${node.label}...`,
                    cancellable: false,
                },
                async progress => {
                    progress.report({
                        increment: 0,
                        message: 'Fetching package data from npm registry...',
                    });

                    // 从 npm API 获取包信息
                    const packageInfo = await NpmApiService.getPackageInfo(node.label);

                    progress.report({
                        increment: 50,
                        message: 'Processing package information...',
                    });

                    if (!packageInfo) {
                        vscode.window.showErrorMessage(
                            `Failed to load package information for ${node.label}`
                        );
                        return;
                    }

                    progress.report({
                        increment: 100,
                        message: 'Opening package information panel...',
                    });

                    // 创建并显示包信息面板
                    await this.showPackageInfoPanel(packageInfo, node);
                }
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Error loading package information: ${error}`);
        }
    }

    /**
     * 显示包信息面板
     */
    private async showPackageInfoPanel(
        packageInfo: NpmPackageInfo,
        node: Dependency
    ): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'packageInfo',
            `Package Info: ${packageInfo.name}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        // 设置 webview 内容
        panel.webview.html = this.getPackageInfoHtml(packageInfo, node);

        // 处理来自 webview 的消息
        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'openUrl':
                        await vscode.env.openExternal(vscode.Uri.parse(message.url));
                        break;
                    case 'copyToClipboard':
                        await vscode.env.clipboard.writeText(message.text);
                        vscode.window.showInformationMessage('Copied to clipboard');
                        break;
                    case 'installPackage':
                        await this.installPackageFromInfo(packageInfo, message.installType);
                        break;
                }
            },
            undefined,
            []
        );
    }

    /**
     * 从包信息安装包
     */
    private async installPackageFromInfo(
        packageInfo: NpmPackageInfo,
        installType: string
    ): Promise<void> {
        try {
            const packageDir = this.getWorkspaceRoot();
            if (!packageDir) {
                vscode.window.showErrorMessage('No workspace folder found');
                return;
            }

            // 使用现有的安装逻辑
            const { NpmQuickPickProvider } = await import('./npm-search');
            const mockPackage = {
                name: packageInfo.name,
                version: packageInfo.version,
                description: packageInfo.description || '',
                keywords: packageInfo.keywords || [],
                date: new Date().toISOString(),
                links: {
                    npm: `https://www.npmjs.com/package/${packageInfo.name}`,
                    homepage: packageInfo.homepage || '',
                    repository: packageInfo.repository?.url || '',
                    bugs: packageInfo.bugs?.url || '',
                },
                publisher: {
                    username:
                        typeof packageInfo.author === 'object'
                            ? packageInfo.author.name || 'unknown'
                            : packageInfo.author || 'unknown',
                    email:
                        typeof packageInfo.author === 'object'
                            ? packageInfo.author.email || ''
                            : '',
                },
                maintainers: packageInfo.maintainers || [],
            };

            // 这里需要调用安装方法，但需要适配现有的接口
            vscode.window.showInformationMessage(
                `Installing ${packageInfo.name}@${packageInfo.version}...`
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to install package: ${error}`);
        }
    }

    /**
     * 生成包信息的 HTML 内容
     */
    private getPackageInfoHtml(packageInfo: NpmPackageInfo, node: Dependency): string {
        const formatAuthor = (author: any): string => {
            if (typeof author === 'string') return author;
            if (typeof author === 'object' && author.name) {
                let result = author.name;
                if (author.email) result += ` <${author.email}>`;
                if (author.url) result += ` (${author.url})`;
                return result;
            }
            return 'Unknown';
        };

        const formatRepository = (repo: any): string => {
            if (typeof repo === 'string') return repo;
            if (typeof repo === 'object' && repo.url) {
                return repo.url.replace(/^git\+/, '').replace(/\.git$/, '');
            }
            return '';
        };

        const formatEngines = (engines: any): string => {
            if (!engines) return '';
            return Object.entries(engines)
                .map(([key, value]) => `${key} ${value}`)
                .join(', ');
        };

        const formatDependencies = (deps: any): string => {
            if (!deps) return '';
            return Object.entries(deps)
                .map(([name, version]) => `\`${name}\`: ${version}`)
                .join('<br>');
        };

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Package Info: ${packageInfo.name}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 20px;
            line-height: 1.6;
        }
        .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 20px;
            margin-bottom: 20px;
        }
        .package-name {
            font-size: 24px;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
            margin-bottom: 5px;
        }
        .package-version {
            font-size: 16px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 10px;
        }
        .package-description {
            font-style: italic;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 20px;
        }
        .section {
            margin-bottom: 25px;
        }
        .section-title {
            font-size: 18px;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
            margin-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 5px;
        }
        .info-item {
            margin-bottom: 8px;
        }
        .info-label {
            font-weight: bold;
            color: var(--vscode-textPreformat-foreground);
        }
        .info-value {
            color: var(--vscode-foreground);
        }
        .link {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
        }
        .link:hover {
            text-decoration: underline;
        }
        .code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
        }
        .button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 10px;
            margin-bottom: 10px;
        }
        .button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .keywords {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
        }
        .keyword {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
        }
        .dependencies {
            max-height: 200px;
            overflow-y: auto;
            background-color: var(--vscode-textCodeBlock-background);
            padding: 10px;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="package-name">${packageInfo.name}</div>
        <div class="package-version">v${packageInfo.version}</div>
        ${
            packageInfo.description
                ? `<div class="package-description">${packageInfo.description}</div>`
                : ''
        }
        
        <div>
            <button class="button" onclick="installPackage('')">Install</button>
            <button class="button secondary" onclick="installPackage('--save-dev')">Install as Dev</button>
            <button class="button secondary" onclick="installPackage('--save-peer')">Install as Peer</button>
        </div>
    </div>

    ${
        packageInfo.keywords && packageInfo.keywords.length > 0
            ? `
    <div class="section">
        <div class="section-title">Keywords</div>
        <div class="keywords">
            ${packageInfo.keywords
                .map(keyword => `<span class="keyword">${keyword}</span>`)
                .join('')}
        </div>
    </div>
    `
            : ''
    }

    <div class="section">
        <div class="section-title">Package Information</div>
        ${
            packageInfo.author
                ? `
        <div class="info-item">
            <span class="info-label">Author:</span>
            <span class="info-value">${formatAuthor(packageInfo.author)}</span>
        </div>
        `
                : ''
        }
        ${
            packageInfo.license
                ? `
        <div class="info-item">
            <span class="info-label">License:</span>
            <span class="info-value">${packageInfo.license}</span>
        </div>
        `
                : ''
        }
        ${
            packageInfo.main
                ? `
        <div class="info-item">
            <span class="info-label">Main:</span>
            <span class="info-value"><span class="code">${packageInfo.main}</span></span>
        </div>
        `
                : ''
        }
        ${
            packageInfo.types || packageInfo.typings
                ? `
        <div class="info-item">
            <span class="info-label">Types:</span>
            <span class="info-value"><span class="code">${
                packageInfo.types || packageInfo.typings
            }</span></span>
        </div>
        `
                : ''
        }
        ${
            formatEngines(packageInfo.engines)
                ? `
        <div class="info-item">
            <span class="info-label">Engines:</span>
            <span class="info-value">${formatEngines(packageInfo.engines)}</span>
        </div>
        `
                : ''
        }
    </div>

    <div class="section">
        <div class="section-title">Links</div>
        ${
            packageInfo.homepage
                ? `
        <div class="info-item">
            <span class="info-label">Homepage:</span>
            <a href="${packageInfo.homepage}" class="link" onclick="openUrl('${packageInfo.homepage}')">${packageInfo.homepage}</a>
        </div>
        `
                : ''
        }
        ${
            formatRepository(packageInfo.repository)
                ? `
        <div class="info-item">
            <span class="info-label">Repository:</span>
            <a href="${formatRepository(
                packageInfo.repository
            )}" class="link" onclick="openUrl('${formatRepository(
                      packageInfo.repository
                  )}')">${formatRepository(packageInfo.repository)}</a>
        </div>
        `
                : ''
        }
        ${
            packageInfo.bugs?.url
                ? `
        <div class="info-item">
            <span class="info-label">Issues:</span>
            <a href="${packageInfo.bugs.url}" class="link" onclick="openUrl('${packageInfo.bugs.url}')">${packageInfo.bugs.url}</a>
        </div>
        `
                : ''
        }
        <div class="info-item">
            <span class="info-label">NPM:</span>
            <a href="https://www.npmjs.com/package/${
                packageInfo.name
            }" class="link" onclick="openUrl('https://www.npmjs.com/package/${
            packageInfo.name
        }')">https://www.npmjs.com/package/${packageInfo.name}</a>
        </div>
    </div>

    ${
        packageInfo.dependencies && Object.keys(packageInfo.dependencies).length > 0
            ? `
    <div class="section">
        <div class="section-title">Dependencies</div>
        <div class="dependencies">
            ${formatDependencies(packageInfo.dependencies)}
        </div>
    </div>
    `
            : ''
    }

    ${
        packageInfo.devDependencies && Object.keys(packageInfo.devDependencies).length > 0
            ? `
    <div class="section">
        <div class="section-title">Dev Dependencies</div>
        <div class="dependencies">
            ${formatDependencies(packageInfo.devDependencies)}
        </div>
    </div>
    `
            : ''
    }

    ${
        packageInfo.peerDependencies && Object.keys(packageInfo.peerDependencies).length > 0
            ? `
    <div class="section">
        <div class="section-title">Peer Dependencies</div>
        <div class="dependencies">
            ${formatDependencies(packageInfo.peerDependencies)}
        </div>
    </div>
    `
            : ''
    }

    <script>
        const vscode = acquireVsCodeApi();

        function openUrl(url) {
            vscode.postMessage({
                command: 'openUrl',
                url: url
            });
        }

        function installPackage(installType) {
            vscode.postMessage({
                command: 'installPackage',
                installType: installType
            });
        }

        function copyToClipboard(text) {
            vscode.postMessage({
                command: 'copyToClipboard',
                text: text
            });
        }
    </script>
</body>
</html>`;
    }
    private pathExists(p: string): boolean {
        try {
            fs.accessSync(p);
        } catch {
            return false;
        }

        return true;
    }
}

class DepNodeProvider implements vscode.TreeDataProvider<Dependency> {
    private _onDidChangeTreeData: vscode.EventEmitter<Dependency | undefined | void> =
        new vscode.EventEmitter<Dependency | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<Dependency | undefined | void> =
        this._onDidChangeTreeData.event;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly workspaceRoot: string | undefined
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Dependency): vscode.TreeItem {
        return element;
    }
    async resolveTreeItem(
        item: Dependency,
        element: Dependency,
        token: vscode.CancellationToken
    ): Promise<Dependency> {
        //  Prior to get local package info, we need to resolve the package path
        //
        const packageInfo = await this.getLocalPackageInfo(element.label, element.workspaceDir);

        if (packageInfo) {
            // 构建详细的 tooltip
            const tooltip = this.buildDetailedTooltip(element, packageInfo);
            item.tooltip = new vscode.MarkdownString(tooltip);
        }

        return item;
    }

    private buildDetailedTooltip(dependency: Dependency, packageInfo: any): string {
        let tooltip = `**${packageInfo?.name || dependency.label}** ${
            packageInfo?.version || dependency.version
        }\n\n`;

        // Description
        if (packageInfo?.description) {
            tooltip += `*${packageInfo.description}*\n\n`;
        }

        // Keywords
        if (
            packageInfo?.keywords &&
            Array.isArray(packageInfo.keywords) &&
            packageInfo.keywords.length > 0
        ) {
            tooltip += `🏷️ **Keywords:** ${packageInfo.keywords.join(', ')}\n\n`;
        }

        // Author information
        if (packageInfo?.author) {
            let authorInfo = '';
            if (typeof packageInfo.author === 'string') {
                authorInfo = packageInfo.author;
            } else if (typeof packageInfo.author === 'object') {
                const author = packageInfo.author;
                if (author.name) {
                    authorInfo = author.name;
                    if (author.email) {
                        authorInfo += ` <${author.email}>`;
                    }
                    if (author.url) {
                        authorInfo += ` (${author.url})`;
                    }
                }
            }
            if (authorInfo) {
                tooltip += `👤 **Author:** ${authorInfo}\n\n`;
            }
        }

        // License
        if (packageInfo?.license) {
            tooltip += `📄 **License:** ${packageInfo.license}\n\n`;
        }

        // Repository
        if (packageInfo?.repository) {
            let repoInfo = '';
            if (typeof packageInfo.repository === 'string') {
                repoInfo = packageInfo.repository;
            } else if (typeof packageInfo.repository === 'object' && packageInfo.repository.url) {
                repoInfo = packageInfo.repository.url;
            }
            if (repoInfo) {
                // 处理 git+https:// 等前缀
                const cleanUrl = repoInfo.replace(/^git\+/, '').replace(/\.git$/, '');
                tooltip += `📦 **Repository:** [${cleanUrl}](${cleanUrl})\n\n`;
            }
        }

        // Homepage
        if (packageInfo?.homepage) {
            tooltip += `🌐 **Homepage:** [${packageInfo.homepage}](${packageInfo.homepage})\n\n`;
        }

        // Bugs/Issues
        if (packageInfo?.bugs) {
            let bugsUrl = '';
            if (typeof packageInfo.bugs === 'string') {
                bugsUrl = packageInfo.bugs;
            } else if (typeof packageInfo.bugs === 'object' && packageInfo.bugs.url) {
                bugsUrl = packageInfo.bugs.url;
            }
            if (bugsUrl) {
                tooltip += `🐛 **Issues:** [${bugsUrl}](${bugsUrl})\n\n`;
            }
        }

        return tooltip;
    }

    getChildren(element?: Dependency): Thenable<Dependency[]> {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No dependency in empty workspace');
            return Promise.resolve([]);
        }

        if (element) {
            return this.getDepsInPackageJson(
                path.join(this.workspaceRoot, 'node_modules', element.label, 'package.json')
            );
        } else {
            // 智能检测当前激活文件的 package.json 路径
            const packageJsonPath = this.getRelevantPackageJsonPath();
            if (packageJsonPath) {
                return this.getDepsInPackageJson(packageJsonPath);
            } else {
                vscode.window.showInformationMessage('No package.json found in current context');
                return Promise.resolve([]);
            }
        }
    }

    /**
     * Given the path to package.json, read all its dependencies, devDependencies and peerDependencies.
     */
    private async getDepsInPackageJson(packageJsonPath: string): Promise<Dependency[]> {
        const workspaceRoot = this.workspaceRoot;
        if (this.pathExists(packageJsonPath) && workspaceRoot) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            const workspaceDir = path.dirname(packageJsonPath);
            const toDep = async (
                moduleName: string,
                version: string,
                type: 'dep' | 'dev' | 'peer'
            ): Promise<Dependency> => {
                // 获取本地包信息
                if (this.pathExists(path.join(workspaceRoot, 'node_modules', moduleName))) {
                    return new Dependency(
                        vscode.TreeItemCollapsibleState.Collapsed,
                        moduleName,
                        version,
                        type,
                        workspaceDir
                    );
                } else {
                    return new Dependency(
                        vscode.TreeItemCollapsibleState.None,
                        moduleName,
                        version,
                        type,
                        workspaceDir
                    );
                }
            };

            // 按顺序获取：peerDependencies + dependencies + devDependencies
            const peerDeps = packageJson.peerDependencies
                ? await Promise.all(
                      Object.keys(packageJson.peerDependencies).map(dep =>
                          toDep(dep, packageJson.peerDependencies[dep], 'peer')
                      )
                  )
                : [];
            const deps = packageJson.dependencies
                ? await Promise.all(
                      Object.keys(packageJson.dependencies).map(dep =>
                          toDep(dep, packageJson.dependencies[dep], 'dep')
                      )
                  )
                : [];
            const devDeps = packageJson.devDependencies
                ? await Promise.all(
                      Object.keys(packageJson.devDependencies).map(dep =>
                          toDep(dep, packageJson.devDependencies[dep], 'dev')
                      )
                  )
                : [];

            return peerDeps.concat(deps).concat(devDeps);
        } else {
            return [];
        }
    }
    public readFileAsJson(filePath: string): any {
        try {
            const realpath = fs.realpathSync(filePath);
            if (!this.pathExists(realpath)) {
                throw new Error(`File not found: ${realpath}`);
            }
            console.log('[package.json] =>', realpath);
            return JSON.parse(fs.readFileSync(realpath, 'utf-8'));
        } catch (error) {
            console.error(`Error reading file as JSON: ${filePath}`, error);
            return null;
        }
    }
    /**
     * 获取本地包信息，使用包管理工具查询实际位置
     */
    private async getLocalPackageInfo(
        moduleName: string,
        dir: string
    ): Promise<NpmPackageInfo | null> {
        const localPackageJson = await this.getPackageJsonFromPath(moduleName, dir);
        return localPackageJson;
    }
    private async getPackageJsonFromPath(
        moduleName: string,
        dir: string
    ): Promise<NpmPackageInfo | null> {
        try {
            // 首先尝试使用现有的resolvePackageDir方法
            const pkgDir = await this.resolvePackageDir(moduleName, dir);

            if (pkgDir) {
                return await this.findPackageJson(moduleName, pkgDir);
            }

            return await this.findPackageJson(moduleName, dir);
        } catch (error) {
            console.error(`Error getting package.json path for ${moduleName} ${dir}:`);
            return null;
        }
    }

    /**
     * 递归向上查找package.json文件，确保包名匹配
     */
    private async findPackageJson(
        moduleName: string,
        startDir: string
    ): Promise<NpmPackageInfo | null> {
        // package root dir
        const currentPackageJson = path.join(startDir, 'package.json');
        if (this.pathExists(currentPackageJson)) {
            const packageInfo = this.readFileAsJson(currentPackageJson);
            if (packageInfo && packageInfo.name === moduleName) {
                return packageInfo;
            }
        }

        // package output dir  dist/index.js => dist
        const nodeModulesPath = path.resolve(startDir, '..', 'package.json');
        if (this.pathExists(nodeModulesPath)) {
            const packageInfo = this.readFileAsJson(nodeModulesPath);
            if (packageInfo && packageInfo.name === moduleName) {
                return packageInfo;
            }
        }

        // check root node_modules
        if (this.workspaceRoot) {
            const rootNodeModulesPath = path.resolve(
                this.workspaceRoot,
                'node_modules',
                moduleName,
                'package.json'
            );

            if (this.pathExists(rootNodeModulesPath)) {
                const packageInfo = this.readFileAsJson(rootNodeModulesPath);
                return packageInfo;
            }
        }

        // finally , fallback to use npm search

        // 同时从 npm API 获取最新信息
        const npmPackageInfo = await NpmApiService.getPackageInfo(moduleName);
        return npmPackageInfo as NpmPackageInfo;
    }

    private async resolvePackageDir(moduleName: string, dir: string): Promise<string | null> {
        try {
            //  require.resolve will throw error for @types/pkg, so we need to return null;
            if (moduleName.includes('@types/')) {
                return null;
            }
            // @types/pkg  has not entry point which would cause error when using require.resolve;
            /**
             *         "main": "",
             * 			"types": "index.d.ts",
             */
            // local package will be failed to resolve;
            // sub deps of @types/pkg will be failed to resolve;
            // const cmd = `node -p "fs.realpathSync(require('path').dirname(require.resolve('${moduleName}')))"`;
            // const output = execSync(cmd, { cwd: dir || this.workspaceRoot })
            //     .toString()
            //     .trim();
            const entry = require.resolve(moduleName, { paths: [dir ?? this.workspaceRoot] });
            return fs.realpathSync(path.dirname(entry));
        } catch (error) {
            console.error(`Error resolving package path for ${moduleName} ${dir}`);
            console.error(error);
        }
        return null;
    }

    private resolvePackagePathManually(startDir: string, moduleName: string): string | null {
        let currentDir = startDir;

        while (currentDir !== path.dirname(currentDir)) {
            // 检查当前目录的 node_modules
            const packagePath = path.join(currentDir, 'node_modules', moduleName, 'package.json');
            if (this.pathExists(packagePath)) {
                return packagePath;
            }

            // 向上级目录查找
            currentDir = path.dirname(currentDir);
        }

        return null;
    }

    /**
     * 检测包管理工具
     */
    private async detectPackageManager(workspaceRoot: string): Promise<string> {
        try {
            // 检查 package.json 中的 packageManager 字段
            const packageJsonPath = path.join(workspaceRoot, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = this.readFileAsJson(packageJsonPath);
                if (packageJson.packageManager) {
                    const packageManager = packageJson.packageManager.split('@')[0];
                    if (['npm', 'pnpm', 'yarn'].includes(packageManager)) {
                        return packageManager;
                    }
                }
            }

            // 检查锁文件
            const lockFiles = [
                { file: 'pnpm-lock.yaml', manager: 'pnpm' },
                { file: 'yarn.lock', manager: 'yarn' },
                { file: 'package-lock.json', manager: 'npm' },
            ];

            for (const { file, manager } of lockFiles) {
                if (fs.existsSync(path.join(workspaceRoot, file))) {
                    return manager;
                }
            }

            return 'npm'; // 默认
        } catch (error) {
            console.error('Error detecting package manager:', error);
            return 'npm';
        }
    }

    /**
     * 获取当前激活文件所在的 package.json 路径
     * 从当前文件路径向上递归查找，直到找到 package.json 或到达工作区根目录
     */
    private getActivePackageJsonPath(): string | null {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return null;
        }

        const activeFilePath = activeEditor.document.uri.fsPath;
        return this.findPackageJsonUpward(activeFilePath);
    }

    /**
     * 从指定路径向上查找 package.json
     * @param startPath 起始文件路径
     * @returns package.json 的完整路径，如果没找到返回 null
     */
    private findPackageJsonUpward(startPath: string): string | null {
        const workspaceRoot = this.workspaceRoot;
        if (!workspaceRoot) {
            return null;
        }

        // 确保起始路径在工作区内
        if (!startPath.startsWith(workspaceRoot)) {
            return null;
        }

        let currentDir = path.dirname(startPath);

        // 向上查找，直到到达工作区根目录
        while (currentDir !== path.dirname(currentDir) && currentDir.startsWith(workspaceRoot)) {
            const packageJsonPath = path.join(currentDir, 'package.json');

            if (this.pathExists(packageJsonPath)) {
                return packageJsonPath;
            }

            currentDir = path.dirname(currentDir);
        }

        // 如果没找到，检查工作区根目录
        const rootPackageJsonPath = path.join(workspaceRoot, 'package.json');
        if (this.pathExists(rootPackageJsonPath)) {
            return rootPackageJsonPath;
        }

        return null;
    }

    /**
     * 获取当前相关的 package.json 路径（带智能回退）
     * 优先级：当前文件所在项目 > 工作区根目录 > 默认项目
     */
    public getRelevantPackageJsonPath(): string | null {
        // 1. 尝试从当前激活文件获取
        const activePackageJson = this.getActivePackageJsonPath();
        if (activePackageJson) {
            // 显示检测到的项目信息
            this.showDetectedProjectInfo(activePackageJson);
            return activePackageJson;
        }

        // 2. 回退到工作区根目录
        const rootPackageJson = path.join(this.workspaceRoot || '', 'package.json');
        if (this.pathExists(rootPackageJson)) {
            return rootPackageJson;
        }

        // 3. 如果都没有，返回 null
        return null;
    }

    /**
     * 显示检测到的项目信息
     */
    private showDetectedProjectInfo(packageJsonPath: string): void {
        const relativePath = path.relative(this.workspaceRoot || '', packageJsonPath);
        const projectName = path.basename(path.dirname(packageJsonPath));

        // 在控制台输出调试信息
        console.log(`📦 FePilot: Detected project "${projectName}" at ${relativePath}`);

        // 可选：显示用户通知（可以配置为关闭）
        // vscode.window.showInformationMessage(
        //     `📦 Detected project: ${projectName}`,
        //     'Open package.json'
        // ).then(selection => {
        //     if (selection === 'Open package.json') {
        //         vscode.workspace.openTextDocument(packageJsonPath);
        //     }
        // });
    }

    private pathExists(p: string): boolean {
        try {
            fs.accessSync(p);
        } catch {
            return false;
        }

        return true;
    }
}

class Dependency extends vscode.TreeItem {
    constructor(
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly label: string,
        public readonly version: string,
        public readonly type: 'dep' | 'dev' | 'peer' = 'dep',
        public readonly workspaceDir: string
    ) {
        super(label, collapsibleState);
        this.description = version;
        // this.tooltip = this.buildTooltip();
        this.iconPath = this.getIconPath();
        // mark Indirect Dependency or  Direct Dependency

        this.contextValue = (workspaceDir || '').includes('node_modules')
            ? 'indirectDependency'
            : 'dependency';
    }

    private buildTooltip(): string {
        let tooltip = `${this.label} ${this.version}`;
        return tooltip;
    }

    private getIconPath(): vscode.ThemeIcon {
        switch (this.type) {
            case 'dev':
                return new vscode.ThemeIcon('debug');
            case 'peer':
                return new vscode.ThemeIcon('link');
            case 'dep':
            default:
                return new vscode.ThemeIcon('package');
        }
    }
}
