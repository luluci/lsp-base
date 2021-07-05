

export class Config {
	public inputPath: string;
	
	constructor() {
		this.inputPath = "";
	}

	public init(conf: any) {
		this.inputPath = conf.lspbase.path.input;
	}

	public getConf(): string {
		let result: string = "conf:";
		result += this.inputPath;
		return result;
	}
}

export let config = new Config();
