//TODO: fix yang-js imports
var Yang = require('yang-js');
import { FortiGateAPIRequests } from './fortigate-api-requests';
import { GnmiProtoHandlers } from './gnmi-proto-handlers';
import { YangModel } from './yang-model-interface';
import { CertificateManager } from './cert-manager';

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
        let pathArray = [];
        console.log('pathrequest for set ' + JSON.stringify(pathRequest));
        if (pathRequest?.update) {
            interfaceNameValue = pathRequest?.update?.[0]?.path?.elem[1]?.key?.name;
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
                pathArray.push(item.name);
            }
            console.log(fullPath);
        }
        if (pathArray[0] === 'interfaces') {
            switch (fullPath) {
                case 'interfaces/interface/':
                    // From the yang docs:
                    // "The type of the interface.

                    // When an interface entry is created, a server MAY
                    // initialize the type leaf with a valid value, e.g., if it
                    // is possible to derive the type from the name of the
                    // interface.
                    // value that can never be used by the system, e.g., if the
                    // type is not supported or if the type does not match the
                    // name of the interface, the server MUST reject the request.
                    // A NETCONF server MUST reply with an rpc-error with the
                    // error-tag 'invalid-value' in this case.";

                    //This means that we must create an interface type, based on the name:
                    let interfaceType;

                    const acceptedInterfaceTypes = ['physical', 'loopback', 'aggregate'];
                    // 'aggregate', 'redundant', 'tunnel', 'loopback'];

                    for (let i of acceptedInterfaceTypes) {
                        if (postValue && postValue.toLowerCase().includes(i)) {
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
                        name: postValue, //since we are creating one here. We can determine form the value provided.
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
                case 'interfaces/interface/subinterfaces/subinterface/ipv4/addresses/address/ip/':
                    cmdbPath = '/api/v2/cmdb/system/interface/';

                    fullPath = cmdbPath + interfaceNameValue;
                    data = {
                        name: interfaceNameValue,
                        ip: postValue,
                        mode: 'static' //TODO: should we assume this?
                    };

                    postRequest = await this.putConfig(fullPath, data);

                    return postRequest;
                case 'interfaces/interface/subinterfaces/subinterface/ipv4/config/dhcp-client/':
                    cmdbPath = '/api/v2/cmdb/system/interface/';

                    fullPath = cmdbPath + interfaceNameValue;
                    data = {
                        name: interfaceNameValue,
                        mode: postValue === true ? 'dhcp' : 'static'
                    };

                    postRequest = await this.putConfig(fullPath, data);

                    return postRequest;
                case 'interfaces/interface/subinterfaces/subinterface/ipv4/config/mtu/':
                    cmdbPath = '/api/v2/cmdb/system/interface/';

                    fullPath = cmdbPath + interfaceNameValue;
                    data = {
                        name: interfaceNameValue,
                        mtu: postValue
                    };

                    postRequest = await this.putConfig(fullPath, data);

                    return postRequest;
                case 'interfaces/interface/subinterfaces/subinterface/ipv4/config/enabled/':
                    cmdbPath = '/api/v2/cmdb/system/interface/';

                    fullPath = cmdbPath + interfaceNameValue;
                    data = {
                        name: interfaceNameValue,
                        status: postValue === true ? 'up' : 'down'
                    };

                    postRequest = await this.putConfig(fullPath, data);

                    return postRequest;
                case 'interfaces/interface/subinterfaces/subinterface/ipv6/addresses/address/ip/':
                    cmdbPath = '/api/v2/cmdb/system/interface/';

                    fullPath = cmdbPath + interfaceNameValue;
                    data = {
                        name: interfaceNameValue,
                        ipv6: {
                            'ip6-address': postValue,
                            'ip6-mode': 'static'
                        }
                    };

                    postRequest = await this.putConfig(fullPath, data);

                    return postRequest;
                case 'interfaces/interface/tunnel/':
                    cmdbPath = '/api/v2/cmdb/system/gre-tunnel/';
                    // {
                    //     "name": "string",
                    //     "interface": "string",
                    //     "ip-version": "4",
                    //     "remote-gw6": "2001:0db8:5b96:0000:0000:426f:8e17:642a",
                    //     "local-gw6": "2001:0db8:5b96:0000:0000:426f:8e17:642a",
                    //     "remote-gw": "198.51.100.42",
                    //     "local-gw": "198.51.100.42",
                    //     "sequence-number-transmission": "disable",
                    //     "sequence-number-reception": "disable",
                    //     "checksum-transmission": "disable",
                    //     "checksum-reception": "disable",
                    //     "key-outbound": 0,
                    //     "key-inbound": 0,
                    //     "dscp-copying": "disable",
                    //     "diffservcode": "string",
                    //     "keepalive-interval": 0,
                    //     "keepalive-failtimes": 0
                    //   }
                    //                   config system gre-tunnel
                    // edit "toFG2"
                    //     set interface "port1"
                    //     set local-gw 198.51.100.1
                    //     set remote-gw 203.0.113.2
                    // next
                    postValue = JSON.parse(postValue); //Convert from buffer.

                    fullPath = cmdbPath;
                    data = {
                        name: postValue.tunnel.config.name,
                        interface: postValue.tunnel.config.interface,
                        'remote-gw': postValue.tunnel.config.dst,
                        'local-gw': postValue.tunnel.config.src
                    };

                    postRequest = await this.postConfig(fullPath, data);

                    return postRequest;
                default:
                    console.log('Path not implmented yet');
                    return -1;
            }
        } else if (pathArray[0] === 'local-routes') {
            switch (fullPath) {
                //TODO: proper JSON handling.
                case 'local-routes/static-routes/':
                    cmdbPath = '/api/v2/cmdb/router/static/';
                    fullPath = cmdbPath;
                    postValue = JSON.parse(postValue); //Convert from buffer.

                    data = {
                        dst: postValue['static-routes']?.static?.config?.prefix,
                        gateway: postValue['static-routes']?.static['next-hops']['next-hop']?.config['next-hop'],
                        device: 'port4', //TODO:will need to provide an agument
                        distance: postValue['static-routes']?.static['next-hops']['next-hop']?.config?.metric,
                        vdom: 'root' //Assume root vdom for time being.
                    };
                    console.log('data: ' + JSON.stringify(data));

                    postRequest = await this.postConfig(fullPath, data);

                    return postRequest;
                case 'local-routes/local-aggregates/':
                    cmdbPath = '/api/v2/cmdb/router/static/';
                    fullPath = cmdbPath;
                    postValue = JSON.parse(postValue); //Convert from buffer.
                    //aggregate-address
                    data = {
                        dst: postValue['local-aggregates']?.aggregate?.config?.prefix,
                        blackhole:
                            postValue['local-aggregates']?.aggregate?.config?.discard === true ? 'enable' : 'disable',
                        vdom: 'root' //Assume root vdom for time being.
                    };
                    console.log('data: ' + JSON.stringify(data));

                    postRequest = await this.postConfig(fullPath, data);

                    return postRequest;
                default:
                    console.log('Path not implmented yet');
                    return -1;

                // Return evaluated config.
            }
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
        var configObjtoJSON;
        var counterData;
        var readOnlyData;
        var combinedObj;
        var fullPath = '';
        //TODO: consolidate:
        var configValues;
        var configValuestoJSON;
        var stateData;
        var outData;

        let pathArray = [];
        var subInterfaceIndexValue;

        var interfaceClassObj = new YangModel();
        var model;

        var localRoutePath;
        var prefixName; //local-routing
        console.log('Path Request' + JSON.stringify(pathRequest));
        //Subscribe commands shows as:
        //for (const item of pathRequest.path.elem) {
        if (pathRequest?.subscription) {
            console.log('Subscription Request sent');
            //Subscription path contains an array at elem but not at path.
            for (const item of pathRequest.subscription[0].path.elem) {
                //TODO: account for multiple names etc:
                fullPath = fullPath + item.name + '/';
                pathArray.push(item.name);
                if (
                    pathRequest &&
                    pathRequest.subscription &&
                    pathRequest.subscription[0].path &&
                    pathRequest.subscription[0].path.elem &&
                    pathRequest.subscription[0].path.elem[1] &&
                    pathRequest.subscription[0].path.elem[1].key
                ) {
                    interfaceNameValue = pathRequest?.subscription[0]?.path?.elem[1].key?.name;
                }

                prefixName = pathRequest?.subscription[0]?.path?.elem[2]?.key?.prefix;
                //TODO: search for value, verify.
                subInterfaceIndexValue = pathRequest?.subscription[0]?.path?.elem[3]?.key?.name;
                //TODO account for multiple names etc:
                console.log('item ' + JSON.stringify(item));
            }
        } else {
            //Assume Get request, if not sub.
            //get request contains an array at path, but not at elem.
            for (const item of pathRequest.path[0].elem) {
                fullPath = fullPath + item.name + '/';
                pathArray.push(item.name);
                interfaceNameValue = pathRequest?.path[0]?.elem[1]?.key?.name;
                prefixName = pathRequest?.path[0]?.elem[2]?.key?.prefix;
                console.log('PRefix name ' + prefixName);
                //TODO account for multiple names etc.
                console.log('item ' + JSON.stringify(item));
            }
        }
        console.log(pathArray[0]);
        if (pathArray[0] === 'interfaces') {
            console.log(`Constructed RestAPI Path: ${fullPath}`);
            switch (fullPath) {
                case 'interfaces/interface/':
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
                    model = interfaceClassObj.interface(pathArray, getRequest, monitorInterface, getUptimeRequest);
                    return model;

                // Return evaluated config.
                case 'interfaces/interface/config/':
                    cmdbPath = '/api/v2/cmdb/system/interface/';

                    fullPath = cmdbPath + interfaceNameValue;
                    data = '';
                    getRequest = await this.getRequest(fullPath, data);

                    //Convert Data
                    configValues = openconfig_interfaces_model.eval(
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
                    configValuestoJSON = configValues.toJSON();
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
                case 'interfaces/interface/config/description/':
                    cmdbPath = '/api/v2/cmdb/system/interface/';
                    fullPath = cmdbPath + interfaceNameValue;
                    data = '';
                    getRequest = await this.getRequest(fullPath, data);
                    let description = {
                        description: getRequest.results[0].description
                    };
                    return description;
                case 'interfaces/interface/config/enabled/':
                    cmdbPath = '/api/v2/cmdb/system/interface/';
                    fullPath = cmdbPath + interfaceNameValue;
                    data = '';
                    getRequest = await this.getRequest(fullPath, data);
                    let enabled = {
                        enabled: getRequest.results[0].status === 'up' ? true : false
                    };
                    return enabled;

                case 'interfaces/interface/config/type/':
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
                    model = interfaceClassObj.interface(pathArray, getRequest, monitorInterface, getUptimeRequest);
                    return model;
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
                    model = interfaceClassObj.interface(pathArray, getRequest, monitorInterface, getUptimeRequest);
                    return model;

                case 'interfaces/interface/state/counters/':
                    cmdbPath = '/api/v2/cmdb/system/interface/';
                    monitorPath = '/api/v2/monitor/system/interface/';
                    uptimePath = '/api/v2/monitor/web-ui/state';
                    getUptimeRequest = await this.getRequest(uptimePath, '');

                    fullPath = cmdbPath + interfaceNameValue;
                    data = '';

                    getMontiorRequest = await this.getRequest(monitorPath, {
                        interface_name: interfaceNameValue
                    });
                    monitorInterface = getMontiorRequest.results[interfaceNameValue];
                    model = interfaceClassObj.interface(pathArray, null, monitorInterface, getUptimeRequest);
                    return model;
                case 'interfaces/interface/state/counters/in-pkts/':
                    monitorPath = '/api/v2/monitor/system/interface/';
                    getMontiorRequest = await this.getRequest(monitorPath, {
                        interface_name: interfaceNameValue
                    });
                    monitorInterface = getMontiorRequest.results[interfaceNameValue];
                    model = interfaceClassObj.interface(pathArray, null, monitorInterface, null);
                    return model;
                case 'interfaces/interface/state/counters/in-errors/':
                    monitorPath = '/api/v2/monitor/system/interface/';

                    getMontiorRequest = await this.getRequest(monitorPath, {
                        interface_name: interfaceNameValue
                    });
                    monitorInterface = getMontiorRequest.results[interfaceNameValue];
                    model = interfaceClassObj.interface(pathArray, null, monitorInterface, null);
                    return model;
                case 'interfaces/interface/state/counters/out-pkts/':
                    monitorPath = '/api/v2/monitor/system/interface/';

                    getMontiorRequest = await this.getRequest(monitorPath, {
                        interface_name: interfaceNameValue
                    });
                    monitorInterface = getMontiorRequest.results[interfaceNameValue];
                    model = interfaceClassObj.interface(pathArray, null, monitorInterface, null);
                    return model;
                case 'interfaces/interface/state/counters/out-errors/':
                    monitorPath = '/api/v2/monitor/system/interface/';

                    getMontiorRequest = await this.getRequest(monitorPath, {
                        interface_name: interfaceNameValue
                    });
                    monitorInterface = getMontiorRequest.results[interfaceNameValue];
                    model = interfaceClassObj.interface(pathArray, null, monitorInterface, null);
                    return model;
                case 'interfaces/interface/state/counters/out-octets/':
                    monitorPath = '/api/v2/monitor/system/interface/';

                    getMontiorRequest = await this.getRequest(monitorPath, {
                        interface_name: interfaceNameValue
                    });
                    monitorInterface = getMontiorRequest.results[interfaceNameValue];
                    model = interfaceClassObj.interface(pathArray, null, monitorInterface, null);
                    return model;
                case 'interfaces/interface/state/counters/in-octets/':
                    monitorPath = '/api/v2/monitor/system/interface/';

                    getMontiorRequest = await this.getRequest(monitorPath, {
                        interface_name: interfaceNameValue
                    });
                    monitorInterface = getMontiorRequest.results[interfaceNameValue];
                    model = interfaceClassObj.interface(pathArray, null, monitorInterface, null);
                    return model;
                // Uptime returend via last reboot time.
                case 'interfaces/interface/state/counters/last-clear':
                    uptimePath = '/api/v2/monitor/web-ui/state';
                    getUptimeRequest = await this.getRequest(uptimePath, '');
                    model = interfaceClassObj.interface(pathArray, null, null, getUptimeRequest);
                    return model;

                case 'interfaces/interface/subinterfaces/':
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
                    model = interfaceClassObj.interface(pathArray, getRequest, monitorInterface, getUptimeRequest);
                    return model;
                case 'interfaces/interface/hold-time/':
                    console.log('Path not implmented yet');
                    break;

                //Subinterfaces
                case 'interfaces/interface/subinterfaces/subinterface/':
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
                    model = interfaceClassObj.interface(pathArray, getRequest, monitorInterface, getUptimeRequest);
                    return model;
                case 'interfaces/interface/subinterfaces/subinterface/config/':
                    cmdbPath = '/api/v2/cmdb/system/interface/';
                    monitorPath = '/api/v2/monitor/system/interface/';
                    uptimePath = '/api/v2/monitor/web-ui/state';

                    fullPath = cmdbPath + interfaceNameValue;
                    data = '';
                    getRequest = await this.getRequest(fullPath, data);
                    getMontiorRequest = await this.getRequest(monitorPath, {
                        interface_name: subInterfaceIndexValue
                    });
                    getUptimeRequest = await this.getRequest(uptimePath, '');
                    monitorInterface = getMontiorRequest.results[interfaceNameValue];
                    model = interfaceClassObj.interface(pathArray, getRequest, monitorInterface, getUptimeRequest);
                    console.log('Path Request from config: ' + JSON.stringify(getRequest));
                    return model;
                case 'interfaces/interface/subinterfaces/subinterface/config/name/':
                    cmdbPath = '/api/v2/cmdb/system/interface/';
                    monitorPath = '/api/v2/monitor/system/interface/';
                    uptimePath = '/api/v2/monitor/web-ui/state';

                    fullPath = cmdbPath + interfaceNameValue;
                    data = '';
                    getRequest = await this.getRequest(fullPath, data);
                    getMontiorRequest = await this.getRequest(monitorPath, {
                        interface_name: subInterfaceIndexValue
                    });
                    getUptimeRequest = await this.getRequest(uptimePath, '');
                    monitorInterface = getMontiorRequest.results[interfaceNameValue];
                    model = interfaceClassObj.interface(pathArray, getRequest, monitorInterface, getUptimeRequest);
                    return model;
                case 'interfaces/interface/subinterfaces/subinterface/config/description/':
                    cmdbPath = '/api/v2/cmdb/system/interface/';
                    fullPath = cmdbPath + interfaceNameValue;
                    data = '';
                    getRequest = await this.getRequest(fullPath, data);
                    model = interfaceClassObj.interface(
                        pathArray,
                        getMontiorRequest,
                        monitorInterface,
                        getUptimeRequest
                    );
                    return model;

                case 'interfaces/interface/subinterfaces/subinterface/config/type/':
                    cmdbPath = '/api/v2/cmdb/system/interface/';

                    fullPath = cmdbPath + interfaceNameValue;
                    data = '';
                    getRequest = await this.getRequest(fullPath, data);

                    //Convert Data
                    model = interfaceClassObj.interface(
                        pathArray,
                        getMontiorRequest,
                        monitorInterface,
                        getUptimeRequest
                    );
                    return model;
                case 'interfaces/interface/subinterfaces/subinterface/state/':
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
                    model = interfaceClassObj.interface(
                        pathArray,
                        getMontiorRequest,
                        monitorInterface,
                        getUptimeRequest
                    );
                    return model;

                case 'interfaces/interface/subinterfaces/subinterface/state/counters/':
                    monitorPath = '/api/v2/monitor/system/interface/';
                    uptimePath = '/api/v2/monitor/web-ui/state';
                    getUptimeRequest = await this.getRequest(uptimePath, '');
                    data = '';

                    getMontiorRequest = await this.getRequest(monitorPath, {
                        interface_name: interfaceNameValue
                    });
                    monitorInterface = getMontiorRequest.results[interfaceNameValue];
                    model = interfaceClassObj.interface(pathArray, null, monitorInterface, getUptimeRequest);
                    return model;
                case 'interfaces/interface/subinterfaces/subinterface/state/counters/in-pkts/':
                    monitorPath = '/api/v2/monitor/system/interface/';
                    getMontiorRequest = await this.getRequest(monitorPath, {
                        interface_name: interfaceNameValue
                    });
                    monitorInterface = getMontiorRequest.results[interfaceNameValue];
                    model = interfaceClassObj.interface(pathArray, null, monitorInterface, null);
                    return model;
                case 'interfaces/interface/subinterfaces/subinterface/state/counters/in-errors/':
                    monitorPath = '/api/v2/monitor/system/interface/';

                    getMontiorRequest = await this.getRequest(monitorPath, {
                        interface_name: interfaceNameValue
                    });
                    monitorInterface = getMontiorRequest.results[interfaceNameValue];
                    model = interfaceClassObj.interface(pathArray, null, monitorInterface, null);
                    return model;
                case 'interfaces/interface/subinterfaces/subinterface/state/counters/out-pkts/':
                    monitorPath = '/api/v2/monitor/system/interface/';

                    getMontiorRequest = await this.getRequest(monitorPath, {
                        interface_name: interfaceNameValue
                    });
                    monitorInterface = getMontiorRequest.results[interfaceNameValue];
                    model = interfaceClassObj.interface(pathArray, null, monitorInterface, null);
                    return model;
                case 'interfaces/interface/subinterfaces/subinterface/state/counters/out-errors/':
                    monitorPath = '/api/v2/monitor/system/interface/';

                    getMontiorRequest = await this.getRequest(monitorPath, {
                        interface_name: interfaceNameValue
                    });
                    monitorInterface = getMontiorRequest.results[interfaceNameValue];
                    model = interfaceClassObj.interface(pathArray, null, monitorInterface, null);
                    return model;
                case 'interfaces/interface/subinterfaces/subinterface/state/counters/out-octets/':
                    monitorPath = '/api/v2/monitor/system/interface/';

                    getMontiorRequest = await this.getRequest(monitorPath, {
                        interface_name: interfaceNameValue
                    });
                    monitorInterface = getMontiorRequest.results[interfaceNameValue];
                    model = interfaceClassObj.interface(pathArray, null, monitorInterface, null);
                    return model;
                case 'interfaces/interface/subinterfaces/subinterface/state/counters/in-octets/':
                    monitorPath = '/api/v2/monitorwe/system/interface/';

                    getMontiorRequest = await this.getRequest(monitorPath, {
                        interface_name: interfaceNameValue
                    });
                    monitorInterface = getMontiorRequest.results[interfaceNameValue];
                    model = interfaceClassObj.interface(pathArray, null, monitorInterface, null);
                    return model;
                // Uptime returend via last reboot time.
                case 'interfaces/interface/subinterfaces/subinterface/state/counters/last-clear':
                    uptimePath = '/api/v2/monitor/web-ui/state';
                    getUptimeRequest = await this.getRequest(uptimePath, '');

                    model = interfaceClassObj.interface(pathArray, null, null, getUptimeRequest);
                    return model;

                case 'interfaces/interface/subinterfaces/subinterface/subinterfaces/':
                    console.log('subinterfaces not implmented yet');
                    break;
                case 'interfaces/interface/subinterfaces/subinterface/hold-time/':
                    console.log('Path not implmented yet');
                    break;
                //TODO: respond as oc-ip:address
                case 'interfaces/interface/subinterfaces/subinterface/ipv4/addresses/':
                    monitorPath = '/api/v2/monitor/system/interface/';

                    cmdbPath = '/api/v2/cmdb/system/interface/';
                    monitorPath = '/api/v2/monitor/system/interface/';
                    uptimePath = '/api/v2/monitor/web-ui/state';
                    let proxyarp = '/api/v2/cmdb/system/proxy-arp';
                    let vpnTunnel = '/api/v2/monitor/vpn/ipsec';
                    let tunnelTest = '/api/v2/cmdb/system/gre-tunnel';
                    // let getProxyArp = await this.getRequest(proxyarp, {});
                    let neighborsPath = '/api/v2/monitor/network/lldp/neighbors';
                    //let getNeighbors = await this.getRequest(neighborsPath, {});
                    let arpPath = '/api/v2/monitor/system/available-interfaces';
                    let dot1xPath = '/api/v2/cmdb/switch-controller.security-policy/802-1X';
                    let getArp = await this.getRequest(arpPath, {
                        datasource: true,
                        start: 0,
                        count: 10000,
                        id: 0
                    });
                    let getTunnelTest = await this.getRequest(tunnelTest, {});
                    console.log('*** Tunnel test gre ' + JSON.stringify(getTunnelTest));
                    let getVPNTunnel = await this.getRequest(vpnTunnel, {});
                    getUptimeRequest = await this.getRequest(uptimePath, '');
                    fullPath = cmdbPath + interfaceNameValue;
                    data = '';
                    getRequest = await this.getRequest(fullPath, data);
                    getMontiorRequest = await this.getRequest(monitorPath, {
                        //interface_name: interfaceNameValue
                    });
                    let dot1xPathRequest = await this.getRequest(dot1xPath, data);

                    monitorInterface = getMontiorRequest.results[interfaceNameValue];
                    console.log('IPV4 call getArp' + JSON.stringify(getArp));
                    //console.log('IPV4 call getProxyArp' + JSON.stringify(getProxyArp));
                    //console.log('IPV4 call getNeighbors' + JSON.stringify(getNeighbors));
                    console.log('IPV4 call getMontiorRequest' + JSON.stringify(getMontiorRequest));
                    console.log('IPV4 call getRequest' + JSON.stringify(getRequest));
                    console.log('IPV4 call dot1xPathRequest' + JSON.stringify(dot1xPathRequest));
                    console.log('IPV4 call vpn' + JSON.stringify(getVPNTunnel));

                    model = interfaceClassObj.interface(pathArray, getRequest, monitorInterface, getUptimeRequest);
                    return model;
                case 'interfaces/interface/tunnel/':
                    cmdbPath = '/api/v2/cmdb/system/interface/';
                    monitorPath = '/api/v2/monitor/system/interface/';
                    uptimePath = '/api/v2/monitor/web-ui/state';
                    let tunnelInfoPath = '/api/v2/monitor/system/available-interfaces';
                    //TODO: call only if gre?
                    let greTunnelInfoPath = '/api/v2/cmdb/system/gre-tunnel';
                    let tunnelPath = '/api/v2/monitor/vpn/ipsec';
                    let getTunnel = await this.getRequest(tunnelPath, {});
                    let getTunnelInfo = await this.getRequest(tunnelInfoPath, {});
                    let getGreTunnelInfo = await this.getRequest(greTunnelInfoPath, {});
                    getUptimeRequest = await this.getRequest(uptimePath, '');
                    fullPath = cmdbPath + interfaceNameValue;
                    data = '';
                    getRequest = await this.getRequest(fullPath, data);
                    getMontiorRequest = await this.getRequest(monitorPath, {
                        interface_name: interfaceNameValue
                    });
                    monitorInterface = getMontiorRequest.results[interfaceNameValue];
                    model = interfaceClassObj.interface(
                        pathArray,
                        getRequest,
                        monitorInterface,
                        getUptimeRequest,
                        null,
                        getTunnel,
                        getTunnelInfo,
                        getGreTunnelInfo,
                        interfaceNameValue
                    );
                    console.log('Returned Model' + JSON.stringify(model));
                    return model;
                default:
                    console.log('path not in cases, attempting to lookup.');
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
                    model = interfaceClassObj.interface(pathArray, getRequest, monitorInterface, getUptimeRequest);
                    console.log('Returned Model' + JSON.stringify(model));
                    return model;
                //return { val: 'Path Not implmented yet.' };
            }
        } else if (pathArray[0] === 'local-routes') {
            console.log('LocalRoutes');
            switch (fullPath) {
                case 'local-routes':
                    localRoutePath = '/api/v2/cmdb/router/static/';
                    monitorPath = '/api/v2/monitor/system/interface/';
                    uptimePath = '/api/v2/monitor/web-ui/state';
                    getUptimeRequest = await this.getRequest(uptimePath, '');
                    fullPath = cmdbPath + interfaceNameValue;
                    data = '';
                    getRequest = await this.getRequest(localRoutePath, data);
                    getMontiorRequest = await this.getRequest(monitorPath, {
                        interface_name: interfaceNameValue
                    });
                    monitorInterface = getMontiorRequest.results[interfaceNameValue];
                    model = interfaceClassObj.localRoutes(pathArray, getRequest);
                    return model;
                default:
                    localRoutePath = '/api/v2/cmdb/router/static/';
                    monitorPath = '/api/v2/monitor/system/interface/';
                    uptimePath = '/api/v2/monitor/web-ui/state';
                    getUptimeRequest = await this.getRequest(uptimePath, '');
                    fullPath = cmdbPath + interfaceNameValue;
                    data = '';

                    getRequest = await this.getRequest(localRoutePath, data);
                    for (let i of getRequest?.results) {
                        if (i.dst === prefixName) {
                            model = interfaceClassObj.localRoutes(pathArray, getRequest);
                            return model;
                        }
                    }
                    console.log('Local Routes' + JSON.stringify(getRequest));
                    model = interfaceClassObj.localRoutes(pathArray, getRequest);
                    return model;

                // Return evaluated config.
            }
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
