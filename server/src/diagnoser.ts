"use strict";

import {
	WorkspaceFolder,
	WorkspaceFoldersChangeEvent,
} from "vscode-languageserver";
import { URI } from 'vscode-uri';

//import { config } from './config';


export class WorkspaceInfo {
	public rootPath: URI;

	constructor(wsPath: string) {
		this.rootPath = URI.parse(wsPath);
	}
}


export class Diagnoser {
	private _wsInfo: Map<string, WorkspaceInfo>;
	
	constructor() {
		this._wsInfo = new Map<string, WorkspaceInfo>();
	}

	public getWSListStr(): string {
		let result = "workspace:";
		let first = true;
		for (const ws of this._wsInfo) {
			if (first) {
				result += ws[1].rootPath.fsPath;
				first = false;
			} else {
				result += `, ${ws[1].rootPath.fsPath}`;
			}
		}
		return result;
	}

	public initWorkspaces(wss: WorkspaceFolder[]) {
		this._addWorkspaces(wss);
	}

	public changeWorkspaces(event: WorkspaceFoldersChangeEvent) {
		this._deleteWorkspaces(event.removed);
		this._addWorkspaces(event.added);
	}

	private _deleteWorkspaces(wss: WorkspaceFolder[]) {
		for (const ws of wss) {
			this._wsInfo.delete((ws.uri));
		}
	}

	private _addWorkspaces(wss: WorkspaceFolder[]) {
		for (const ws of wss) {
			this._wsInfo.set(ws.uri, new WorkspaceInfo(ws.uri));
		}
	}

}
