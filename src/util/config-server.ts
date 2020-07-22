import { log, LOG_MODE } from './log';
import * as path from 'path';
import * as fs from 'fs';
import * as yargs from 'yargs';
import { Argv } from 'yargs';

const DEFAULT_LISTEN_ON_PORT = 6031;
const ROOT_DIRECTORY = path.join(__dirname, '..');
const DEFAULT_CONFIG_FILE = 'server_config.json';

interface ServerConfig {
    fortigateApiKey: string;
    fortigateIp: string;
    port: number;
    verbose: boolean;
}

const writeArgsToFile = (argv: ServerConfig): void => {
    fs.writeFileSync(path.join(ROOT_DIRECTORY, DEFAULT_CONFIG_FILE), JSON.stringify(argv));
    log.info(`Saved the following args to "/${DEFAULT_CONFIG_FILE}":`, LOG_MODE.CONSOLE);
    for (const [arg, value] of Object.entries(argv)) {
        log.info(`\t${arg}: ${value}`, LOG_MODE.CONSOLE);
    }
};

const saveArgs = (argv: ServerConfig) => {
    writeArgsToFile(argv);
};

const params = {
    CONFIG_FILE: DEFAULT_CONFIG_FILE
};

export { params as argParams, ServerConfig, saveArgs as configServer };
