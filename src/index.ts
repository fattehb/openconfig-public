//import { YangModel, YangInstance, YangProperty } from 'yang-js';
//TODO: fix yang-js imports
var Yang = require('yang-js');
import { FortiGateAPIRequests } from './fortigateApiRequests';
import { GnmiProtoHandlers } from './GnmiProtoHandlers';
import { CertificateManager } from './cert_manager';

const listenOnPort = 6031;

var grpc = require('grpc');
var protoLoader = require('@grpc/proto-loader');
var PROTO_PATH = __dirname + '/gnmi/proto/gnmi/gnmi.proto';

var packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
var loadgNMIProto = grpc.loadPackageDefinition(packageDefinition).gnmi;
const { FORTIGATE_API_KEY, FORTIGATE_IP, POLL_INTERVAL } = process.env;
//TODO: move imports to package.json file.
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
    //gRPC
    const gRPCServiceHandler = new GnmiProtoHandlers();
    var server = new grpc.Server();

    //var stub = new helloworld.Greeter('myservice.example.com', ssl_creds);
    //TODO: move into seperate class.
    server.addService(loadgNMIProto.gNMI.service, {
        Get: gRPCServiceHandler.Get,
        Set: gRPCServiceHandler.Set,
        Capabilities: gRPCServiceHandler.Capabilities,
        Subscribe: gRPCServiceHandler.Subscribe
    });
    // can call with customized cert files
    const certManager = new CertificateManager();
    server.bind('0.0.0.0:' + listenOnPort, certManager.createServerCredentials());
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
    // Set requests have been split out due to the nature in which they are evaluated/logic assignment.
    public async setModelRequests(pathRequest) {
        var fullPath = '',
            interfaceNameValue,
            cmdbPath,
            data,
            getRequest,
            postRequest,
            typeValue,
            postValue;
        console.log('pathrequest for set ' + JSON.stringify(pathRequest));
        if (pathRequest?.update) {
            interfaceNameValue = pathRequest.update[0].path.elem[1].key.name;
            // Value presented by the gNMI
            // Value wil be int_val/string_val etc. Can easily tell which, by grabbing value
            typeValue = pathRequest.update[0].val.value;
            postValue = pathRequest.update[0].val[typeValue];
            console.log('postvalue ' + postValue);
            console.log('Set Update Request');
            //Construct the path
            for (const item of pathRequest.update[0].path.elem) {
                //TODO: account for multiple names etc:
                fullPath = fullPath + item.name + '/';
            }
            console.log(fullPath);
        }
        switch (fullPath) {
            case 'interfaces/interface/':
                // From the yang docs:
                // "The type of the interface.

                // When an interface entry is created, a server MAY
                // initialize the type leaf with a valid value, e.g., if it
                // is possible to derive the type from the name of the
                // interface.

                // If a client tries to set the type of an interface to a
                // value that can never be used by the system, e.g., if the
                // type is not supported or if the type does not match the
                // name of the interface, the server MUST reject the request.
                // A NETCONF server MUST reply with an rpc-error with the
                // error-tag 'invalid-value' in this case.";

                //This means that we must create an interface type, based on the name:
                let interfaceType;

                const acceptedInterfaceTypes = ['physical', 'loopback'];
                // 'aggregate', 'redundant', 'tunnel', 'loopback'];

                for (let i of acceptedInterfaceTypes) {
                    if (interfaceNameValue.toLowerCase().includes(i)) {
                        interfaceType = i;
                        console.log(`Assuming interface type: ${i}`);
                    }
                }
                if (interfaceType === null) {
                    //TODO: errors needs to be sent to the gNMI client instead.
                    const err = new Error(`
                    Could not determine interfacetype from name ${interfaceNameValue}. Current accepted types are:
                    physical loopback
                    `);
                    console.error(err.message);
                    throw err;
                }

                cmdbPath = '/api/v2/cmdb/system/interface/';
                fullPath = cmdbPath;
                data = {
                    name: interfaceNameValue,
                    vdom: 'root',
                    type: interfaceType
                };
                console.log('Post Data' + JSON.stringify(data));
                postRequest = await this.postConfig(fullPath, data);

                return postRequest;
            case 'interfaces/interface/config/enabled/':
                cmdbPath = '/api/v2/cmdb/system/interface/';

                fullPath = cmdbPath + interfaceNameValue;
                data = {
                    name: interfaceNameValue,
                    status: postValue === true ? 'up' : 'down'
                };

                postRequest = await this.putConfig(fullPath, data);
                return postRequest;
            case 'interfaces/interface/config/mtu/':
                cmdbPath = '/api/v2/cmdb/system/interface/';

                fullPath = cmdbPath + interfaceNameValue;
                data = {
                    name: interfaceNameValue,
                    mtu: postValue
                };

                postRequest = await this.putConfig(fullPath, data);
                return postRequest;
            case 'interfaces/interface/config/description/':
                cmdbPath = '/api/v2/cmdb/system/interface/';

                fullPath = cmdbPath + interfaceNameValue;
                data = {
                    name: interfaceNameValue,
                    description: postValue
                };

                postRequest = await this.putConfig(fullPath, data);

                return postRequest;
            default:
                console.log('Path not implmented yet');
                return -1;
        }
    }

    public async translatePath(pathRequest) {
        //TODO: currently assumes just interface.
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
        var transformConfigtoJSON;
        var configObj;

        var fullPath = '';
        console.log('Path Request' + JSON.stringify(pathRequest));
        //Subscribe commands shows as:
        //for (const item of pathRequest.path.elem) {
        if (pathRequest?.subscription) {
            console.log('Subscription Request sent');
            //Subscription path contains an array at elem but not at path.
            for (const item of pathRequest.subscription[0].path.elem) {
                //TODO: account for multiple names etc:
                fullPath = fullPath + item.name + '/';
                interfaceNameValue = pathRequest.subscription[0].path.elem[1].key.name;
                //TODO account for multiple names etc:
                console.log('item ' + JSON.stringify(item));
            }
        } else {
            //Assume Get request, if not sub.
            //get request contains an array at path, but not at elem.
            for (const item of pathRequest.path[0].elem) {
                fullPath = fullPath + item.name + '/';
                interfaceNameValue = pathRequest.path[0].elem[1].key.name;
                //TODO account for multiple names etc.
                console.log('item ' + JSON.stringify(item));
            }
        }

        //Assume sub ATM
        //     //TODO: error check.
        console.log(`Constructed RestAPI Path: ${fullPath}`);
        switch (fullPath) {
            case 'interfaces/interface/':
                cmdbPath = '/api/v2/cmdb/system/interface/';
                monitorPath = '/api/v2/monitor/system/interface/';
                uptimePath = '/api/v2/monitor/web-ui/state';

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
                configObj = openconfig_interfaces_model.eval(
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
                //configObjtoJSON['openconfig-interfaces:interfaces'].interface[0].state
                console.log('CONFIGOBJECT COMBINED ' + JSON.stringify(configObjtoJSON));
                let combinedObj = configObjtoJSON['openconfig-interfaces:interfaces'];
                combinedObj.interface[0].sate = readOnlyData.state;

                console.log('Combined Data' + JSON.stringify(combinedObj));
                return combinedObj;

            // Return evaluated config.
            case 'interfaces/interface/config/':
                cmdbPath = '/api/v2/cmdb/system/interface/';

                fullPath = cmdbPath + interfaceNameValue;
                data = '';
                getRequest = await this.getRequest(fullPath, data);

                //Convert Data
                let configValues = openconfig_interfaces_model.eval(
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
                let configValuestoJSON = configValues.toJSON();
                return configValuestoJSON['openconfig-interfaces:interfaces'].interface[0];
            case 'interfaces/interface/config/name/':
                cmdbPath = '/api/v2/cmdb/system/interface/';

                fullPath = cmdbPath + interfaceNameValue;
                data = '';
                getRequest = await this.getRequest(fullPath, data);

                //Convert Data
                let getNameConfig = openconfig_interfaces_model.eval(
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
                let getNametoJSON = getNameConfig.toJSON();
                return getNametoJSON['openconfig-interfaces:interfaces'].interface[0].name;

            case 'interfaces/interface/config/type/':
                cmdbPath = '/api/v2/cmdb/system/interface/';

                fullPath = cmdbPath + interfaceNameValue;
                data = '';
                getRequest = await this.getRequest(fullPath, data);

                //Convert Data
                configObj = openconfig_interfaces_model.eval(
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
                transformConfigtoJSON = configObj.toJSON();
                return transformConfigtoJSON['openconfig-interfaces:interfaces'].interface[0].config.type;

            case 'interfaces/interface/state/':
                cmdbPath = '/api/v2/cmdb/system/interface/';
                monitorPath = '/api/v2/monitor/system/interface/';
                uptimePath = '/api/v2/monitor/web-ui/state';
                getUptimeRequest = await this.getRequest(uptimePath, '');
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

                getMontiorRequest = await this.getRequest(monitorPath, {
                    interface_name: interfaceNameValue
                });
                monitorInterface = getMontiorRequest.results[interfaceNameValue];
                let inOctets = monitorInterface.rx_bytes;
                //TODO:
                return inOctets;
            // Uptime returend via last reboot time.
            case 'interfaces/interface/state/counters/last-clear':
                uptimePath = '/api/v2/monitor/web-ui/state';
                getUptimeRequest = await this.getRequest(uptimePath, '');

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
                return { val: 'Path Not implmented yet.' };
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
