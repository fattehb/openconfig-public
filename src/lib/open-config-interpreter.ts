import { log } from '../util/log';
import { FortiGateAPIRequests } from './fortigate-api-requests';
import * as path from 'path';
// TODO: fix yang-js imports
const Yang = require('yang-js');

class OpenConfigInterpreter {
    static DEFAULT_POLL_INTERVAL: number = 5000;

    private _openconfigInterfacesModel;

    constructor(
        private readonly _pollInterval: number, // milliseconds
        private readonly _fortigateIp: string,
        private readonly _fortigateApiKey: string
    ) {
        this._openconfigInterfacesModel = Yang.import(path.resolve(
            __dirname, '../openconfig/release/models/interfaces/openconfig-interfaces.yang')
        );
    }

    public async putInterface(call, callback) {
        log.info('called putInterface');
    }
    // Set requests have been split out due to the nature in which they are evaluated/logic assignment.
    public async setModelRequests(pathRequest) {
        let fullPath = '',
            interfaceNameValue,
            cmdbPath,
            data,
            getRequest,
            postRequest,
            typeValue,
            postValue;
        log.info(`pathrequest for set ${JSON.stringify(pathRequest)}`);
        if (pathRequest?.update) {
            interfaceNameValue = pathRequest.update[0].path.elem[1].key.name;
            // Value presented by the gNMI
            // Value wil be int_val/string_val etc. Can easily tell which, by grabbing value
            typeValue = pathRequest.update[0].val.value;
            postValue = pathRequest.update[0].val[typeValue];
            log.info(`postvalue ${postValue}`);
            log.info('Set Update Request');
            // Construct the path
            for (const item of pathRequest.update[0].path.elem) {
                // TODO: account for multiple names etc:
                fullPath = `${fullPath + item.name}/`;
            }
            log.info(fullPath);
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

                // This means that we must create an interface type, based on the name:
                let interfaceType;

                const acceptedInterfaceTypes = ['physical', 'loopback'];
                // 'aggregate', 'redundant', 'tunnel', 'loopback'];

                for (const i of acceptedInterfaceTypes) {
                    if (interfaceNameValue.toLowerCase().includes(i)) {
                        interfaceType = i;
                        log.info(`Assuming interface type: ${i}`);
                    }
                }
                if (interfaceType === null) {
                    // TODO: errors needs to be sent to the gNMI client instead.
                    const err = new Error(`
                    Could not determine interfacetype from name ${interfaceNameValue}. Current accepted types are:
                    physical loopback
                    `);
                    log.error(err.message);
                    throw err;
                }

                cmdbPath = '/api/v2/cmdb/system/interface/';
                fullPath = cmdbPath;
                data = {
                    name: interfaceNameValue,
                    vdom: 'root',
                    type: interfaceType
                };
                log.info(`Post Data${JSON.stringify(data)}`);
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
                log.info('Path not implmented yet');
                return -1;
        }
    }

