import * as vscode from 'vscode';
import { NodeDependenciesView } from './views/node-dependencies';

export function activate(context: vscode.ExtensionContext) {
    // Initialize Node Dependencies View
    new NodeDependenciesView(context);

    // Initialize auto-update service
    // const updateService = UpdateService.getInstance(context);
    // updateService.initialize();

    // // Register manual update check command
    // vscode.commands.registerCommand('fePilot.checkForUpdates', () => {
    //     updateService.checkForUpdates();
    // });
}
