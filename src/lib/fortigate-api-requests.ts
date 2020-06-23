import axios from 'axios';
import https from 'https';
import { log } from '../util/log';

export class FortiGateAPIRequests {
    private path: string;
    private FORTIGATE_IP: string;
    private API_KEY: string;
    private rejectCerts: boolean;
    constructor(path: string, FORTIGATE_IP: string, API_KEY: string, rejectCerts: boolean) {
        this.path = path;
        this.FORTIGATE_IP = FORTIGATE_IP;
        this.API_KEY = API_KEY;
        this.rejectCerts = rejectCerts;
    }
    public async httpsGetRequest(data) {
        const url = `https://${this.FORTIGATE_IP}${this.path}`;
        const agent = new https.Agent({
            rejectUnauthorized: this.rejectCerts
        });
        const options = {
            httpsAgent: agent,
            headers: {
                Authorization: `Bearer ${this.API_KEY}`
            }
        };
        try {
            const response = await axios.get(url, options);
            return response.data;
        } catch (err) {
            log.error(err);
        }
        // TODO: why throwing a console.error here?
        throw console.error(`Error retrieving  data from Fortigate: ${url} `);
    }
    // TODO: change generic axios, with method specified.
    public async httpsPostRequest(data) {
        const url = `https://${this.FORTIGATE_IP}${this.path}`;
        const agent = new https.Agent({
            rejectUnauthorized: this.rejectCerts
        });
        const options = {
            httpsAgent: agent,
            headers: {
                Authorization: `Bearer ${this.API_KEY}`
            }
        };
        try {
            const response = await axios.post(url, data, options);
            return response.data;
        } catch (err) {
            log.error(err);
        }
        // TODO: why throwing a console.error here?
        throw console.error(`Error retrieving data from Fortigate: ${url} `);
    }
    // TODO: consolidate methods.
    public async httpsPutRequest(data) {
        const url = `https://${this.FORTIGATE_IP}${this.path}`;
        const agent = new https.Agent({
            rejectUnauthorized: this.rejectCerts
        });
        const options = {
            httpsAgent: agent,
            headers: {
                Authorization: `Bearer ${this.API_KEY}`
            }
        };
        try {
            const response = await axios.put(url, data, options);
            return response.data;
        } catch (err) {
            log.error(err);
        }
        // TODO: why throwing a console.error here?
        throw console.error(`Error retrieving data from Fortigate: ${url} `);
    }
}
