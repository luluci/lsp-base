"use strict";

//import * as vscode from 'vscode';
import {
	CodeActionKind,
	createConnection,
//	Diagnostic,
//	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
//	Range,
	TextDocuments,
	TextDocumentSyncKind,
	DidChangeConfigurationNotification,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Diagnoser } from './diagnoser';
import { config } from './config';

namespace CommandIDs {
	export const fix = "sample.fix";
}
// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);
connection.console.info(`Sample server running in node ${process.version}`);
//let documents!: TextDocuments<TextDocument>;
let documents = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

let diagnoser = new Diagnoser();

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;
	// Does the client support the `workspace/configuration` request?
	// If not, we will fall back using global settings
	hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
	hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
	hasDiagnosticRelatedInformationCapability =
		!!(capabilities.textDocument &&
			capabilities.textDocument.publishDiagnostics &&
			capabilities.textDocument.publishDiagnostics.relatedInformation);

	return {
		capabilities: {
			textDocumentSync: {
				openClose: true,
				change: TextDocumentSyncKind.Incremental,
				willSaveWaitUntil: false,
				save: {
					includeText: false,
				},
			},
			codeActionProvider: {
				codeActionKinds: [CodeActionKind.QuickFix],
			},
			executeCommandProvider: {
				commands: [CommandIDs.fix],
			},
		},
	};
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		connection.client.register(
			DidChangeConfigurationNotification.type,
			undefined
		);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders((event) => {
			diagnoser.changeWorkspaces(event);
			update();
			connection.console.log('Workspace folder change event received.');
		});
	}
	if (hasDiagnosticRelatedInformationCapability) {
	}

	// 拡張機能周りの設定を初期化
	initExtensionInfo();
});

async function initExtensionInfo () {
	// configuration取得
	if (hasConfigurationCapability) {
		const conf = await connection.workspace.getConfiguration();
		if (conf) {
			//value: vscode.WorkspaceConfiguration;
			config.init(conf);
		}
	}
	// Workspaceを現在フォルダで初期化
	if (hasWorkspaceFolderCapability) {
		const wss = await connection.workspace.getWorkspaceFolders();
		if (wss) {
			diagnoser.initWorkspaces(wss);
		}
	} else {
		// Workspaceの設定が無い場合？　何かで初期化しないと
	}
}

connection.onDidChangeConfiguration((change) => {
	if (change.settings) {
		//change.settings: vscode.WorkspaceConfiguration;
		config.init(change.settings);
		update();
	}
});

/**
 * Diagnoseをすべて更新する
 */
function update() {
	// Revalidate all open text documents
	documents.all().forEach(validate);
}

/**
 * Analyzes the text document for problems.
 * @param doc text document to analyze
 */
async function validate(doc: TextDocument) {
	const diagnostics = await diagnoser.validate(doc);
	if (diagnostics) {
		connection.sendDiagnostics({ uri: doc.uri, diagnostics });
	}
}

documents.listen(connection);

documents.onDidOpen((event) => {
	validate(event.document);
});

documents.onDidChangeContent((change) => {
	validate(change.document);
});

documents.onDidSave((event) => {
	event
});

documents.onDidClose((close) => {
	connection.sendDiagnostics({ uri: close.document.uri, diagnostics: []});
});


// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);
// Listen on the connection
connection.listen();
