import * as vscode from "vscode";
import { DebugTracker } from "./debugTracker";

let tracker: DebugTracker | undefined;

export function activate(context: vscode.ExtensionContext) {
  const startDisposable = vscode.commands.registerCommand(
    "extension.startLogging",
    () => {
      if (tracker) {
        vscode.window.showWarningMessage("Logging already in progress.");
        return;
      }
      tracker = new DebugTracker(context);
      tracker.start();
    }
  );

  const stopDisposable = vscode.commands.registerCommand(
    "extension.stopLogging",
    async () => {
      if (!tracker) {
        vscode.window.showWarningMessage("No active logging session.");
        return;
      }
      await tracker.stopAndSave();
      tracker = undefined;
    }
  );

  context.subscriptions.push(startDisposable, stopDisposable);
}

export function deactivate() {
  // Clean up if the user reloads the window while logging
  tracker?.dispose();
}