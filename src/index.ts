//import { YangModel, YangInstance, YangProperty } from 'yang-js';
var Yang = require('yang-js');
import { FortiGateAPIRequests } from './fortigateApiRequests';
import { GnmiProtoHandlers } from './GnmiProtoHandlers';

const listenOnPort = 6031;

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
const importTest = Yang.import('../public/third_party/ietf/ietf-interfaces.yang');
const openconfig_yang_types_model = Yang.import('../public/release/models/types/openconfig-yang-types.yang');
const openconfig_type_model = Yang.import('../public/release/models/types/openconfig-types.yang');
const openconfig_extensions_model = Yang.import('../public/release/models/openconfig-extensions.yang');
const openconfig_interfaces_model = Yang.import('../public/release/models/interfaces/openconfig-interfaces.yang');
exports.main = async (context, req, res): Promise<void> => {
    console.log('Function Started');
    let yangImportList = [
        '../public/third_party/ietf/ietf-interfaces.yang',
        '../public/release/models/types/openconfig-yang-types.yang',
        '../public/release/models/types/openconfig-types.yang',
        '../public/release/models/openconfig-extensions.yang',
        '../public/release/models/interfaces/openconfig-interfaces.yang'
    ];

    for (let i in yangImportList) {
        var imports = Yang.import(i);
        console.log(`importing: ${yangImportList[i]}`);
    }
    console.log('*************Tests******************');
    var model = Yang.parse('container foo { leaf a { type uint8; } }');
    var obj1 = model.eval({ foo: { a: 7 } });
    var getter = obj1.foo.get('a');
    console.log('getter', getter);
    console.log('objA', obj1.foo.a);
    console.log('obj1 ', obj1);
    ///openconfig-interfaces:interfaces/interface/name
    let obj = openconfig_interfaces_model.eval({
        'openconfig-interfaces:interfaces': {
            interface: [
                {
                    name: 'port1',
                    config: {
                        name: 'port1',
                        type: 'IF_ETHERNET'
                    }
                }
            ]
        }
    });
    //console.log(JSON.stringify(openconfig_interfaces_model));
    console.log('obj', JSON.stringify(obj));

    let getAttrubute = obj.get('/interfaces/interface/name');
    console.log('getAttribute: ', getAttrubute);
    //let addtoOpenconfig = openconfig_interfaces_model['openconfig-interfaces'].interfaces.interface.get('name');
    //console.log('addtoOpenConfig ', addtoOpenconfig);

    console.log('schema', openconfig_interfaces_model);
    console.log('*************END TESTS *****************');
    //console.log(JSON.stringify(schema));
    // let networkData = importTest.eval(data);
    //console.log(networkData);

    //console.log(model);
    //console.log(schema_);
    const openConfigInterpreter = new OpenConfigInterpreter(5000, FORTIGATE_IP, FORTIGATE_API_KEY);
    const gRPCServiceHandler = new GnmiProtoHandlers();
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

    public async translatePath(pathRequest) {
        //TODO:Normalize data:

        console.log('pathRequest', JSON.stringify(pathRequest));
        let fullPath = '';
        //SUbscribe shows as:
        //for (const item of pathRequest.path.elem) {
        //Get
        for (const item of pathRequest.path[0].elem) {
            fullPath = fullPath + item.name + '/';
            //TODO account for multiple names etc:
            // if (item.key && item.key.key) {
            //     fullPath = fullPath + '[' + item.key.value + ']';
            // }
            console.log('item ' + JSON.stringify(item));
        }
        //TODO:seperate for get/set/sub
        console.log('Path Request' + JSON.stringify(pathRequest));
        //Assume sub ATM
        // if (pathRequest.elem[0].name === 'interfaces') {
        //     //TODO: error check.
        //     let cmdbPath = '/api/v2/cmdb/system/interface/';
        //     let interfaceValue = pathRequest.elem[1].key.name;
        //     fullPath = cmdbPath + interfaceValue;
        // }
        console.log(`Constructed RestAPI Path: ${fullPath}`);
        switch (fullPath) {
            case 'interfaces/interface/':
                let cmdbPath = '/api/v2/cmdb/system/interface/';
                let monitorPath = '/api/v2/monitor/system/interface/';
                //let interfaceNameValue = pathRequest.path.elem[1].key.name; <---subscribe
                let interfaceNameValue = pathRequest.path[0].elem[1].key.name;
                let fullPath = cmdbPath + interfaceNameValue;
                let data = '';
                let getRequest = await this.getRequest(fullPath, data);
                let getMontiorRequest = await this.getRequest(monitorPath, {
                    interface_name: interfaceNameValue
                });
                let monitorInterface = getMontiorRequest.results[interfaceNameValue];
                console.log(JSON.stringify(monitorInterface));
                console.log('FortiGate Rest Response: ' + JSON.stringify(getMontiorRequest));

                //Convert Data
                let configObj = openconfig_interfaces_model.eval(
                    {
                        'openconfig-interfaces:interfaces': {
                            interface: [
                                {
                                    name: getRequest.results[0].name,
                                    config: {
                                        name: getRequest.results[0].name,
                                        type: 'IF_ETHERNET',
                                        mtu: getRequest.results[0].mtu
                                    }

                                    // state: {
                                    //     type: 'IF_ETHERNET'
                                    // }
                                }
                            ]
                        }
                    },
                    null
                );
                let configObjtoJSON = configObj.toJSON();
                console.log(
                    'config object items ' + configObjtoJSON['openconfig-interfaces:interfaces'].interface[0].name
                );
                console.log('configObject' + JSON.stringify(configObj.toJSON()));
                let readOnlyData = {
                    state: {
                        name: getRequest.results[0].name,
                        type: 'IF_ETHERNET',
                        mtu: getRequest.results[0].mtu,
                        'loopback-mode': false,
                        description: getRequest.results[0].description,
                        enabled: getRequest.results[0].status === 'up' ? true : false,
                        ifindex: getRequest.results[0].status.vindex,
                        'admin-status': getRequest.results[0].status === 'up' ? 'UP' : 'DOWN',
                        'oper-status': getRequest.results[0].status === 'up' ? 'UP' : 'DOWN',
                        //logical TODO:look into this.
                        counters: {
                            //in-octets:
                            'in-pkts': monitorInterface.rx_packets,
                            //"in-unicast-pkts":
                            //"in-broadcast-pkts":
                            //"in-multicast-pkts":
                            //"in-discards":
                            'in-errors': monitorInterface.rx_errors,
                            //"in-unknown-protos":
                            //"in-fcs-errors":
                            //"out-octets":
                            'out-pkts': monitorInterface.tx_packets,
                            //"out-unicast-pkts":
                            //"out-broadcast-pkts":
                            //"out-multicast-pkts":
                            //"out-discards":
                            'out-errors': monitorInterface.tx_errors
                            //"carrier-transitions":
                            //"last-clear":
                        }
                    }
                };
                configObjtoJSON['openconfig-interfaces:interfaces'].interface[0].state = readOnlyData;
                console.log('CONFIGOBJECT COMBINED ' + JSON.stringify(configObjtoJSON));
                let combinedObj = {
                    'openconfig-interfaces:interfaces': configObjtoJSON['openconfig-interfaces:interfaces'],
                    state: readOnlyData.state
                };
                console.log(JSON.stringify(combinedObj));
                return combinedObj;

            case 'interfaces/interface/state/':
                console.log('state');
                break;
            case 'interfaces/interface/state/counters/':
                console.log('counters');
                break;
            case 'interfaces/interface/subinterfaces/':
                console.log('subinterfaces');
                break;
            case 'interfaces/interface/hold-time/':
                console.log('Path not implmented yet');
                break;
            default:
                console.log('Path not implmented yet');
                break;
        }

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

        console.log('ModelType: ' + JSON.stringify(modelType));
        if (modelType.elem[0].name == 'interfaces') {
            console.log('interface selected in ConvertRestToYang');
            let type;
            //TODO:
            if (config.results[0].type == 'physical') {
                let type = 'IF_ETHERNET';
            } else {
                type = 'IF_ETHERNET';
            }
            //Currently assume interface was recieved.
            let obj = openconfig_interfaces_model.eval(
                {
                    'openconfig-interfaces:interfaces': {
                        interface: [
                            {
                                name: config.results[0].name,
                                config: {
                                    name: config.results[0].name,
                                    type: 'IF_ETHERNET',
                                    mtu: config.results[0].mtu
                                }
                                // state: {
                                //     type: 'IF_ETHERNET'
                                // }
                            }
                        ]
                    }
                },
                null
            );
            //currently broke:
            // let obj = openconfig_interfaces_model.validate({
            //     'openconfig-interfaces:interfaces': {
            //         interface: [
            //             {
            //                 name: config.results[0].name,
            //                 config: {
            //                     name: config.results[0].name,
            //                     type: 'IF_ETHERNET',
            //                     mtu: config.results[0].mtu
            //                 },
            //                 state: {
            //                     type: 'IF_ETHERNET'
            //                 }
            //             }
            //         ]
            //     }
            // });
            console.log(obj);
            return obj.toJSON();
        }
    }
    //Validated function is for non-config data, i.e readonly
    public convertResttoYang_Validate(modelType, data) {}
}

if (module === require.main) {
    exports.main(console.log);
}
