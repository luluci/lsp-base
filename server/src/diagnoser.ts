"use strict";

import * as fs from 'fs';
import * as path from 'path';
import {
	Diagnostic,
	DiagnosticSeverity,
	Range,
	WorkspaceFolder,
	WorkspaceFoldersChangeEvent,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from 'vscode-uri';
import * as iconv from 'iconv-lite';

import { config } from './config';

interface IConsole {
	error(message: string): void;
	warn(message: string): void;
	info(message: string): void;
	log(message: string): void;
}
class DummyConsole implements IConsole {
	public error(message: string): void {
		// dummy
		message;
	}
	public warn(message: string): void {
		// dummy
		message;
	}
	public info(message: string): void {
		// dummy
		message;
	}
	public log(message: string): void {
		// dummy
		message;
	}
}
let console: IConsole = new DummyConsole();

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
	public relPath: string;
	public data: string;
	public diagnos: DiagnosNode[];
	// 
	private _isLoading: Promise<void>[];

	constructor(relPath:string) {
		this.relPath = relPath;
		this.data = '';
		this.diagnos = new Array<DiagnosNode>();
		//
		this._isLoading = [];
	}

	public loadInput(inputFile: string) {
		this._isLoading.push(this._loadInput(inputFile));
	}

	private async _loadInput(inputFile: string) {
		//const content = await fs.promises.readFile(this.absPath, { encoding: 'utf8' });
		//const lines = content.split(/\r\n|\n/);
		const content = await fs.promises.readFile(inputFile);
		const buffer = iconv.decode(content, "sjis");
		const lines = buffer.split(/\r\n|\n/);
		// tsv解析
		for (const line of lines) {
			const diag = new DiagnosNode(line);
			if (diag.line) {
				this.diagnos.push(diag);
			}
		}
	}

	public clearDiagnostic() {
		this.diagnos = [];
	}

	public async waitLoading() {
		await Promise.all(this._isLoading).then(()=>{ undefined });
		this._isLoading = [];
	}

	public async getDiagnostic(doc: TextDocument) {
		doc;
		// 入力ファイルの読み込みが終わったらDiagnosticを作成する
		await this.waitLoading();
		//
		const diagnostics: Diagnostic[] = [];
		for (const diag of this.diagnos) {
			const range: Range = {
				start: { line: diag.line!, character: diag.start! },
				end: { line: diag.line!, character: diag.end! }
			};
			diagnostics.push(Diagnostic.create(range, diag.message!, DiagnosticSeverity.Warning, "", "lsp-base"));
		}
		return diagnostics;
	}
}

export class WorkspaceInfo {
	public rootPathStr: string;
	public rootPath: URI;
	// 
	public enableInput: boolean;
	public inputPaths: string[];
	public inputFiles: Map<string,FileInfo>;

	constructor(wsPath: URI) {
		this.rootPath = wsPath;
		this.rootPathStr = wsPath.fsPath;
		// 
		this.inputFiles = new Map<string, FileInfo>();
		// インプットファイルディレクトリへのパスを作成
		this.inputPaths = Array<string>();
		this.enableInput = false;
		this._checkInputFileDir();
	}

	private _checkInputFileDir() {
		// 再帰にしないように配列に探索ディレクトリを追加
		let dirs = new Array<string>();
		dirs.push(this.rootPathStr);
		// ディレクトリチェックパターン
		const dirRegexStr = path.join(this.rootPathStr, config.inputPath).replace(/\\/g, '\\\\');
		const dirRegex = new RegExp(dirRegexStr)
		// 探索ディレクトリを順次チェック
		for (let dirnum = 0; dirnum < dirs.length; dirnum++) {
			// ディレクトリ内のディレクトリ/ファイルを取得
			const dirents = fs.readdirSync(dirs[dirnum], { encoding: 'utf8', withFileTypes: true });
			const basedir = dirs[dirnum];
			// リストを全部チェック
			for (const dirent of dirents) {
				// 相対パスと絶対パスを作成
				const newpath = path.join(basedir, dirent.name);
				if (dirent.isDirectory()) {
					// ディレクトリならインプットファイルディレクトリチェック
					if (dirRegex.test(newpath)) {
						// インプットファイルディレクトリなら存在チェック
						if (fs.existsSync(newpath)) {
							// インプットファイルディレクトリが存在するならロードする
							this.inputPaths.push(newpath);
							this._loadInputFiles(newpath);
							this.enableInput = true;
						}
					} else {
						// インプットファイルディレクトリでないなら配下ディレクトリを探索
						dirs.push(newpath);
					}
				}
			}
		}
	}

