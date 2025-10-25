import * as vscode from 'vscode';

export class UpdateService {
    private static instance: UpdateService;
    private context: vscode.ExtensionContext;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public static getInstance(context: vscode.ExtensionContext): UpdateService {
        if (!UpdateService.instance) {
            UpdateService.instance = new UpdateService(context);
        }
        return UpdateService.instance;
    }

    /**
     * Check for extension updates
     */
    public async checkForUpdates(): Promise<void> {
        const config = vscode.workspace.getConfiguration('fePilot');
        const autoUpdate = config.get<boolean>('autoUpdate', true);
        const checkForUpdates = config.get<boolean>('checkForUpdates', true);

        if (!autoUpdate || !checkForUpdates) {
            return;
        }

        try {
            const extension = vscode.extensions.getExtension('rosendolu.fe-pilot');
            if (!extension) {
                return;
            }

            // Check if there's a newer version available
            const latestVersion = await this.getLatestVersion();
            const currentVersion = extension.packageJSON.version;

            if (this.isNewerVersion(latestVersion, currentVersion)) {
                this.showUpdateNotification(latestVersion, currentVersion);
            }
        } catch (error) {
            console.error('Error checking for updates:', error);
        }
    }

    /**
     * Get the latest version from GitHub releases
     */
    private async getLatestVersion(): Promise<string> {
        try {
            const response = await fetch(
                'https://api.github.com/repos/rosendolu/FePilot/releases/latest'
            );
            const data = (await response.json()) as { tag_name: string };
            return data.tag_name.replace('v', ''); // Remove 'v' prefix if present
        } catch (error) {
            console.error('Error fetching latest version:', error);
            return '0.0.0';
        }
    }

    /**
     * Compare version strings
     */
    private isNewerVersion(latest: string, current: string): boolean {
        const latestParts = latest.split('.').map(Number);
        const currentParts = current.split('.').map(Number);

        for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
            const latestPart = latestParts[i] || 0;
            const currentPart = currentParts[i] || 0;

            if (latestPart > currentPart) {
                return true;
            } else if (latestPart < currentPart) {
                return false;
            }
        }

        return false;
    }

    /**
     * Show update notification to user
     */
    private showUpdateNotification(latestVersion: string, currentVersion: string): void {
        const message = `FePilot update available: ${currentVersion} → ${latestVersion}`;
        const action = 'Update Now';
        const dismiss = 'Later';

        vscode.window.showInformationMessage(message, action, dismiss).then(selection => {
            if (selection === action) {
                this.openUpdatePage();
            }
        });
    }

    /**
     * Open the extension update page
     */
    private openUpdatePage(): void {
        vscode.commands.executeCommand(
            'vscode.open',
            vscode.Uri.parse(
                'https://marketplace.visualstudio.com/items?itemName=rosendolu.fe-pilot'
            )
        );
    }

    /**
     * Initialize the update service
     */
    public initialize(): void {
        // Check for updates on startup
        this.checkForUpdates();

        // Check for updates periodically (every 24 hours)
        setInterval(() => {
            this.checkForUpdates();
        }, 24 * 60 * 60 * 1000);
    }
}
