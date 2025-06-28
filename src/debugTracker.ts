import * as vscode from "vscode";
import { Logger } from "./logger";

export class DebugTracker implements vscode.Disposable {
  private readonly logger: Logger;
  private sessionListener?: vscode.Disposable;
  private stopListener?: vscode.Disposable;

  constructor(private readonly ctx: vscode.ExtensionContext) {
    this.logger = new Logger();
  }

  start() {
    this.logger.start();

    // Attach to the FIRST debug session that starts after the command.
    const onStart = vscode.debug.onDidStartDebugSession((session) => {
      // Subscribe to *stopped* events inside that session
      this.sessionListener = vscode.debug.onDidReceiveDebugSessionCustomEvent(
        async (e) => {
          if (e.session.id !== session.id) return;
          if (e.event === "stopped") {
            await this.captureTopFrame(session, e.body);
          }
        }
      );

      // Auto‑stop when the session ends
      this.stopListener = vscode.debug.onDidTerminateDebugSession((s) => {
        if (s.id === session.id) {
          void this.stopAndSave();
        }
      });

      onStart.dispose(); // Only need the first session
    });

    this.ctx.subscriptions.push(onStart);
  }

  async stopAndSave() {
    await this.logger.saveToMarkdown();
    this.dispose();
  }

  async captureTopFrame(
    session: vscode.DebugSession,
    body: Record<string, unknown>
  ) {
    const threadId = body["threadId"] as number | undefined;
    if (!threadId) {
      return;
    }
    try {
      const stack = await session.customRequest("stackTrace", {
        threadId,
        startFrame: 0,
        levels: 1,
      });
      const frame = stack.stackFrames?.[0];
      if (!frame) return;
      const sourcePath = frame.source?.path;
      const lineNumber = frame.line;

      if (!sourcePath) return;
      const doc = await vscode.workspace.openTextDocument(sourcePath);
      const line = doc.lineAt(lineNumber - 1).text.trim();

      this.logger.addStep({
        file: sourcePath,
        line: lineNumber,
        code: line,
      });
    } catch (err) {
      console.error("Failed to capture frame", err);
    }
  }

  dispose() {
    this.sessionListener?.dispose();
    this.stopListener?.dispose();
  }
}