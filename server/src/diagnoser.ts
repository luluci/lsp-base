"use strict";

import * as fs from 'fs';
import { posix } from 'path';
import {
	WorkspaceFolder,
	WorkspaceFoldersChangeEvent,
} from "vscode-languageserver";
import { URI } from 'vscode-uri';

import { config } from './config';


class FileInfo {
	public absPath: string;
	public relPath: string;
	// 
	private _isLoading: Promise<void>;

	constructor(absPath:string, relPath:string) {
		this.absPath = absPath;
		this.relPath = relPath;
		//
		this._isLoading = Promise.resolve();
	}

	public async getDiagnostic() {
		// 入力ファイルの読み込みが終わったらDiagnosticを作成する
		await this._isLoading;
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
				const newpath = posix.join(this.inputPath.fsPath, newrel)
				if (dirent.isDirectory()) {
					// ディレクトリなら配列に追加してチェック待ち
					dirs.push(newpath);
					reldirs.push(newrel);
				} else if (dirent.isFile()) {
					// ファイルならファイルリストに登録
					this.inputFiles.set(newrel, new FileInfo(newpath, newrel));
				}
			}
		}
	}

	public dbgGetList(): string {
		let result = '';
		let first = true;
		for (const file of this.inputFiles) {
			if (first) {
				result += file[0];
				first = false;
			} else {
				result += `, ${file[0]}`;
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

	public loadInput() {

	}
}
