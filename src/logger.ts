import * as vscode from "vscode";
import * as path from "path";

interface Step {
  file: string;
  line: number;
  code: string;
}

export class Logger {
  private steps: Step[] = [];
  private startTime: Date | undefined;

  start() {
    this.steps = [];
    this.startTime = new Date();
  }

  addStep(step: Step) {
    this.steps.push(step);
  }

  async saveToMarkdown() {
    if (!this.startTime) return;

    const timestamp = this.startTime
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const filename = `debug-log-${timestamp}.md`;

    const md = this.buildMarkdown();

    // Choose workspace root if present, otherwise user home
    const folder =
      vscode.workspace.workspaceFolders?.[0].uri.fsPath ||
      require("os").homedir();
    const filePath = path.join(folder, filename);

    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(filePath),
      Buffer.from(md, "utf8")
    );

    vscode.window.showInformationMessage(`Debug log saved: ${filePath}`);
  }

  private buildMarkdown(): string {
    const lines: string[] = [];
    lines.push(`# 🪵 Debug Log`);
    lines.push(`_Generated: ${new Date().toLocaleString()}_\n`);

    this.steps.forEach((s, idx) => {
      lines.push(`## Step ${idx + 1}: ${path.basename(s.file)}:${s.line}`);
      lines.push("\n```" + this.detectLang(s.file) + "\n" + s.code + "\n```\n");
    });

    return lines.join("\n");
  }

  private detectLang(file: string): string {
    const ext = path.extname(file).toLowerCase();
    switch (ext) {
      case ".ts":
      case ".tsx":
        return "ts";
      case ".js":
      case ".jsx":
        return "js";
      case ".dart":
        return "dart";
      case ".py":
        return "python";
      default:
        return ""; // Unknown → no syntax highlight
    }
  }
}