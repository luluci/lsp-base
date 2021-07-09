"use strict";

import * as vscode from 'vscode';
import * as path from "path";
import { ExtensionContext, window as Window } from "vscode";
import { LanguageClient, LanguageClientOptions, RevealOutputChannelOn, ServerOptions, TransportKind } from "vscode-languageclient";

let clients: LanguageClient[] = [];
let promises: Thenable<void>[] = [];

export function activate(context: ExtensionContext): void {

	context.subscriptions.push(
		vscode.commands.registerCommand('lsp-base.start', () => {
			if (clients.length > 0) {
				stopClients();
			}
			startClient(context);
		})
	);

	startClient(context);
}

export function deactive(): Thenable<void> {
	//
	stopClients();
	//
	return Promise.all(promises).then(() => undefined);
}

function startClient(context: ExtensionContext) {
	const serverModule = context.asAbsolutePath(path.join("server", "out", "server.js"));
	const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"], cwd: process.cwd() };
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc, options: { cwd: process.cwd() } },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions,
		},
	};
	// https://code.visualstudio.com/api/references/activation-events
	const clientOptions: LanguageClientOptions = {
		documentSelector: [
			{
				scheme: "file",
				language: "plaintext",
			},
			{
				scheme: "file",
				language: "c",
			},
			{
				scheme: "file",
				language: "cpp",
			},
			{
				scheme: "file",
				language: "markdown",
			}],
		diagnosticCollectionName: "sample",
		revealOutputChannelOn: RevealOutputChannelOn.Never,
	};

	let client: LanguageClient;
	try {
		client = new LanguageClient("Sample LSP Server", serverOptions, clientOptions);
	} catch (err) {
		Window.showErrorMessage("The extension couldn't be started. See the output channel for details.");

		return;
	}
	client.registerProposedFeatures();
	client.start();
	clients.push(client);
}

function stopClients() {
	// clientをすべて終了
	for (let client of clients) {
		promises.push(client.stop());
	}
	//
	clients = [];
}
