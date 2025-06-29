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
        onDidSendMessage: async (msg: any) => {
          if (msg.event === 'stopped') {
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

  // src/debugTracker.ts  (클래스 안)

  // 1️⃣ 캡처 함수 교체
  private async captureFrame(frame: any) {
    const { source, line } = frame;
    if (!source?.path) return;

    const doc = await vscode.workspace.openTextDocument(source.path);

    // ── 심볼 트리 가져오기 (DocumentSymbol[])
    const symbols = await vscode.commands.executeCommand<
      vscode.DocumentSymbol[]
    >('vscode.executeDocumentSymbolProvider', doc.uri);

    // 현재 라인을 포함하는 가장 작은 심볼 + 그 부모 이름까지 찾기
    const { node, parents } = findSmallestSymbol(symbols, line - 1) ?? {};
    const funcName = node?.name ?? '(unknown)';
    const className =
    parents && parents.length ? parents[parents.length - 1].name : '';      // 직전 부모 = 클래스/struct 등

    // 코드 블록 = 그 함수 전체, 없으면 ±3라인
    const snippet = node
      ? doc.getText(node.range)
      : doc.getText(
          new vscode.Range(
            Math.max(0, line - 4), 0,
            Math.min(doc.lineCount - 1, line + 2), 1000
          )
        );

    // 실행 줄에 마커 달기
    const marked = snippet
      .split('\n')
      .map((t, idx) =>
        idx + (node ? node.range.start.line : line - 4) === line - 1
          ? `${t}  // ← executed`
          : t
      )
      .join('\n');

    this.step += 1;
    const lang = path.extname(source.path).substring(1);
    const location = className ? `${className}.${funcName}` : funcName;

    this.logs.push(
      `### 🪵 Step ${this.step}: ${source.path}:${line} – ${location}\n\n` +
      '```' + lang + `\n${marked}\n\`\`\`\n`
    );
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

    const workspaceFolder =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    const outDir = path.join(workspaceFolder, '.vscode', 'debug-logs');
    fs.mkdirSync(outDir, { recursive: true });

    const fullPath = path.join(outDir, fileName);
    fs.writeFileSync(fullPath, md, 'utf8');
    vscode.window.showInformationMessage(`Debug log saved → ${fullPath}`);
  }
}

// 2️⃣ 헬퍼 (클래스 바깥!)
function findSmallestSymbol(
  symbols: vscode.DocumentSymbol[] | undefined,
  line: number,
  parents: vscode.DocumentSymbol[] = []
): { node: vscode.DocumentSymbol; parents: vscode.DocumentSymbol[] } | undefined {
  if (!symbols) return;
  for (const sym of symbols) {
    if (sym.range.start.line <= line && line <= sym.range.end.line) {
      // 재귀로 더 깊은 자식 탐색
      const deeper = findSmallestSymbol(sym.children, line, [...parents, sym]);
      return deeper ?? { node: sym, parents };
    }
  }
}
