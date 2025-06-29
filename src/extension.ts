import * as vscode from 'vscode';
import { DebugTracker } from './debugTracker';

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    'debugLogger.startLogging',
    async () => {
      const tracker = new DebugTracker(context);
      // 모든 디버그 타입(*) 대상
      const reg = vscode.debug.registerDebugAdapterTrackerFactory(
        '*',
        tracker.factory
      );

      // 디버그 세션이 끝나면 파일 저장하고 리스너 해제
      const end = vscode.debug.onDidTerminateDebugSession(() => {
        tracker.flushToFile(); // 마크다운 파일 생성
        reg.dispose();
        end.dispose();
      });

      vscode.window.showInformationMessage('Debug logging started!');
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
