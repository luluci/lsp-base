

export class Config {
	private _inputPath: string;
	
	constructor() {
		this._inputPath = "";
	}

	public init(conf: any) {
		this._inputPath = conf.lspbase.path.input;
	}

	public getConf(): string {
		let result: string = "conf:";
		result += this._inputPath;
		return result;
	}
}
