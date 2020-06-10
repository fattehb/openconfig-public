var grpc = require('grpc');
var protoLoader = require('@grpc/proto-loader');
var PROTO_PATH = __dirname + '/gnmi/proto/gnmi/gnmi.proto';
//TODO: seperate openConfigInterpreter logic.
//TODO:ENV vars should be passed to gnmiProtoHandler
import { OpenConfigInterpreter } from './index';
const { FORTIGATE_API_KEY, FORTIGATE_IP } = process.env;

export class GnmiProtoHandlers {
    //TODO:clean up constructors.
    //Naming Based of gnmi.proto
    public async Set(setRequest, callback) {
        console.log('set request prefix: ', JSON.stringify(setRequest));
        let fullPath = '/';
        let value;
        let operationValue;
        if (setRequest.request.update.length > 1) {
            operationValue = 'UPDATE';
        }
        // //TODO: must look for allinstances of update
        // if (setRequest.request.update[0].val.value === 'string_val') {
        //     //TODO: must search for replace/delete/update
        //     value = setRequest.request.update[0].val.string_val;
        // } else if (setRequest.request.update[0].val.value === 'int_val') {
        //     value = setRequest.request.update[0].val.string_val;
        // }

        // for (const item of setRequest.request.update[0].path.elem) {
        //     fullPath = fullPath + item.name + '/';
        //     console.log('item ' + JSON.stringify(item));
        // }

        let data = ' ';
        //TODO: provide generic function to build this JSON
        //TODO: error handling return.
        // Named to correspond to GNMI specs.
        let setConfig = new OpenConfigInterpreter(5000, FORTIGATE_IP, FORTIGATE_API_KEY);
        //let putRequest = await setConfig.putConfig(fullPath, data);
        let setModel = setConfig.setModelRequests(setRequest.request);
        console.log('SetModel Return' + JSON.stringify(setModel));
        let SetResponse = {
            timeStamp: Date.now(),
            prefix: {
                path: setRequest.request.update[0].path
            },
            response: [
                {
                    // deprecated timeStamp: Date.now(),
                    path: { pathKey: fullPath },
                    op: 'UPDATE' //Indicates success
                }
            ]
        };
        callback(null, SetResponse);
        // const openConfigInterpreter = new OpenConfigInterpreter(5000, FORTIGATE_IP, FORTIGATE_API_KEY);
        // let putInterface = await openConfigInterpreter.putConfig(setRequest.replace);
        // console.log(putInterface);
    }

    // for (const item of getUpdatedRouteTable.RouteTables.RouteTable[0].RouteEntrys.RouteEntry) {
    //     if (item.Status !== 'Available') {
    //         return false;
    //     }
    //              {
    // interface: 'port1',
    //name: 'port1',
    //  alias: 'test2'
    //},
    public async Capabilities(CapabilityRequest) {
        console.log('Capabilities Not implmented yet.');
    }
    public async Get(GetRequest, callback) {
        //TODO: fix implmentation of openconfig interpreter
        let getConfig = new OpenConfigInterpreter(5000, FORTIGATE_IP, FORTIGATE_API_KEY);

        console.log('GetRequest ' + JSON.stringify(GetRequest));
        console.log('Joining Path');
        let fullPath;
        // let fullPath = '/';

        // for (const item of GetRequest.request.path[0].elem) {
        //     fullPath = fullPath + item.name + '/';
        //     console.log('item ' + JSON.stringify(item));
        // }

        let translatedPath = await getConfig.translatePath(GetRequest.request);
        let GetResponse = {
            notification: [
                {
                    timeStamp: Date.now(),
                    prefix: {
                        path: fullPath
                    },
                    update: [
                        {
                            //TODO: Pathkey
                            path: { pathKey: 'TODO' },

                            val: {
                                string_val: JSON.stringify(translatedPath)
                            },
                            duplicates: 0
                        }
                    ],
                    Path: 0,
                    atomic: false
                }
            ],
            error: null
        };
        callback(null, GetResponse);
    }

