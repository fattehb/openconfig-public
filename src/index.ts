import { YangModel, YangInstance, YangProperty } from 'yang-js';
import { FortiGateAPIRequests } from './fortigateApiRequests';

const { FORTIGATE_API_KEY, FORTIGATE_IP, POLL_INTERVAL } = process.env;
exports.main = async (context, req, res): Promise<void> => {
    console.log('Function Started');
    const openConfigInterpreter = new OpenConfigInterpreter(5000, FORTIGATE_IP, FORTIGATE_API_KEY);
    let getInterface = await openConfigInterpreter.pollFortigate('/api/v2/cmdb/system/interface');
    console.log(JSON.stringify(getInterface));
};
export class OpenConfigInterpreter {
    private POLL_INTERVAL: number; //milliseconds
    private FORTIGATE_IP: string;
    private FORTIGATE_API_KEY: string;
    private API_KEY: string;

    constructor(POLL_INTERVAL: number, FORTIGATE_IP: string, FORTIGATE_API_KEY: string) {
        this.POLL_INTERVAL = POLL_INTERVAL; //milliseconds
        this.FORTIGATE_IP = FORTIGATE_IP;
        this.FORTIGATE_API_KEY = FORTIGATE_API_KEY;
    }

    public async pollFortigate(path: string) {
        let pollFortigate = new FortiGateAPIRequests(path, this.FORTIGATE_IP, this.FORTIGATE_API_KEY, false);
        return await pollFortigate.httpsGetRequest();
    }
    public async postConfig(path: string) {
        let postConfig = new FortiGateAPIRequests(path, this.FORTIGATE_IP, this.FORTIGATE_API_KEY, false);
        return await postConfig.httpsPostRequest();
    }

    public async waitFunction() {
        return new Promise(resolve => setTimeout(resolve, this.POLL_INTERVAL));
    }
}

if (module === require.main) {
    exports.main(console.log);
}