	private _loadInputFiles(inputPath: string) {
		// 再帰にしないように配列に探索ディレクトリを追加
		let dirs = new Array<string>();
		let reldirs = new Array<string>();
		dirs.push(inputPath);
		reldirs.push('');
		// 探索ディレクトリを順次チェック
		for (let dirnum = 0; dirnum < dirs.length; dirnum++) {
			// ディレクトリ内のディレクトリ/ファイルを取得
			const dirents = fs.readdirSync(dirs[dirnum], { encoding:'utf8', withFileTypes:true });
			const basedir = reldirs[dirnum];
			// リストを全部チェック
			for (const dirent of dirents) {
				// 相対パスと絶対パスを作成
				const newrel = path.join(basedir, dirent.name);
				const newpath = path.join(inputPath, newrel);
				const ext = path.extname(dirent.name);
				const key = path.join(basedir, path.basename(dirent.name, ext));
				if (dirent.isDirectory()) {
					// ディレクトリなら配列に追加してチェック待ち
					dirs.push(newpath);
					reldirs.push(newrel);
				} else if (dirent.isFile()) {
					if (ext === config.inputExt) {
						// 読み込み対象ファイルなら
						let finfo = this.inputFiles.get(key);
						if (finfo === undefined) {
							// FileInfo未作成なら作成
							// ファイルリストに登録
							finfo = new FileInfo(newrel);
							this.inputFiles.set(key, finfo);
						}
						// インプットファイルロード
						finfo.loadInput(newpath);
					}
				}
			}
		}
	}

	public reload() {
		for (const fileinf of this.inputFiles) {
			fileinf[1].clearDiagnostic();
		}
		this._checkInputFileDir();
	}

	public hasDiagnostic(path: URI): boolean {
		// インプットファイルを読み込めていなければ不可
		if (!this.enableInput) return false;
		// インプットファイルディレクトリ配下のファイルは対象外
		for (const inputDir of this.inputPaths) {
			if (path.fsPath.indexOf(inputDir) === 0) return false;
		}
		// workspace配下のファイルを対象とする
		return (path.fsPath.indexOf(this.rootPathStr) === 0);
	}

	public async getDiagnostic(doc: TextDocument, uri: URI) {
		// 相対パスを取得
		const rel = path.relative(this.rootPathStr, uri.fsPath);
		// ファイル存在チェック
		const key = path.join(path.dirname(rel), path.basename(rel, path.extname(rel)));
		const file = this.inputFiles.get(key);
		if (file) {
			console.log(`Start load Diagnostic from ${key}`);
			return file.getDiagnostic(doc);
		} else {
			console.log(`File not found: ${key}`);
			return null;
		}
	}

}


export class Diagnoser {
	private _wsInfo: Map<URI, WorkspaceInfo>;
	
	constructor() {
		this._wsInfo = new Map<URI, WorkspaceInfo>();
	}

	public init<T extends IConsole>(c: T){
		console = c;
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
			const uri = URI.parse(ws.uri);
			this._wsInfo.delete(uri);
		}
	}

	private _addWorkspaces(wss: WorkspaceFolder[]) {
		for (const ws of wss) {
			// WorkspaceInfoインスタンス作成
			const uri = URI.parse(ws.uri);
			const wsInfo = new WorkspaceInfo(uri);
			this._wsInfo.set(uri, wsInfo);
		}
	}

	public reload() {
		// インプットファイルを再読み込み
		for (const ws of this._wsInfo) {
			ws[1].reload();
		}
	}

	public async validate(doc: TextDocument) {
		for (const ws of this._wsInfo) {
			const uri = URI.parse(doc.uri);
			if (ws[1].hasDiagnostic(uri)) {
				return ws[1].getDiagnostic(doc, uri);
			}
		}
		return null;
	}
}
