var grpc = require('grpc');
var protoLoader = require('@grpc/proto-loader');
var PROTO_PATH = __dirname + '/gnmi/proto/gnmi/gnmi.proto';
import * as CryptoJS from 'crypto-js';
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

        //TODO: provide generic function to build this JSON
        //TODO: error handling return.
        // Named to correspond to GNMI specs.
        let setConfig = new OpenConfigInterpreter(5000, FORTIGATE_IP, FORTIGATE_API_KEY);
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
                    op: 'UPDATE' //Indicates success TODO: accept, multiple values as the return.
                }
            ]
        };
        callback(null, SetResponse);
    }

    public async Capabilities(CapabilityRequest) {
        console.log('Capabilities Not implmented yet.');
    }
    public async Get(GetRequest, callback) {
        //TODO: fix implmentation of openconfig interpreter
        let getConfig = new OpenConfigInterpreter(5000, FORTIGATE_IP, FORTIGATE_API_KEY);

        console.log('GetRequest ' + JSON.stringify(GetRequest));
        console.log('Joining Path');

        let fullPath;
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

                console.log('item ' + JSON.stringify(item));
            }

            let pollCount = 0;
            let pollFor = 10000;
            let tempTime = Date.now();
            let firstPoll = true;
            let md5HashPreviousReturn;
            while (pollCount < pollFor) {
                let currentTime = Date.now();
                if (currentTime > tempTime + 500 || firstPoll === true) {
                    firstPoll = false;
                    tempTime = Date.now();
                    pollCount++;

                    let translatedPath = await getConfig.translatePath(note.subscribe);
                    if (note.subscribe.subscription[0].mode === 'ON_CHANGE') {
                        console.log('Subscription Mode set to ON_CHANGE');
                        let md5HashNewReturn = CryptoJS.MD5(JSON.stringify(translatedPath)).toString();
                        if (md5HashNewReturn !== md5HashPreviousReturn) {
                            console.log('New Data');
                            console.log(JSON.stringify(translatedPath));
                            console.log(md5HashNewReturn);
                            console.log(md5HashNewReturn.toString());

                            console.log(CryptoJS.MD5(JSON.stringify(translatedPath)));
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
                            md5HashPreviousReturn = md5HashNewReturn;
                            call.write(SubscribeResponse);
                        }
                    } else {
                        console.log(`Subscription mode set to ${note.subscribe.subscription[0].mode}`);
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

                        call.write(SubscribeResponse);
                    }
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
}
