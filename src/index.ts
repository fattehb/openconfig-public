//import { YangModel, YangInstance, YangProperty } from 'yang-js';
var Yang = require('yang-js');
import { FortiGateAPIRequests } from './fortigateApiRequests';
import { GnmiProtoHandlers } from './GnmiProtoHandlers';

import https from 'https';
import http from 'http';
import * as fs from 'fs';
const listenOnPort = 6031;
const tls = require('tls');
var grpc = require('grpc');
var protoLoader = require('@grpc/proto-loader');
var PROTO_PATH = __dirname + '/gnmi/proto/gnmi/gnmi.proto';
//var PROTO_PATH = __dirname + '/protos/gnmi.proto';

var packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
var hello_proto = grpc.loadPackageDefinition(packageDefinition).gnmi;
const { FORTIGATE_API_KEY, FORTIGATE_IP, POLL_INTERVAL } = process.env;

exports.main = async (context, req, res): Promise<void> => {
    console.log('Function Started');
    let yangImportList = [
        '../public/third_party/ietf/ietf-interfaces.yang',
        '../public/release/models/types/openconfig-yang-types.yang',
        '../public/release/models/types/openconfig-types.yang',
        '../public/release/models/openconfig-extensions.yang',
        '../public/release/models/interfaces/openconfig-interfaces.yang'
    ];
    //TODO: look into importing in JSON file. The following does not create a refernceable model.
    for (let i in yangImportList) {
        var imports = Yang.import(i);
        console.log(`importing: ${yangImportList[i]}`);
    }
    // Must be imported in the correct order.
    const importTest = Yang.import('../public/third_party/ietf/ietf-interfaces.yang');
    const openconfig_yang_types_model = Yang.import('../public/release/models/types/openconfig-yang-types.yang');
    const openconfig_type_model = Yang.import('../public/release/models/types/openconfig-types.yang');
    const openconfig_extensions_model = Yang.import('../public/release/models/openconfig-extensions.yang');
    const openconfig_iterfances_model = Yang.import('../public/release/models/interfaces/openconfig-interfaces.yang');

    const schema = Yang(openconfig_iterfances_model);

    var schema = Yang.parse();

    //console.log(model);
    //console.log(schema);
    const openConfigInterpreter = new OpenConfigInterpreter(5000, FORTIGATE_IP, FORTIGATE_API_KEY);
    const gRPCServiceHandler = new GnmiProtoHandlers(5000, FORTIGATE_IP, FORTIGATE_API_KEY);
    //let getInterface = await openConfigInterpreter.pollFortigate('/api/v2/cmdb/system/interface');
    //let postInterface = await openConfigInterpreter.postConfig('/api/v2/cmdb/system/interface');

    //TODO: remove. Test set headers
    let testHeaders = { name: 'port1', alias: 'test3' };
    let putInterface = await openConfigInterpreter.putConfig('/api/v2/cmdb/system/interface/port1', testHeaders);
    let getInterfaceTest = await openConfigInterpreter.getRequest('/api/v2/cmdb/system/interface/port1', testHeaders);

    //console.log(JSON.stringify(getInterface));
    console.log(putInterface);
    // console.log('getRequest test: ', JSON.stringify(getInterfaceTest));

    //gRPC
    //const grpcServer = new grpc.Server();
    var server = new grpc.Server();

    //var stub = new helloworld.Greeter('myservice.example.com', ssl_creds);
    //TODO: move into seperate class.
    server.addService(hello_proto.gNMI.service, {
        Get: gRPCServiceHandler.Get,
        Set: gRPCServiceHandler.Set,
        Capabilities: gRPCServiceHandler.Capabilities,
        Subscribe: gRPCServiceHandler.Subscribe
    });
    //server.addService(hello_proto.apiInterpreter.service, { listFeatures: openConfigInterpreter.listFeature });
    //TODO add auth
    server.bind('0.0.0.0:' + listenOnPort, grpc.ServerCredentials.createInsecure());
    server.start();
    console.log(`Server listening to traffic on ${listenOnPort}`);

    // res.writeHead(200, { 'Content-Type': 'text/plain' });
    // res.write(putInterface);
    // res.end();
    // })
    // .listen(listenOnPort);
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

    public async putInterface(call, callback) {
        console.log('called putInterface');
    }

    public translatePath(pathRequest) {
        //TODO:
        let fullPath;
        //TODO:seperate for get/set/sub
        console.log('Path Request' + JSON.stringify(pathRequest));
        //Assume sub ATM
        if (pathRequest.elem[0].name === 'interfaces') {
            //TODO: error check.
            let cmdbPath = '/api/v2/cmdb/system/interface/';
            let interfaceValue = pathRequest.elem[1].key.name;
            fullPath = cmdbPath + interfaceValue;
        }
        console.log(`Constructed RestAPI Path: ${fullPath}`);

        return fullPath;
    }

    public JoinPathElems(pathElements) {
        console.log('Joining Path');
        for (const item of pathElements.request.path[0].elem) {
            console.log('item ' + item);
        }
    }
    public getFeature(call, callback) {
        callback(null, this.listFeature(call.request, callback));
    }
    //Streaming RPC
    public listFeature(call, callback) {
        console.log('checkFeature');
    }

    public async pollFortigate(path: string, data) {
        let pollFortigate = new FortiGateAPIRequests(path, this.FORTIGATE_IP, this.FORTIGATE_API_KEY, false);
        return await pollFortigate.httpsGetRequest(data);
    }
    public async postConfig(path: string, data) {
        let postConfig = new FortiGateAPIRequests(path, this.FORTIGATE_IP, this.FORTIGATE_API_KEY, false);
        return await postConfig.httpsPostRequest(data);
    }
    public async getRequest(path: string, data) {
        let getRequest = new FortiGateAPIRequests(path, this.FORTIGATE_IP, this.FORTIGATE_API_KEY, false);
        return await getRequest.httpsGetRequest(data);
    }
    public async putConfig(path: string, data) {
        let postConfig = new FortiGateAPIRequests(path, this.FORTIGATE_IP, this.FORTIGATE_API_KEY, false);
        return await postConfig.httpsPutRequest(data);
    }

    public async waitFunction() {
        return new Promise(resolve => setTimeout(resolve, this.POLL_INTERVAL));
    }
    public ConvertRestToYang(modelType, config) {
        //TODO: convert to own class structure
        //Only works with interface for now
    }
}

if (module === require.main) {
    exports.main(console.log);
}
