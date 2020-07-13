// TODO: fix yang-js imports
const Yang = require('yang-js');
import { GnmiProtoHandlers } from './lib/gnmi-proto-handlers';
import { CertificateManager } from './lib/cert-manager';
import { log } from './util/log';
import * as path from 'path';

const listenOnPort = 6031;

const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const PROTO_PATH = `${__dirname}/gnmi/proto/gnmi/gnmi.proto`;

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const loadgNMIProto = grpc.loadPackageDefinition(packageDefinition).gnmi;
// TODO: move imports to package.json file.
const importTest = Yang.import(`${__dirname}/openconfig/third_party/ietf/ietf-interfaces.yang`);
const openconfig_yang_types_model = Yang.import(
    `${__dirname}/openconfig/release/models/types/openconfig-yang-types.yang`
);
const openconfig_type_model = Yang.import(
    `${__dirname}/openconfig/release/models/types/openconfig-types.yang`
);
const openconfig_extensions_model = Yang.import(
    `${__dirname}/openconfig/release/models/openconfig-extensions.yang`
);

exports.main = async (context, req, res): Promise<void> => {
    log.init();
    log.info('Function Started');
    const yangImportList = [
        `${__dirname}/openconfig/third_party/ietf/ietf-interfaces.yang`,
        `${__dirname}/openconfig/release/models/types/openconfig-yang-types.yang`,
        `${__dirname}/openconfig/release/models/types/openconfig-types.yang`,
        `${__dirname}/openconfig/release/models/openconfig-extensions.yang`,
        `${__dirname}/openconfig/release/models/interfaces/openconfig-interfaces.yang`
    ];
    // gRPC
    const gRPCServiceHandler = new GnmiProtoHandlers();
    const server = new grpc.Server();

    // var stub = new helloworld.Greeter('myservice.example.com', ssl_creds);
    // TODO: move into seperate class.
    server.addService(loadgNMIProto.gNMI.service, {
        Get: gRPCServiceHandler.Get,
        Set: gRPCServiceHandler.Set,
        Capabilities: gRPCServiceHandler.Capabilities,
        Subscribe: gRPCServiceHandler.Subscribe
    });
    // can call with customized cert files
    const certManager = new CertificateManager();
    server.bind(`0.0.0.0:${listenOnPort}`, certManager.createServerCredentials());
    server.start();
    log.info(`Server listening to traffic on ${listenOnPort}`);
};

if (module === require.main) {
    exports.main(console.log);
}
