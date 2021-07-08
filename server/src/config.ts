

export class Config {
	public inputPath: string;
	public inputExt: string;
	
	constructor() {
		this.inputPath = "";
		this.inputExt = "";
	}

	public init(conf: any) {
		this.inputPath = conf.lspbase.input.path;
		this.inputExt = conf.lspbase.input.ext;
	}

}

export let config = new Config();
