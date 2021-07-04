"use strict";

import {
	WorkspaceFolder,
	WorkspaceFoldersChangeEvent,
} from "vscode-languageserver";


export class Diagnoser {
	private _wsInfo: Map<string, WorkspaceFolder>;
	
	constructor() {
		this._wsInfo = new Map<string, WorkspaceFolder>();
	}

	public getWSListStr(): string {
		let result = "workspace:";
		let first = true;
		for (const ws of this._wsInfo) {
			if (first) {
				result += ws[0];
				first = false;
			} else {
				result += `, ${ws[0]}`;
			}
		}
		return result;
	}

	public initWorkspaces(wss: WorkspaceFolder[]) {
		for (const ws of wss) {
			this._wsInfo.set(ws.name, ws);
		}
	}

	public changeWorkspaces(event: WorkspaceFoldersChangeEvent) {
		for (const ws of event.removed) {
			const item = this._wsInfo.get(ws.name);
			if (item) {
				this._wsInfo.delete(ws.name);
			}
			this._wsInfo.set(ws.name, ws);
		}
		for (const ws of event.added) {
			this._wsInfo.set(ws.name, ws);
		}
	}
}