    public Subscribe(call, callback) {
        let getConfig = new OpenConfigInterpreter(5000, FORTIGATE_IP, FORTIGATE_API_KEY);
        call.on('data', async function (note) {
            let fullPath = '';
            console.log(JSON.stringify(note));
            for (const item of note.subscribe.subscription[0].path.elem) {
                fullPath = fullPath + item.name + '/';
                //TODO account for multiple names etc:
                // if (item.key && item.key.key) {
                //     fullPath = fullPath + '[' + item.key.value + ']';
                // }
                console.log('item ' + JSON.stringify(item));
            }

            let pollCount = 0;
            let pollFor = 10000;
            let tempTime = Date.now();
            let firstPoll = true;
            while (pollCount < pollFor) {
                let currentTime = Date.now();
                if (currentTime > tempTime + 500 || firstPoll === true) {
                    firstPoll = false;
                    console.log('true');
                    tempTime = Date.now();
                    pollCount++;
                    //let getRequest = await getConfig.pollFortigate(translatedPath, '');
                    //console.log('FortiGate Rest Response: ' + JSON.stringify(getRequest));
                    //let restConfigtoYang = getConfig.ConvertRestToYang(note.subscribe.subscription[0].path, getRequest);
                    //console.log('get Request ' + JSON.stringify(getRequest));
                    //console.log('Rest to yang', JSON.stringify(restConfigtoYang));
                    //TODO: convert to Response format before returing from restConfigtoYang
                    let translatedPath = await getConfig.translatePath(note.subscribe);
                    let SubscribeResponse = {
                        update: {
                            timeStamp: Date.now(),
                            prefix: {
                                elem: note.subscribe.subscription[0].path.elem
                            },
                            alias: fullPath,

                            update: [
                                {
                                    //TODO: Pathkey
                                    path: { pathKey: note.subscribe.subscription[0].path },

                                    val: {
                                        string_val: JSON.stringify(translatedPath)
                                    },

                                    duplicates: 0
                                }
                            ],
                            Path: 0,
                            atomic: false
                        }
                    };

                    //     update: {
                    //         timestamp: Date.now(),
                    //         prefix: [
                    //             {
                    //                 elem: {
                    //                     name: 'state'
                    //                 }
                    //             },
                    //             {
                    //                 elem: {
                    //                     name: 'port',
                    //                     key: {
                    //                         key: 'port-id',
                    //                         value: '1/1/1'
                    //                     }
                    //                 }
                    //             }
                    //         ]
                    //     }
                    // };

                    call.write(SubscribeResponse);
                }
            }
            if (pollCount > pollFor) {
                call.end();
            }
        });

        call.on('end', function () {
            //call.end();
        });
    }
    // public async Subscribe(SubscribeRequest, callback) {
    //     // stream.on('data', (chunk) => { ... });
    //     SubscribeRequest.on('data', async chunk => {
    // //         console.log('data');
    // //         let fullPath;
    //          console.log(JSON.stringify(chunk));
    //          for (const item of chunk.subscribe.subscription[0].path.elem) {
    //              fullPath = fullPath + item.name + '/';
    //              console.log('item ' + JSON.stringify(item));
    //          }

    //          let getConfig = new OpenConfigInterpreter(5000, FORTIGATE_IP, FORTIGATE_API_KEY);
    //         //let getRequest = getConfig.getRequest(fullPath);
    //         //console.log(getRequest);
    //         let SubscribeResponse = {
    //             response: {
    //                 sync_response: true
    //             }
    //         };
    //         console.log(SubscribeResponse);
    //         SubscribeRequest.write(SubscribeResponse);
    //     });

    //     console.log(JSON.stringify(SubscribeRequest));
    //     console.log(JSON.stringify(SubscribeRequest.request));

    //     let SubscribeResponse = {
    //         response: {
    //             sync_response: true
    //         }
    //     };

    //     SubscribeRequest.write(null, SubscribeResponse);

    //     console.log('Subscribe Not implmented yet');
    // }
}