    public async translatePath(pathRequest) {
        // TODO: currently assumes just interface.
        // TODO:Normalize data,
        // TODO: accept multiple values for interface etc
        // TODO: accept wildcard
        // TODO: accept on_change value.
        // TODO: seperate into sepearte classes? for each model.
        // TODO: for models, keep one master, with apicalls etc, call from that section of the model for the respective paths. One place to update in this case

        let cmdbPath;
        let monitorPath;
        // let interfaceNameValue = pathRequest.path.elem[1].key.name; <---subscribe
        let interfaceNameValue;
        let data;
        let getRequest;
        let getMontiorRequest;
        let monitorInterface;
        let uptimePath;
        let uptime;
        let readOnlyData;
        let getUptimeRequest;
        let transformConfigtoJSON;
        let configObj;

        let fullPath = '';
        log.info(`Path Request${JSON.stringify(pathRequest)}`);
        // Subscribe commands shows as:
        // for (const item of pathRequest.path.elem) {
        if (pathRequest?.subscription) {
            log.info('Subscription Request sent');
            // Subscription path contains an array at elem but not at path.
            for (const item of pathRequest.subscription[0].path.elem) {
                // TODO: account for multiple names etc:
                fullPath = `${fullPath + item.name}/`;
                interfaceNameValue = pathRequest.subscription[0].path.elem[1].key.name;
                // TODO account for multiple names etc:
                log.info(`item ${JSON.stringify(item)}`);
            }
        } else {
            // Assume Get request, if not sub.
            // get request contains an array at path, but not at elem.
            for (const item of pathRequest.path[0].elem) {
                fullPath = `${fullPath + item.name}/`;
                interfaceNameValue = pathRequest.path[0].elem[1].key.name;
                // TODO account for multiple names etc.
                log.info(`item ${JSON.stringify(item)}`);
            }
        }

        // Assume sub ATM
        //     //TODO: error check.
        log.info(`Constructed RestAPI Path: ${fullPath}`);
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
                log.info(JSON.stringify(monitorInterface));
                log.info(`FortiGate Rest Response: ${JSON.stringify(getMontiorRequest)}`);

                // Convert Data
                configObj = this._openconfigInterfacesModel.eval(
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
                const configObjtoJSON = configObj.toJSON();
                log.info(
                    `config object items ${configObjtoJSON['openconfig-interfaces:interfaces'].interface[0].name}`
                );
                log.info(`configObject${JSON.stringify(configObj.toJSON())}`);
                const readOnlyData = {
                    state: {
                        name: getRequest.results[0].name,
                        type: 'IF_ETHERNET',
                        mtu: getRequest.results[0].mtu,
                        'loopback-mode': false,
                        description: getRequest.results[0].description,
                        enabled: getRequest.results[0].status === 'up',
                        ifindex: getRequest.results[0].status.vindex,
                        'admin-status': getRequest.results[0].status === 'up' ? 'UP' : 'DOWN',
                        'oper-status': getRequest.results[0].status === 'up' ? 'UP' : 'DOWN',
                        // logical TODO:look into this.
                        counters: {
                            'in-octets': monitorInterface.rx_bytes,
                            'in-pkts': monitorInterface.rx_packets,
                            // "in-unicast-pkts":
                            // "in-broadcast-pkts":
                            // "in-multicast-pkts":
                            // "in-discards":
                            'in-errors': monitorInterface.rx_errors,
                            // "in-unknown-protos":
                            // "in-fcs-errors":
                            'out-octets': monitorInterface.tx_bytes,
                            'out-pkts': monitorInterface.tx_packets,
                            // "out-unicast-pkts":
                            // "out-broadcast-pkts":
                            // "out-multicast-pkts":
                            // "out-discards":
                            'out-errors': monitorInterface.tx_errors,
                            // "carrier-transitions":
                            'last-clear': getUptimeRequest.results.utc_last_reboot
                        }
                    }
                };
                // configObjtoJSON['openconfig-interfaces:interfaces'].interface[0].state
                log.info(`CONFIGOBJECT COMBINED ${JSON.stringify(configObjtoJSON)}`);
                const combinedObj = configObjtoJSON['openconfig-interfaces:interfaces'];
                combinedObj.interface[0].sate = readOnlyData.state;

                log.info(`Combined Data${JSON.stringify(combinedObj)}`);
                return combinedObj;

            // Return evaluated config.
            case 'interfaces/interface/config/':
                cmdbPath = '/api/v2/cmdb/system/interface/';

                fullPath = cmdbPath + interfaceNameValue;
                data = '';
                getRequest = await this.getRequest(fullPath, data);

                // Convert Data
                const configValues = this._openconfigInterfacesModel.eval(
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
                const configValuestoJSON = configValues.toJSON();
                return configValuestoJSON['openconfig-interfaces:interfaces'].interface[0];
            case 'interfaces/interface/config/name/':
                cmdbPath = '/api/v2/cmdb/system/interface/';

                fullPath = cmdbPath + interfaceNameValue;
                data = '';
                getRequest = await this.getRequest(fullPath, data);

                // Convert Data
                const getNameConfig = this._openconfigInterfacesModel.eval(
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
                const getNametoJSON = getNameConfig.toJSON();
                return getNametoJSON['openconfig-interfaces:interfaces'].interface[0].name;

            case 'interfaces/interface/config/type/':
                cmdbPath = '/api/v2/cmdb/system/interface/';

                fullPath = cmdbPath + interfaceNameValue;
                data = '';
                getRequest = await this.getRequest(fullPath, data);

                // Convert Data
                configObj = this._openconfigInterfacesModel.eval(
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
                return transformConfigtoJSON['openconfig-interfaces:interfaces'].interface[0].config
                    .type;

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
                const stateData = {
                    state: {
                        name: getRequest.results[0].name,
                        type: 'IF_ETHERNET',
                        mtu: getRequest.results[0].mtu,
                        'loopback-mode': false,
                        description: getRequest.results[0].description,
                        enabled: getRequest.results[0].status === 'up',
                        ifindex: getRequest.results[0].status.vindex,
                        'admin-status': getRequest.results[0].status === 'up' ? 'UP' : 'DOWN',
                        'oper-status': getRequest.results[0].status === 'up' ? 'UP' : 'DOWN',
                        // logical TODO:look into this.
                        counters: {
                            'in-octets': monitorInterface.rx_bytes,
                            'in-pkts': monitorInterface.rx_packets,
                            // "in-unicast-pkts":
                            // "in-broadcast-pkts":
                            // "in-multicast-pkts":
                            // "in-discards":
                            'in-errors': monitorInterface.rx_errors,
                            // "in-unknown-protos":
                            // "in-fcs-errors":
                            'out-octets': monitorInterface.tx_bytes,
                            'out-pkts': monitorInterface.tx_packets,
                            // "out-unicast-pkts":
                            // "out-broadcast-pkts":
                            // "out-multicast-pkts":
                            // "out-discards":
                            'out-errors': monitorInterface.tx_errors,
                            // "carrier-transitions":
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
                const counterData = {
                    counters: {
                        'in-octets': monitorInterface.rx_bytes,
                        'in-pkts': monitorInterface.rx_packets,
                        // "in-unicast-pkts":
                        // "in-broadcast-pkts":
                        // "in-multicast-pkts":
                        // "in-discards":
                        'in-errors': monitorInterface.rx_errors,
                        // "in-unknown-protos":
                        // "in-fcs-errors":
                        'out-octets': monitorInterface.tx_bytes,
                        'out-pkts': monitorInterface.tx_packets,
                        // "out-unicast-pkts":
                        // "out-broadcast-pkts":
                        // "out-multicast-pkts":
                        // "out-discards":
                        'out-errors': monitorInterface.tx_errors,
                        // "carrier-transitions":
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
                const inPackets = {
                    'in-pkts': monitorInterface.rx_packets
                };
                return inPackets;
            case 'interfaces/interface/state/counters/in-errors/':
                monitorPath = '/api/v2/monitor/system/interface/';

                getMontiorRequest = await this.getRequest(monitorPath, {
                    interface_name: interfaceNameValue
                });
                monitorInterface = getMontiorRequest.results[interfaceNameValue];
                const inErrors = {
                    'in-errors': monitorInterface.rx_errors
                };
                return inErrors;
            case 'interfaces/interface/state/counters/out-pkts/':
                monitorPath = '/api/v2/monitor/system/interface/';

                getMontiorRequest = await this.getRequest(monitorPath, {
                    interface_name: interfaceNameValue
                });
                monitorInterface = getMontiorRequest.results[interfaceNameValue];
                const outPkts = {
                    'out-pkts': monitorInterface.tx_packets
                };
                return outPkts;
            case 'interfaces/interface/state/counters/out-errors/':
                monitorPath = '/api/v2/monitor/system/interface/';

                getMontiorRequest = await this.getRequest(monitorPath, {
                    interface_name: interfaceNameValue
                });
                monitorInterface = getMontiorRequest.results[interfaceNameValue];
                const outErrors = {
                    'out-errors': monitorInterface.tx_errors
                };
                return outErrors;
            case 'interfaces/interface/state/counters/out-octets/':
                monitorPath = '/api/v2/monitor/system/interface/';

                getMontiorRequest = await this.getRequest(monitorPath, {
                    interface_name: interfaceNameValue
                });
                monitorInterface = getMontiorRequest.results[interfaceNameValue];
                const outOctets = {
                    'out-octets': monitorInterface.tx_bytes
                };
                return outOctets;
            case 'interfaces/interface/state/counters/in-octets/':
                monitorPath = '/api/v2/monitor/system/interface/';

                getMontiorRequest = await this.getRequest(monitorPath, {
                    interface_name: interfaceNameValue
                });
                monitorInterface = getMontiorRequest.results[interfaceNameValue];
                const inOctets = monitorInterface.rx_bytes;
                // TODO:
                return inOctets;
            // Uptime returend via last reboot time.
            case 'interfaces/interface/state/counters/last-clear':
                uptimePath = '/api/v2/monitor/web-ui/state';
                getUptimeRequest = await this.getRequest(uptimePath, '');

                const lastClear = {
                    'last-clear': getUptimeRequest.results.utc_last_reboot
                };
                return lastClear;

            case 'interfaces/interface/subinterfaces/':
                log.info('subinterfaces not implmented yet');
                break;
            case 'interfaces/interface/hold-time/':
                log.info('Path not implmented yet');
                break;
            default:
                log.info('Path not implmented yet');
                return { val: 'Path Not implmented yet.' };
        }

        return fullPath;
    }

    public JoinPathElems(pathElements) {
        log.info('Joining Path');
        for (const item of pathElements.request.path[0].elem) {
            log.info(`item ${item}`);
        }
    }
    public getFeature(call, callback) {
        callback(null, this.listFeature(call.request, callback));
    }
    // Streaming RPC
    public listFeature(call, callback) {
        log.info('checkFeature');
    }

    public async pollFortigate(path: string, data) {
        const pollFortigate = new FortiGateAPIRequests(
            path,
            this._fortigateIp,
            this._fortigateApiKey,
            false
        );
        return await pollFortigate.httpsGetRequest(data);
    }
    public async postConfig(path: string, data) {
        const postConfig = new FortiGateAPIRequests(
            path,
            this._fortigateIp,
            this._fortigateApiKey,
            false
        );
        return await postConfig.httpsPostRequest(data);
    }
    public async getRequest(path: string, data) {
        const getRequest = new FortiGateAPIRequests(
            path,
            this._fortigateIp,
            this._fortigateApiKey,
            false
        );
        return await getRequest.httpsGetRequest(data);
    }
    public async putConfig(path: string, data) {
        const postConfig = new FortiGateAPIRequests(
            path,
            this._fortigateIp,
            this._fortigateApiKey,
            false
        );
        return await postConfig.httpsPutRequest(data);
    }

    public async waitFunction() {
        return new Promise(resolve => setTimeout(resolve, this._pollInterval));
    }
    // Deprecated
    public ConvertRestToYang(modelType, config) {
        // TODO: convert to own class structure
        // Only works with interface for now

        log.info(`ModelType: ${JSON.stringify(modelType)}`);
        if (modelType.elem[0].name == 'interfaces') {
            log.info('interface selected in ConvertRestToYang');
            let type;
            // TODO:
            if (config.results[0].type == 'physical') {
                const type = 'IF_ETHERNET';
            } else {
                type = 'IF_ETHERNET';
            }
            // Currently assume interface was recieved.
            const obj = this._openconfigInterfacesModel.eval(
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
    // Validated function is for non-config data, i.e readonly
    public convertResttoYang_Validate(modelType, data) {}
}

export { OpenConfigInterpreter };
