// TODO: fix yang-js imports
const Yang = require('yang-js');
import { GnmiProtoHandlers } from './lib/gnmi-proto-handlers';
import { CertificateManager } from './lib/cert-manager';
import { log } from './util/log';
import * as path from 'path';
import * as yargs from 'yargs';
import { Argv } from "yargs";

const DEFAULT_LISTEN_ON_PORT = 6031;

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

interface CliArgs {
    fortigateApiKey: string;
    fortigateIp: string;
    port: number;
}

const getCliArgs = () : CliArgs => {
    const argv = yargs
        .command('start', "Start the server.", (yargs: Argv) => {
            return yargs
                .usage('Usage: $0 --fortigate-api-key <key> --fortigate-ip <ip>')
                .option('fortigate-api-key', {
                    describe: 'FortiGate API key.',
                    type: 'string',
                    demand: true
                })
                .option('fortigate-ip', {
                    describe: 'FortiGate IP.',
                    type: 'string',
                    demand: true
                })
                .option('port', {
                    alias: 'p',
                    describe: 'Port to listen on.',
                    default: DEFAULT_LISTEN_ON_PORT,
                    type: 'number'
                })
                .option('verbose', {
                    alias: 'v',
                    describe: 'Verbose mode.',
                    type: 'boolean',
                    default: false
                });
        })
        .strict()
        .argv;
    const {
        fortigateApiKey,
        fortigateIp,
        port
    } : any = argv;

    if (!argv._ || !argv._[0]) {
        yargs.showHelp();
        throw new Error('Missing CLI args.');
    }

    if (argv.verbose) {
        // TODO: support verbose mode, a placeholder here
        log.info("Verbose mode on.");
    }

    return {
        fortigateApiKey,
        fortigateIp,
        port
    };
};

exports.main = async (context, req, res): Promise<void> => {
    const argv = getCliArgs();

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
    const gRPCServiceHandler = new GnmiProtoHandlers(argv.fortigateApiKey, argv.fortigateIp);
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
    server.bind(`0.0.0.0:${argv.port}`, certManager.createServerCredentials());
    server.start();
    log.info(`Server listening to traffic on ${argv.port}`);
};

if (module === require.main) {
    exports.main();
}
