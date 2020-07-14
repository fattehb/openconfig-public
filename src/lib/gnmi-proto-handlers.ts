import { log } from '../util/log';

const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const PROTO_PATH = `${__dirname}/gnmi/proto/gnmi/gnmi.proto`;
import * as CryptoJS from 'crypto-js';
import { OpenConfigInterpreter } from './open-config-interpreter';

export class GnmiProtoHandlers {
    constructor(private readonly _fortigateApiKey: string, private readonly _fortigateIp: string) {}

    // Naming Based of gnmi.proto
    public async Set(setRequest, callback) {
        log.info('set request prefix: ', JSON.stringify(setRequest));
        const fullPath = '/';
        let value;
        let operationValue;
        if (setRequest.request.update.length > 1) {
            operationValue = 'UPDATE';
        }

        // TODO: provide generic function to build this JSON
        // TODO: error handling return.
        // Named to correspond to GNMI specs.
        const setConfig = new OpenConfigInterpreter(
            OpenConfigInterpreter.DEFAULT_POLL_INTERVAL,
            this._fortigateIp,
            this._fortigateApiKey
        );
        const setModel = setConfig.setModelRequests(setRequest.request);
        log.info(`SetModel Return${JSON.stringify(setModel)}`);
        const SetResponse = {
            timeStamp: Date.now(),
            prefix: {
                path: setRequest.request.update[0].path
            },
            response: [
                {
                    // deprecated timeStamp: Date.now(),
                    path: { pathKey: fullPath },
                    op: 'UPDATE' // Indicates success TODO: accept, multiple values as the return.
                }
            ]
        };
        callback(null, SetResponse);
    }

    public async Capabilities(CapabilityRequest) {
        log.info('Capabilities Not implmented yet.');
    }

    public async Get(GetRequest, callback) {
        // TODO: fix implmentation of openconfig interpreter
        const getConfig = new OpenConfigInterpreter(
            OpenConfigInterpreter.DEFAULT_POLL_INTERVAL,
            this._fortigateIp,
            this._fortigateApiKey
        );

        log.info(`GetRequest ${JSON.stringify(GetRequest)}`);
        log.info('Joining Path');

        let fullPath;
        const translatedPath = await getConfig.translatePath(GetRequest.request);
        const GetResponse = {
            notification: [
                {
                    timeStamp: Date.now(),
                    prefix: {
                        path: fullPath
                    },
                    update: [
                        {
                            // TODO: Pathkey
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
        const getConfig = new OpenConfigInterpreter(
            OpenConfigInterpreter.DEFAULT_POLL_INTERVAL,
            this._fortigateIp,
            this._fortigateApiKey
        );
        call.on('data', async function (note) {
            let fullPath = '';
            log.info(JSON.stringify(note));
            for (const item of note.subscribe.subscription[0].path.elem) {
                fullPath = `${fullPath + item.name}/`;
                // TODO account for multiple names etc:

                log.info(`item ${JSON.stringify(item)}`);
            }

            let pollCount = 0;
            const pollFor = 10000;
            let tempTime = Date.now();
            let firstPoll = true;
            let md5HashPreviousReturn;
            while (pollCount < pollFor) {
                const currentTime = Date.now();
                if (currentTime > tempTime + 500 || firstPoll === true) {
                    firstPoll = false;
                    tempTime = Date.now();
                    pollCount++;

                    const translatedPath: object = await getConfig.translatePath(note.subscribe);
                    log.info(`TypeOF${typeof translatedPath}`);
                    if (note.subscribe.subscription[0].mode === 'ON_CHANGE') {
                        log.info('Subscription Mode set to ON_CHANGE');
                        const md5HashNewReturn = CryptoJS.MD5(
                            JSON.stringify(translatedPath)
                        ).toString();
                        if (md5HashNewReturn !== md5HashPreviousReturn) {
                            log.info('New Data');
                            log.info(JSON.stringify(translatedPath));
                            log.info(md5HashNewReturn);
                            log.info(md5HashNewReturn.toString());
                            log.info(CryptoJS.MD5(JSON.stringify(translatedPath)));

                            const SubscribeResponse = {
                                update: {
                                    timeStamp: Date.now(),
                                    prefix: {
                                        elem: note.subscribe.subscription[0].path.elem
                                    },
                                    alias: fullPath,

                                    update: [
                                        {
                                            // TODO: Pathkey
                                            path: { pathKey: note.subscribe.subscription[0].path },

                                            val: {
                                                json_ietf_val: Buffer.from(
                                                    JSON.stringify(translatedPath)
                                                )
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
                        log.info(`Subscription mode set to ${note.subscribe.subscription[0].mode}`);

                        const SubscribeResponse = {
                            update: {
                                timeStamp: Date.now(),
                                prefix: {
                                    elem: note.subscribe.subscription[0].path.elem
                                },
                                alias: fullPath,
                                update: [
                                    {
                                        // TODO: Pathkey
                                        path: { pathKey: note.subscribe.subscription[0].path },
                                        val: {
                                            json_ietf_val: Buffer.from(
                                                JSON.stringify(translatedPath)
                                            )
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
            // call.end();
        });
    }
}
