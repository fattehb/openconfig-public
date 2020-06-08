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
const importTest = Yang.import('../../public/third_party/ietf/ietf-interfaces.yang');
const openconfig_yang_types_model = Yang.import('../../public/release/models/types/openconfig-yang-types.yang');
const openconfig_type_model = Yang.import('../../public/release/models/types/openconfig-types.yang');
const openconfig_extensions_model = Yang.import('../../public/release/models/openconfig-extensions.yang');
const openconfig_interfaces_model = Yang.import('../../public/release/models/interfaces/openconfig-interfaces.yang');

exports.main = async (context, req, res): Promise<void> => {
    console.log('Function Started');
    let yangImportList = [
        '../../public/third_party/ietf/ietf-interfaces.yang',
        '../../public/release/models/types/openconfig-yang-types.yang',
        '../../public/release/models/types/openconfig-types.yang',
        '../../public/release/models/openconfig-extensions.yang',
        '../../public/release/models/interfaces/openconfig-interfaces.yang'
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

    console.log('obj', JSON.stringify(obj));

    let getAttrubute = obj.get('/interfaces/interface/name');
    console.log('getAttribute: ', getAttrubute);

    console.log('schema', openconfig_interfaces_model);

    const openConfigInterpreter = new OpenConfigInterpreter(5000, FORTIGATE_IP, FORTIGATE_API_KEY);
    const gRPCServiceHandler = new GnmiProtoHandlers();
    console.log('******************* Test FortiGate Connection with put/get request ******************');
    //TODO: remove. Test set headers
    let testHeaders = { name: 'port1', alias: 'test3' };
    let putInterface = await openConfigInterpreter.putConfig('/api/v2/cmdb/system/interface/port1', testHeaders);
    let getInterfaceTest = await openConfigInterpreter.getRequest('/api/v2/cmdb/system/interface/port1', testHeaders);
    console.log(putInterface);
    console.log('*************END TESTS *****************');
    //gRPC
    var server = new grpc.Server();

    //var stub = new helloworld.Greeter('myservice.example.com', ssl_creds);
    //TODO: move into seperate class.
    server.addService(hello_proto.gNMI.service, {
        Get: gRPCServiceHandler.Get,
        Set: gRPCServiceHandler.Set,
        Capabilities: gRPCServiceHandler.Capabilities,
        Subscribe: gRPCServiceHandler.Subscribe
    });
    //TODO add auth
    server.bind('0.0.0.0:' + listenOnPort, grpc.ServerCredentials.createInsecure());
    server.start();
    console.log(`Server listening to traffic on ${listenOnPort}`);
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
    // Set requests have been split out due to the nature in which they are evaluated and set.
    public async setModelRequests(pathRequest) {}
    public async translatePath(pathRequest) {
        //TODO:Normalize data,
        //TODO: accept multiple values for interface etc
        //TODO: accept wildcard
        // TODO: accept on_change value.
        // TODO: seperate into sepearte classes? for each model.
        // TODO: for models, keep one master, with apicalls etc, call from that section of the model for the respective paths. One place to update in this case

        var cmdbPath;
        var monitorPath;
        //let interfaceNameValue = pathRequest.path.elem[1].key.name; <---subscribe
        var interfaceNameValue;
        var data;
        var getRequest;
        var getMontiorRequest;
        var monitorInterface;
        var uptimePath;
        var uptime;
        var readOnlyData;
        var getUptimeRequest;

        var fullPath = '';
        console.log('Path Request' + JSON.stringify(pathRequest));
        //SUbscribe shows as:
        //for (const item of pathRequest.path.elem) {
        //Get
        if (pathRequest?.subscription) {
            console.log('Subscription Request sent');
            //Subscription path contains an array at elem but not at path.
            for (const item of pathRequest.subscription[0].path.elem) {
                //TODO: account for multiple names etc:
                fullPath = fullPath + item.name + '/';
                interfaceNameValue = pathRequest.subscription[0].path.elem[1].key.name;
                //TODO account for multiple names etc:
                // if (item.key && item.key.key) {
                //     fullPath = fullPath + '[' + item.key.value + ']';
                // }
                console.log('item ' + JSON.stringify(item));
            }
        } else {
            //get request contains an array at path, but not at elem.
            for (const item of pathRequest.path[0].elem) {
                fullPath = fullPath + item.name + '/';
                interfaceNameValue = pathRequest.path[0].elem[1].key.name;
                //TODO account for multiple names etc:
                // if (item.key && item.key.key) {
                //     fullPath = fullPath + '[' + item.key.value + ']';
                // }
                console.log('item ' + JSON.stringify(item));
            }
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
                cmdbPath = '/api/v2/cmdb/system/interface/';
                monitorPath = '/api/v2/monitor/system/interface/';
                uptimePath = '/api/v2/monitor/web-ui/state';

                //let interfaceNameValue = pathRequest.path.elem[1].key.name; <---subscribe
                fullPath = cmdbPath + interfaceNameValue;
                data = '';
                getRequest = await this.getRequest(fullPath, data);
                getMontiorRequest = await this.getRequest(monitorPath, {
                    interface_name: interfaceNameValue
                });
                getUptimeRequest = await this.getRequest(uptimePath, '');
                monitorInterface = getMontiorRequest.results[interfaceNameValue];
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
                            'in-octets': monitorInterface.rx_bytes,
                            'in-pkts': monitorInterface.rx_packets,
                            //"in-unicast-pkts":
                            //"in-broadcast-pkts":
                            //"in-multicast-pkts":
                            //"in-discards":
                            'in-errors': monitorInterface.rx_errors,
                            //"in-unknown-protos":
                            //"in-fcs-errors":
                            'out-octets': monitorInterface.tx_bytes,
                            'out-pkts': monitorInterface.tx_packets,
                            //"out-unicast-pkts":
                            //"out-broadcast-pkts":
                            //"out-multicast-pkts":
                            //"out-discards":
                            'out-errors': monitorInterface.tx_errors,
                            //"carrier-transitions":
                            'last-clear': getUptimeRequest.results.utc_last_reboot
                        }
                    }
                };
                configObjtoJSON['openconfig-interfaces:interfaces'].interface[0].state = readOnlyData;
                console.log('CONFIGOBJECT COMBINED ' + JSON.stringify(configObjtoJSON));
                let combinedObj = {
                    'openconfig-interfaces:interfaces':
                        configObjtoJSON['openconfig-interfaces:interfaces'] + readOnlyData.state
                };
                console.log('Combined Data' + JSON.stringify(combinedObj));
                return combinedObj;

            case 'interfaces/interface/state/':
                cmdbPath = '/api/v2/cmdb/system/interface/';
                monitorPath = '/api/v2/monitor/system/interface/';
                uptimePath = '/api/v2/monitor/web-ui/state';
                getUptimeRequest = await this.getRequest(uptimePath, '');
                //let interfaceNameValue = pathRequest.path.elem[1].key.name; <---subscribe
                fullPath = cmdbPath + interfaceNameValue;
                data = '';
                getRequest = await this.getRequest(fullPath, data);
                getMontiorRequest = await this.getRequest(monitorPath, {
                    interface_name: interfaceNameValue
                });
                monitorInterface = getMontiorRequest.results[interfaceNameValue];
                let stateData = {
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
                            'in-octets': monitorInterface.rx_bytes,
                            'in-pkts': monitorInterface.rx_packets,
                            //"in-unicast-pkts":
                            //"in-broadcast-pkts":
                            //"in-multicast-pkts":
                            //"in-discards":
                            'in-errors': monitorInterface.rx_errors,
                            //"in-unknown-protos":
                            //"in-fcs-errors":
                            'out-octets': monitorInterface.tx_bytes,
                            'out-pkts': monitorInterface.tx_packets,
                            //"out-unicast-pkts":
                            //"out-broadcast-pkts":
                            //"out-multicast-pkts":
                            //"out-discards":
                            'out-errors': monitorInterface.tx_errors,
                            //"carrier-transitions":
                            'last-clear': getUptimeRequest.results.utc_last_reboot
                        }
                    }
                };

                return stateData;

            case 'interfaces/interface/state/counters/':
                cmdbPath = '/api/v2/cmdb/system/interface/';
                monitorPath = '/api/v2/monitor/system/interface/';
                uptimePath = '/api/v2/monitor/web-ui/state';
                getUptimeRequest = await this.getRequest(uptimePath, '');

                //let interfaceNameValue = pathRequest.path.elem[1].key.name; <---subscribe
                fullPath = cmdbPath + interfaceNameValue;
                data = '';

                getRequest = await this.getRequest(fullPath, data);
                getMontiorRequest = await this.getRequest(monitorPath, {
                    interface_name: interfaceNameValue
                });
                monitorInterface = getMontiorRequest.results[interfaceNameValue];
                let counterData = {
                    counters: {
                        'in-octets': monitorInterface.rx_bytes,
                        'in-pkts': monitorInterface.rx_packets,
                        //"in-unicast-pkts":
                        //"in-broadcast-pkts":
                        //"in-multicast-pkts":
                        //"in-discards":
                        'in-errors': monitorInterface.rx_errors,
                        //"in-unknown-protos":
                        //"in-fcs-errors":
                        'out-octets': monitorInterface.tx_bytes,
                        'out-pkts': monitorInterface.tx_packets,
                        //"out-unicast-pkts":
                        //"out-broadcast-pkts":
                        //"out-multicast-pkts":
                        //"out-discards":
                        'out-errors': monitorInterface.tx_errors,
                        //"carrier-transitions":
                        'last-clear': getUptimeRequest.results.utc_last_reboot
                    }
                };
                return counterData;
            case 'interfaces/interface/state/counters/in-pkts/':
                monitorPath = '/api/v2/monitor/system/interface/';

                //let interfaceNameValue = pathRequest.path.elem[1].key.name; <---subscribe
                getMontiorRequest = await this.getRequest(monitorPath, {
                    interface_name: interfaceNameValue
                });
                monitorInterface = getMontiorRequest.results[interfaceNameValue];
                let inPackets = {
                    'in-pkts': monitorInterface.rx_packets
                };
                return inPackets;
            case 'interfaces/interface/state/counters/in-errors/':
                monitorPath = '/api/v2/monitor/system/interface/';
                //let interfaceNameValue = pathRequest.path.elem[1].key.name; <---subscribe

                getMontiorRequest = await this.getRequest(monitorPath, {
                    interface_name: interfaceNameValue
                });
                monitorInterface = getMontiorRequest.results[interfaceNameValue];
                let inErrors = {
                    'in-errors': monitorInterface.rx_errors
                };
                return inErrors;
            case 'interfaces/interface/state/counters/out-pkts/':
                monitorPath = '/api/v2/monitor/system/interface/';
                //let interfaceNameValue = pathRequest.path.elem[1].key.name; <---subscribe

                getMontiorRequest = await this.getRequest(monitorPath, {
                    interface_name: interfaceNameValue
                });
                monitorInterface = getMontiorRequest.results[interfaceNameValue];
                let outPkts = {
                    'out-pkts': monitorInterface.tx_packets
                };
                return outPkts;
            case 'interfaces/interface/state/counters/out-errors/':
                monitorPath = '/api/v2/monitor/system/interface/';
                //let interfaceNameValue = pathRequest.path.elem[1].key.name; <---subscribe

                getMontiorRequest = await this.getRequest(monitorPath, {
                    interface_name: interfaceNameValue
                });
                monitorInterface = getMontiorRequest.results[interfaceNameValue];
                let outErrors = {
                    'out-errors': monitorInterface.tx_errors
                };
                return outErrors;
            case 'interfaces/interface/state/counters/out-octets/':
                monitorPath = '/api/v2/monitor/system/interface/';
                //let interfaceNameValue = pathRequest.path.elem[1].key.name; <---subscribe

                getMontiorRequest = await this.getRequest(monitorPath, {
                    interface_name: interfaceNameValue
                });
                monitorInterface = getMontiorRequest.results[interfaceNameValue];
                let outOctets = {
                    'out-octets': monitorInterface.tx_bytes
                };
                return outOctets;
            case 'interfaces/interface/state/counters/in-octets/':
                monitorPath = '/api/v2/monitor/system/interface/';
                //let interfaceNameValue = pathRequest.path.elem[1].key.name; <---subscribe

                getMontiorRequest = await this.getRequest(monitorPath, {
                    interface_name: interfaceNameValue
                });
                monitorInterface = getMontiorRequest.results[interfaceNameValue];
                let inOctets = {
                    'in-octets': monitorInterface.rx_bytes
                };
                return inOctets;
            // Uptime returend via last reboot time.
            case 'interfaces/interface/state/counters/last-clear':
                uptimePath = '/api/v2/monitor/web-ui/state';
                getUptimeRequest = await this.getRequest(uptimePath, '');
                //let interfaceNameValue = pathRequest.path.elem[1].key.name; <---subscribe
                let lastClear = {
                    'last-clear': getUptimeRequest.results.utc_last_reboot
                };
                return lastClear;

            case 'interfaces/interface/subinterfaces/':
                console.log('subinterfaces not implmented yet');
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
    //Deprecated
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
                            }
                        ]
                    }
                },
                null
            );
            return obj.toJSON();
        }
    }
    //Validated function is for non-config data, i.e readonly
    public convertResttoYang_Validate(modelType, data) {}
}

if (module === require.main) {
    exports.main(console.log);
}
