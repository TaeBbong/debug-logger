import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class DebugTracker {
  private logs: string[] = [];
  private step = 0;

  constructor(private ctx: vscode.ExtensionContext) {}

  factory: vscode.DebugAdapterTrackerFactory = {
    createDebugAdapterTracker: (session: vscode.DebugSession) => {
      return {
        // 디버그 어댑터가 IDE로 보내는 메시지를 들음
        onDidSendMessage: async (msg: any) => {
          if (msg.event === 'stopped') {
            // 가장 위 스택프레임 하나만 가져옴
            const { threadId } = msg.body;
            const stack = await session.customRequest('stackTrace', {
              threadId,
              startFrame: 0,
              levels: 1
            });
            const frame = stack.stackFrames[0];
            await this.captureFrame(frame);
          }
        }
      };
    }
  };

  private async captureFrame(frame: any) {
    const { source, line } = frame;
    if (!source?.path) return;
    try {
      const doc = await vscode.workspace.openTextDocument(source.path);
      const code = doc.lineAt(line - 1).text;
      const lang = path.extname(source.path).substring(1) || '';
      this.step += 1;
      this.logs.push(
        `### 🪵 Step ${this.step}: ${source.name}:${line}\n\n` +
          '```' +
          lang +
          `\n${code}\n\`\`\`\n`
      );
    } catch (err) {
      console.error(err);
    }
  }

  flushToFile() {
    if (!this.logs.length) {
      vscode.window.showWarningMessage('No debug steps captured.');
      return;
    }
    const md = this.logs.join('\n---\n');
    const fileName = `debug-log-${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')}.md`;
    const outDir = this.ctx.globalStorageUri.fsPath;
    fs.mkdirSync(outDir, { recursive: true });
    const fullPath = path.join(outDir, fileName);
    fs.writeFileSync(fullPath, md, 'utf8');
    vscode.window.showInformationMessage(`Debug log saved → ${fullPath}`);
  }
}
