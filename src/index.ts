// TODO: fix yang-js imports
const Yang = require('yang-js');
import { GnmiProtoHandlers } from './lib/gnmi-proto-handlers';
import { CertificateManager } from './lib/cert-manager';
import { log } from './util/log';
import * as process from 'process';
import * as path from 'path';
import * as fs from 'fs';
import * as yargs from 'yargs';
import { Argv } from 'yargs';
import { argParams, ServerConfig, configServer } from './util/config-server';

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

const getServerConfig = (): ServerConfig | null => {
    try {
        const serverConfig = JSON.parse(fs.readFileSync(argParams.CONFIG_FILE).toString());

        if (serverConfig.verbose) {
            // TODO: support verbose mode, a placeholder here
            log.info('Verbose mode on.');
        }

        return serverConfig;
    } catch (e) {
        log.error(e);
        log.error(`Unable to parse config file: ${argParams.CONFIG_FILE}.`);
        return null;
    }
};

const registerArgs = (): void => {
    const argv = yargs
        .command('start', 'Start the server.', (yargs: Argv) => {
            return yargs.usage('Usage: npm start');
        })
        .command('config', 'Configure the arguments for server start script.', (yargs: Argv) => {
            return yargs
                .usage(
                    'Usage: npm run-script config -- --fortigate-api-key <key> --fortigate-ip <ip>'
                )
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
                    describe: 'Port for the server script to listen on.',
                    default: 6031,
                    type: 'number'
                })
                .option('verbose', {
                    alias: 'v',
                    describe: 'Verbose debug mode.',
                    type: 'boolean',
                    default: false
                });
        })
        .help('help')
        .strict(true).argv;

    if (!argv._ || !argv._[0] || !['start', 'config'].includes(argv._[0])) {
        yargs.showHelp();
        log.error('You need at least one command before moving on.');
        process.exit(1);
    }

    if (argv._[0] === 'config') {
        const { fortigateApiKey, fortigateIp, port, verbose }: any = argv;
        if (!fortigateApiKey || !fortigateIp || port == null || verbose == null) {
            yargs.showHelp();
            log.error('Missing server config arguments.');
            process.exit(1);
        }
        configServer({
            fortigateApiKey,
            fortigateIp,
            port,
            verbose
        });
        process.exit(0);
    }

    if (!fs.existsSync(argParams.CONFIG_FILE)) {
        yargs.showHelp();
        log.error(`Missing server script config file: ${argParams.CONFIG_FILE}.`);
        log.error('Run "npm run-script config" first.');
        process.exit(1);
    }
};

exports.main = async (context, req, res): Promise<void> => {
    registerArgs();

    const config = getServerConfig();
    if (!config) {
        process.exit(1);
    }

    const serverUrl = `0.0.0.0:${config.port}`;

    log.init();
    log.info('Function Started');
    log.info(`FortiGate Address: ${config.fortigateIp}`);
    log.info(`Server Address: ${serverUrl}`);
    const yangImportList = [
        `${__dirname}/openconfig/third_party/ietf/ietf-interfaces.yang`,
        `${__dirname}/openconfig/release/models/types/openconfig-yang-types.yang`,
        `${__dirname}/openconfig/release/models/types/openconfig-types.yang`,
        `${__dirname}/openconfig/release/models/openconfig-extensions.yang`,
        `${__dirname}/openconfig/release/models/interfaces/openconfig-interfaces.yang`
    ];

    // gRPC
    const gRPCServiceHandler = new GnmiProtoHandlers(config.fortigateApiKey, config.fortigateIp);
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
    server.bind(serverUrl, certManager.createServerCredentials());
    server.start();
    log.info(`Server listening to traffic on ${config.port}`);
};

if (module === require.main) {
    exports.main();
}
