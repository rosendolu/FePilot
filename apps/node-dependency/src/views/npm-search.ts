import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { IPackage } from '../types/npm-search';

const execAsync = promisify(exec);

interface NpmQuickPickItem extends vscode.QuickPickItem {
    package?: IPackage;
    action?: string;
}

type PackageManager = 'npm' | 'pnpm' | 'yarn';

// 使用 QuickPick 实现 NPM 包搜索和安装
export class NpmQuickPickProvider {
    private static readonly NPM_REGISTRY = 'https://registry.npmjs.org';
    private static searchTimeout: NodeJS.Timeout | undefined;

    static async showAddPackageQuickPick(): Promise<void> {
        // Step 1: Package search
        await this.showPackageSearchStep();
    }

    /**
     * 删除包
     */
    static async removePackage(packageName: string, workspaceRoot: string): Promise<void> {
        try {
            // 检测包管理工具
            const packageManager = await this.detectPackageManager(workspaceRoot);

            // 检查是否存在对应的类型定义包
            const typesPackage = `@types/${packageName}`;
            const pkgPath = path.join(workspaceRoot, 'package.json');
            if (!fs.existsSync(pkgPath)) {
                vscode.window.showErrorMessage('No package.json found in dir ${workspaceRoot}');
                return;
            }
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            if (
                !pkg?.dependencies?.[packageName] &&
                !pkg?.devDependencies?.[packageName] &&
                !pkg?.peerDependencies?.[packageName]
            ) {
                vscode.window.showErrorMessage(
                    `Package ${packageName} not found in package.json in dir ${workspaceRoot}`
                );
                return;
            }
            const hasTypesPackage =
                pkg?.devDependencies?.[typesPackage] ||
                pkg?.peerDependencies?.[typesPackage] ||
                pkg?.dependencies?.[typesPackage];

            // 显示删除进度
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Removing ${packageName}...`,
                    cancellable: false,
                },
                async progress => {
                    progress.report({
                        increment: 0,
                        message: `Detected package manager: ${packageManager}`,
                    });

                    if (hasTypesPackage) {
                        progress.report({
                            increment: 10,
                            message: `Found type definitions for ${packageName}, will remove both package and types`,
                        });
                    }

                    // 构建删除命令
                    const removeCommand = this.buildRemoveCommand(
                        packageManager,
                        packageName,
                        hasTypesPackage
                    );

                    progress.report({ increment: 20, message: 'Removing package...' });

                    // 使用 Task 执行删除命令
                    await this.executeWithTask(workspaceRoot, removeCommand, packageManager);

                    progress.report({ increment: 70, message: 'Package removed successfully' });
                }
            );

            const typesText = hasTypesPackage ? ' and type definitions' : '';
            vscode.window.showInformationMessage(
                `Successfully removed ${packageName}${typesText} using ${packageManager}`
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to remove package: ${error}`);
            throw error;
        }
    }

    private static async showPackageSearchStep(): Promise<void> {
        const quickPick = vscode.window.createQuickPick<NpmQuickPickItem>();
        quickPick.title = 'Step 1: Search NPM Package (1/2)';
        quickPick.placeholder = 'Enter package name to search...';
        quickPick.items = [
            {
                label: '$(search) NPM Home',
                description: `Search on npmjs.com`,
                detail: `https://www.npmjs.com/search?q=${encodeURIComponent('')}`,
                action: 'browse-npm',
            },
            {
                label: '$(graph-line) NPM Trends',
                description: `View trends on npmtrends.com`,
                detail: `https://npmtrends.com/${encodeURIComponent('')}`,
                action: 'browse-trends',
            },
        ];

        quickPick.onDidChangeValue(async value => {
            // Clear previous timeout
            if (this.searchTimeout) {
                clearTimeout(this.searchTimeout);
            }

            if (value.trim()) {
                // Debounce search by 1 second
                this.searchTimeout = setTimeout(async () => {
                    quickPick.busy = true;
                    try {
                        const packages = await this.searchPackages(value);
                        quickPick.items = packages.map(pkg => ({
                            iconPath: new vscode.ThemeIcon('package'),
                            label: `${pkg.name}@${pkg.version}`,
                            description:
                                pkg.publisher.username +
                                ' (' +
                                pkg.publisher.email +
                                ')' +
                                ' | ' +
                                pkg.keywords.join(', '),
                            detail: pkg.description + ' | ' + pkg.links.homepage,
                            package: pkg,
                        }));
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to search packages: ${error}`);
                    } finally {
                        quickPick.busy = false;
                    }
                }, 500);
            } else {
                quickPick.items = [];
            }
        });

        quickPick.onDidAccept(async () => {
            const selected = quickPick.selectedItems[0] as NpmQuickPickItem;
            if (selected) {
                if (selected.package) {
                    // Step 2: Show install options for selected package
                    await this.showInstallOptionsStep(selected.package);
                    quickPick.hide();
                } else if (selected.action) {
                    // Handle default items (browse actions) when no package is selected
                    await this.handleBrowseAction(selected.action, '');
                }
            }
        });

        quickPick.show();
    }

    private static async showInstallOptionsStep(pkg: IPackage): Promise<void> {
        const quickPick = vscode.window.createQuickPick<NpmQuickPickItem>();
        quickPick.title = `Step 2: Install ${pkg.name} (2/2)`;
        quickPick.placeholder = 'Select installation option...';
        quickPick.items = [
            {
                label: '$(add) Install',
                description: `${pkg.name}@${pkg.version}`,
                detail: 'dependency',
                action: 'install',
                package: pkg,
            },
            {
                label: '$(add) Install as Peer',
                description: `${pkg.name}@${pkg.version}`,
                detail: 'peer dependency',
                action: 'install-peer',
                package: pkg,
            },
            {
                label: '$(add) Install as Dev',
                description: `${pkg.name}@${pkg.version}`,
                detail: 'dev dependency',
                action: 'install-dev',
                package: pkg,
            },
            {
                label: '$(search) NPM Home',
                description: `Search ${pkg.name} on npmjs.com`,
                detail: `https://www.npmjs.com/package/${encodeURIComponent(pkg.name)}`,
                action: 'browse-npm',
                package: pkg,
            },
            {
                label: '$(graph-line) NPM Trends',
                description: `View ${pkg.name} trends on npmtrends.com`,
                detail: `https://npmtrends.com/${encodeURIComponent(pkg.name)}`,
                action: 'browse-trends',
                package: pkg,
            },
        ];

        quickPick.onDidAccept(async () => {
            const selected = quickPick.selectedItems[0] as NpmQuickPickItem;
            if (selected && selected.action && selected.package) {
                quickPick.hide();
                await this.handleInstallAction(selected.action, selected.package);
            }
        });

        quickPick.show();
    }

    private static async handleInstallAction(action: string, pkg: IPackage): Promise<void> {
        switch (action) {
            case 'install':
                await this.installPackage(pkg, '');
                break;
            case 'install-peer':
                await this.installPackage(pkg, '--save-peer');
                break;
            case 'install-dev':
                await this.installPackage(pkg, '--save-dev');
                break;
            default:
                await this.handleBrowseAction(action, pkg.name);
                break;
        }
    }

    private static async handleBrowseAction(action: string, packageName: string): Promise<void> {
        switch (action) {
            case 'browse-npm':
                const npmUrl = packageName
                    ? `https://www.npmjs.com/search?q=${encodeURIComponent(packageName)}`
                    : 'https://www.npmjs.com/';
                await vscode.env.openExternal(vscode.Uri.parse(npmUrl));
                break;
            case 'browse-trends':
                const trendsUrl = packageName
                    ? `https://npmtrends.com/${encodeURIComponent(packageName)}`
                    : 'https://npmtrends.com/';
                await vscode.env.openExternal(vscode.Uri.parse(trendsUrl));
                break;
        }
    }

    private static async searchPackages(query: string): Promise<IPackage[]> {
        try {
            // https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md
            const response = await fetch(
                `${this.NPM_REGISTRY}/-/v1/search?text=${encodeURIComponent(query)}&size=10`
            );
            const data = (await response.json()) as any;

            return data.objects.map((obj: any) => obj.package as IPackage);
        } catch (error) {
            console.error('Search error:', error);
            return [];
        }
    }

    private static async installPackage(pkg: IPackage, installType: string = ''): Promise<void> {
        try {
            const packageDir = await this.getPackageDirectory();
            if (!packageDir) {
                vscode.window.showErrorMessage('No package.json found in workspace');
                return;
            }

            // 检测包管理工具
            const packageManager = await this.detectPackageManager(packageDir);

            // 检查类型定义是否存在（仅在非peer依赖时）
            let includeTypes = false;
            if (installType !== '--save-peer') {
                includeTypes = await this.checkTypesPackageExists(
                    packageManager,
                    pkg.name,
                    packageDir
                );
            }

            // 显示安装进度
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Installing ${pkg.name} with ${packageManager}...`,
                    cancellable: false,
                },
                async progress => {
                    progress.report({
                        increment: 0,
                        message: `Detected package manager: ${packageManager}`,
                    });

                    if (installType !== '--save-peer') {
                        progress.report({
                            increment: 10,
                            message: includeTypes
                                ? 'Type definitions found, will install package and types (as dev dependency)'
                                : 'No type definitions found, installing package only',
                        });
                    }

                    // 构建安装命令
                    const installCommand = this.buildInstallCommand(
                        packageManager,
                        pkg,
                        installType,
                        includeTypes
                    );

                    progress.report({
                        increment: 20,
                        message: includeTypes
                            ? `Installing ${pkg.name} and @types/${pkg.name} (as dev dependency)...`
                            : `Installing ${pkg.name}...`,
                    });

                    // 使用 Task 执行安装命令
                    await this.executeWithTask(packageDir, installCommand, packageManager);

                    progress.report({
                        increment: 70,
                        message: includeTypes
                            ? 'Package and type definitions (dev dependency) installed successfully'
                            : 'Package installed successfully',
                    });
                }
            );

            const installTypeText = installType ? ` (${installType})` : '';
            const typesText = includeTypes ? ' and type definitions (as dev dependency)' : '';
            vscode.window.showInformationMessage(
                `Successfully installed ${pkg.name}@${pkg.version}${typesText}${installTypeText} using ${packageManager}`
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to install package: ${error}`);
        }
    }

    private static async getPackageDirectory(): Promise<string | null> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const activeEditor = vscode.window.activeTextEditor;

        if (activeEditor) {
            const activeFilePath = activeEditor.document.uri.fsPath;

            // 验证当前活动文件是否在 workspace root 目录中
            if (!activeFilePath.startsWith(rootPath)) {
                // 如果不在 workspace root 中，直接检查 root 目录是否有 package.json
                const packageJsonPath = path.join(rootPath, 'package.json');
                if (fs.existsSync(packageJsonPath)) {
                    return rootPath;
                }
                return null;
            }

            // 从当前活动文件向上查找 package.json，但不超过 workspace root
            let currentDir = path.dirname(activeFilePath);
            while (currentDir !== path.dirname(currentDir) && currentDir.startsWith(rootPath)) {
                const packageJsonPath = path.join(currentDir, 'package.json');
                if (fs.existsSync(packageJsonPath)) {
                    return currentDir;
                }
                currentDir = path.dirname(currentDir);
            }
        }

        // 如果没有活动文件或没找到 package.json，检查工作区根目录
        const packageJsonPath = path.join(rootPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            return rootPath;
        }

        return null;
    }

    /**
     * 检测当前项目的包管理工具
     */
    private static async detectPackageManager(packageDir: string): Promise<PackageManager> {
        try {
            // 1. 检查 package.json 中的 packageManager 字段
            const packageJsonPath = path.join(packageDir, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                if (packageJson.packageManager) {
                    const packageManager = packageJson.packageManager.split('@')[0];
                    if (['npm', 'pnpm', 'yarn'].includes(packageManager)) {
                        return packageManager as PackageManager;
                    }
                }
            }

            // 2. 检查锁文件
            const lockFiles = [
                { file: 'pnpm-lock.yaml', manager: 'pnpm' as PackageManager },
                { file: 'yarn.lock', manager: 'yarn' as PackageManager },
                { file: 'package-lock.json', manager: 'npm' as PackageManager },
            ];

            for (const { file, manager } of lockFiles) {
                if (fs.existsSync(path.join(packageDir, file))) {
                    return manager;
                }
            }

            // 3. 检查可执行文件
            try {
                await execAsync('which pnpm', { cwd: packageDir });
                return 'pnpm';
            } catch {
                try {
                    await execAsync('which yarn', { cwd: packageDir });
                    return 'yarn';
                } catch {
                    // 默认使用 npm
                    return 'npm';
                }
            }
        } catch (error) {
            console.error('Error detecting package manager:', error);
            return 'npm'; // 默认回退到 npm
        }
    }

    /**
     * 根据包管理工具构建安装命令
     */
    private static buildInstallCommand(
        packageManager: PackageManager,
        pkg: IPackage,
        installType: string = '',
        includeTypes: boolean = false
    ): string {
        const packageSpec = `${pkg.name}@${pkg.version}`;
        const typesPackage = `@types/${pkg.name}`;

        // 构建主包安装命令
        let mainCommand: string;
        switch (packageManager) {
            case 'pnpm':
                if (installType === '--save-dev') {
                    mainCommand = `pnpm add -D ${packageSpec}`;
                } else if (installType === '--save-peer') {
                    mainCommand = `pnpm add -P ${packageSpec}`;
                } else {
                    mainCommand = `pnpm add ${packageSpec}`;
                }
                break;
            case 'yarn':
                if (installType === '--save-dev') {
                    mainCommand = `yarn add -D ${packageSpec}`;
                } else if (installType === '--save-peer') {
                    mainCommand = `yarn add -P ${packageSpec}`;
                } else {
                    mainCommand = `yarn add ${packageSpec}`;
                }
                break;
            case 'npm':
            default:
                if (installType === '--save-dev') {
                    mainCommand = `npm install --save-dev ${packageSpec}`;
                } else if (installType === '--save-peer') {
                    mainCommand = `npm install --save-peer ${packageSpec}`;
                } else {
                    mainCommand = `npm install ${packageSpec}`;
                }
                break;
        }

        // 如果不需要安装类型定义，直接返回主命令
        if (!includeTypes || installType === '--save-peer') {
            return mainCommand;
        }

        // 构建类型定义安装命令（始终安装为 dev dependencies）
        let typesCommand: string;
        switch (packageManager) {
            case 'pnpm':
                typesCommand = `pnpm add -D ${typesPackage}`;
                break;
            case 'yarn':
                typesCommand = `yarn add -D ${typesPackage}`;
                break;
            case 'npm':
            default:
                typesCommand = `npm install --save-dev ${typesPackage}`;
                break;
        }

        // 使用 && 连接两个命令
        return `${mainCommand} && ${typesCommand}`;
    }

    /**
     * 构建删除命令
     */
    private static buildRemoveCommand(
        packageManager: PackageManager,
        packageName: string,
        hasTypesPackage: boolean = false
    ): string {
        const typesPackage = `@types/${packageName}`;

        // 构建主包删除命令
        let mainCommand: string;
        switch (packageManager) {
            case 'pnpm':
                mainCommand = `pnpm remove ${packageName}`;
                break;
            case 'yarn':
                mainCommand = `yarn remove ${packageName}`;
                break;
            case 'npm':
            default:
                mainCommand = `npm uninstall ${packageName}`;
                break;
        }

        // 如果不需要删除类型定义，直接返回主命令
        if (!hasTypesPackage) {
            return mainCommand;
        }

        // 构建类型定义删除命令
        let typesCommand: string;
        switch (packageManager) {
            case 'pnpm':
                typesCommand = `pnpm remove ${typesPackage}`;
                break;
            case 'yarn':
                typesCommand = `yarn remove ${typesPackage}`;
                break;
            case 'npm':
            default:
                typesCommand = `npm uninstall ${typesPackage}`;
                break;
        }

        // 使用 && 连接两个命令
        return `${mainCommand} && ${typesCommand}`;
    }

    /**
     * 检查类型定义包是否存在
     */
    private static async checkTypesPackageExists(
        packageManager: PackageManager,
        packageName: string,
        cwd: string
    ): Promise<boolean> {
        const typesPackage = `@types/${packageName}`;

        try {
            const checkCommand =
                packageManager === 'npm'
                    ? `npm view ${typesPackage} version`
                    : packageManager === 'pnpm'
                    ? `pnpm view ${typesPackage} version`
                    : `yarn info ${typesPackage} version`;

            await execAsync(checkCommand, { cwd });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 在终端中执行命令并自动关闭
     */
    private static async executeInTerminal(
        cwd: string,
        command: string,
        packageManager: PackageManager
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            // 创建终端
            const terminal = vscode.window.createTerminal({
                name: `FePilot Package Installer (${packageManager})`,
                cwd: cwd,
            });

            // 显示终端
            terminal.show();

            // 监听终端关闭事件
            const disposable = vscode.window.onDidCloseTerminal(closedTerminal => {
                if (closedTerminal === terminal) {
                    disposable.dispose();
                    resolve();
                }
            });

            // 执行命令
            terminal.sendText(command);

            // 设置超时，防止终端一直不关闭
            setTimeout(() => {
                try {
                    terminal.dispose();
                    disposable.dispose();
                    resolve();
                } catch (error) {
                    reject(error);
                }
            }, 30000); // 30秒超时
        });
    }

    /**
     * 使用 VS Code Task 执行命令
     */
    private static async executeWithTask(
        cwd: string,
        command: string,
        packageManager: PackageManager
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            // 创建任务定义
            const task = new vscode.Task(
                {
                    type: 'shell',
                    command: command.split(' ')[0], // 提取命令名
                },
                vscode.TaskScope.Workspace,
                `FePilot: Install Package (${packageManager})`,
                'FePilot',
                new vscode.ShellExecution(command, {
                    cwd: cwd,
                })
            );

            // 设置任务属性
            task.group = vscode.TaskGroup.Build;
            task.presentationOptions = {
                echo: true,
                reveal: vscode.TaskRevealKind.Always,
                focus: false,
                panel: vscode.TaskPanelKind.Shared,
                showReuseMessage: true,
                clear: false,
            };

            // 监听任务执行完成
            const disposable = vscode.tasks.onDidEndTaskProcess(e => {
                if (e.execution.task === task) {
                    disposable.dispose();
                    if (e.exitCode === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Task failed with exit code: ${e.exitCode}`));
                    }
                }
            });

            // 执行任务
            vscode.tasks.executeTask(task);

            // 设置超时保护
            setTimeout(() => {
                disposable.dispose();
                resolve(); // 超时后也认为完成，避免卡死
            }, 30000); // 30秒超时
        });
    }
}

export function getWebviewOptions(_extensionUri: vscode.Uri): vscode.WebviewOptions {
    return {
        enableScripts: true,
    };
}

export function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * Manages NPM search webview panels
 */
export class NpmSearchPanel {
    /**
     * Track the currently panel. Only allow a single panel to exist at a time.
     */
    public static currentPanel: NpmSearchPanel | undefined;

    public static readonly viewType = 'npmSearch';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (NpmSearchPanel.currentPanel) {
            NpmSearchPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            NpmSearchPanel.viewType,
            'NPM Package Search',
            column || vscode.ViewColumn.One,
            {
                ...getWebviewOptions(extensionUri),
                retainContextWhenHidden: true,
            }
        );

        NpmSearchPanel.currentPanel = new NpmSearchPanel(panel, extensionUri);
    }

    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        NpmSearchPanel.currentPanel = new NpmSearchPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Update the content based on view changes
        this._panel.onDidChangeViewState(
            () => {
                if (this._panel.visible) {
                    this._update();
                }
            },
            null,
            this._disposables
        );

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'search':
                        this._searchPackages(message.text);
                        return;
                    case 'openUrl':
                        this._openUrl(message.url);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    private _searchPackages(searchTerm: string) {
        if (searchTerm.trim()) {
            const searchUrl = `https://www.npmjs.com/search?q=${encodeURIComponent(searchTerm)}`;
            this._openUrl(searchUrl);
        }
    }

    private async _openUrl(url: string) {
        try {
            await vscode.env.openExternal(vscode.Uri.parse(url));
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open URL: ${error}`);
        }
    }

    public dispose() {
        NpmSearchPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NPM Package Search</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 40px;
            height: 100vh;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        .container {
            text-align: center;
            max-width: 600px;
        }
        .header {
            margin-bottom: 40px;
        }
        .search-container {
            display: flex;
            gap: 10px;
            margin-bottom: 30px;
        }
        input[type="text"] {
            flex: 1;
            padding: 12px 16px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 6px;
            font-size: 16px;
        }
        input[type="text"]:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        button {
            padding: 12px 24px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .quick-links {
            display: flex;
            gap: 15px;
            margin-bottom: 30px;
            flex-wrap: wrap;
            justify-content: center;
        }
        .quick-link {
            padding: 10px 20px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            text-decoration: none;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .quick-link:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .description {
            color: var(--vscode-descriptionForeground);
            margin-bottom: 30px;
            line-height: 1.6;
        }
        .icon {
            font-size: 48px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="icon">🔍</div>
            <h2>NPM Package Search</h2>
            <p class="description">
                Search and browse npm packages directly in VS Code's built-in browser. 
                Click any button below to open the corresponding page.
            </p>
        </div>
        
        <div class="search-container">
            <input type="text" id="searchInput" placeholder="Enter package name to search..." onkeypress="handleKeyPress(event)">
            <button onclick="searchPackages()">Search</button>
        </div>
        
        <div class="quick-links">
            <a class="quick-link" onclick="openUrl('https://www.npmjs.com/')">🏠 NPM Home</a>
            <a class="quick-link" onclick="openUrl('https://www.npmjs.com/browse/star')">⭐ Popular Packages</a>
            <a class="quick-link" onclick="openUrl('https://www.npmjs.com/browse/depended')">📈 Trending</a>
            <a class="quick-link" onclick="openUrl('https://www.npmjs.com/browse/updated')">🆕 New Packages</a>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        function searchPackages() {
            const searchTerm = document.getElementById('searchInput').value.trim();
            if (searchTerm) {
                const searchUrl = \`https://www.npmjs.com/search?q=\${encodeURIComponent(searchTerm)}\`;
                openUrl(searchUrl);
            }
        }
        
        function handleKeyPress(event) {
            if (event.key === 'Enter') {
                searchPackages();
            }
        }
        
        function openUrl(url) {
            vscode.postMessage({
                command: 'openUrl',
                url: url
            });
        }
    </script>
</body>
</html>`;
    }
}
