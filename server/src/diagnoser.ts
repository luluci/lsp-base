"use strict";

import * as fs from 'fs';
import { posix } from 'path';
import {
	Diagnostic,
	DiagnosticSeverity,
	Range,
	WorkspaceFolder,
	WorkspaceFoldersChangeEvent,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from 'vscode-uri';

import { config } from './config';


class DiagnosNode {
	public line?: number;
	public start?: number;
	public end?: number;
	public message?: string;

	constructor(line: string) {
		const parts = line.split('\t');
		if (parts.length >= 3) {
			this.line = parseInt(parts[0], 10);
			this.start = parseInt(parts[1], 10);
			this.end = this.start;
			this.message = parts[2];
		}
	}
}


class FileInfo {
	public absPath: string;
	public relPath: string;
	public data: string;
	public diagnos: Map<number, DiagnosNode>;
	// 
	private _isLoading: Promise<void>;

	constructor(absPath:string, relPath:string) {
		this.absPath = absPath;
		this.relPath = relPath;
		this.data = '';
		this.diagnos = new Map<number, DiagnosNode>();
		//
		this._isLoading = this._readInput();
	}

	private async _readInput() {
		const self = this;
		fs.readFile(this.absPath, { encoding:'utf8' }, (err,data)=>{
			if (err) {
				//
				throw err;
			} else {
				// tsv解析
				const lines = data.split(/\r\n|\n/);
				for (const line of lines) {
					const diag = new DiagnosNode(line);
					if (diag.line) {
						self.diagnos.set(diag.line, diag);
					}
				}
			}
		});
	}

	public async getDiagnostic() {
		// 入力ファイルの読み込みが終わったらDiagnosticを作成する
		await this._isLoading;
		//
		const diagnostics: Diagnostic[] = [];
		for (const diag of this.diagnos) {
			const range: Range = {
				start: { line: diag[1].line!, character: diag[1].start! },
				end: { line: diag[1].line!, character: diag[1].end! }
			};
			diagnostics.push(Diagnostic.create(range, diag[1].message!, DiagnosticSeverity.Warning, "", "lsp-base"));
		}
		return diagnostics;
	}
}

export class WorkspaceInfo {
	public rootPathStr: string;
	public rootPath: URI;
	// 
	public enableInput: boolean;
	public inputPathStr: string;
	public inputPath: URI;
	public inputFiles: Map<string,FileInfo>;

	constructor(wsPath: string) {
		this.rootPathStr = wsPath;
		this.rootPath = URI.parse(wsPath);
		// 
		this.inputFiles = new Map<string, FileInfo>();
		//
		this.inputPathStr = posix.join(wsPath, config.inputPath);
		this.inputPath = URI.parse(this.inputPathStr);
		if (fs.existsSync(this.inputPath.fsPath)) {
			this.enableInput = true;
			this._loadInputFiles();
		} else {
			this.enableInput = false;
		}
	}

	private _loadInputFiles() {
		// 再帰にしないように配列に探索ディレクトリを追加
		let dirs = new Array<string>();
		let reldirs = new Array<string>();
		dirs.push(this.inputPath.fsPath);
		reldirs.push('');
		// 探索ディレクトリを順次チェック
		for (let dirnum = 0; dirnum < dirs.length; dirnum++) {
			// ディレクトリ内のディレクトリ/ファイルを取得
			const dirents = fs.readdirSync(dirs[dirnum], { encoding:'utf8', withFileTypes:true });
			const basedir = reldirs[dirnum];
			// リストを全部チェック
			for (const dirent of dirents) {
				// 相対パスと絶対パスを作成
				const newrel = posix.join(basedir, dirent.name);
				const newpath = posix.join(this.inputPath.fsPath, newrel);
				const key = posix.join(basedir, posix.basename(dirent.name, posix.extname(dirent.name)));
				if (dirent.isDirectory()) {
					// ディレクトリなら配列に追加してチェック待ち
					dirs.push(newpath);
					reldirs.push(newrel);
				} else if (dirent.isFile()) {
					// ファイルならファイルリストに登録
					this.inputFiles.set(key, new FileInfo(newpath, newrel));
				}
			}
		}
	}

	public isChild(path: string) {
		return (path.indexOf(this.rootPathStr) === 0);
	}

	public async getDiagnostic(path: string) {
		// 相対パスを取得
		const rel = posix.relative(this.rootPathStr, path);
		// ファイル存在チェック
		const key = posix.join(posix.dirname(rel), posix.basename(rel, posix.extname(rel)));
		const file = this.inputFiles.get(key);
		if (file) {
			return file.getDiagnostic();
		} else {
			return null;
		}
	}

	public dbgGetList(): string {
		let result = '';
		let first = true;
		for (const file of this.inputFiles) {
			if (first) {
				result += `${file[0]}[${file[1].data}]`;
				first = false;
			} else {
				result += `, ${file[0]}[${file[1].data}]`;
			}
		}
		return result;
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
			if (ws[1].enableInput) {
				if (first) {
					result += `${ws[1].inputPath.fsPath}(${ws[1].dbgGetList()})`;
					first = false;
				} else {
					result += `, ${ws[1].inputPath.fsPath}(${ws[1].dbgGetList()})`;
				}
			} else {
				if (first) {
					result += "NoInput!";
					first = false;
				} else {
					result += `, NoInput!`;
				}
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
			// WorkspaceInfoインスタンス作成
			const wsInfo = new WorkspaceInfo(ws.uri);
			this._wsInfo.set(ws.uri, wsInfo);
		}
	}

	public async validate(doc: TextDocument) {
		for (const ws of this._wsInfo) {
			if (ws[1].isChild(doc.uri)) {
				return ws[1].getDiagnostic(doc.uri);
			}
		}
		return null;
	}
}
