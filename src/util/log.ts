'use strict';
const fs = require('fs');
const path = require('path');

const LOG_DIRECTORY = path.join(__dirname, '..', 'logs');

class LOG_MODE {
    static readonly CONSOLE: string = 'console';
    static readonly FILE: string = 'file';
    static readonly BOTH: string = 'both';
}

class LOG_LEVEL {
    static readonly INFO: string = 'info';
    static readonly WARN: string = 'warn';
    static readonly ERROR: string = 'error';
}

class Log {
    filename: string;

    readonly LOG_MODE: LOG_MODE = LOG_MODE;
    readonly LOG_LEVEL: LOG_LEVEL = LOG_LEVEL;

    private _logContents: string;
    private _logMode: string;

    constructor() {
        this.filename = `log_${Date.now()}`;
        this._logContents = '';
    }

    init(mode: string = LOG_MODE.CONSOLE) {
        if (!fs.existsSync(LOG_DIRECTORY)) {
            fs.mkdirSync(LOG_DIRECTORY);
        }

        this._logMode = mode;
        this._addToLog('BEGIN LOG');
    }

    /**
     * Clear all unflushed log contents.
     *
     */
    clear() {
        this._logContents = '';
        this._writeToConsole('Log cleared.');
    }

    private _addToLog(msg: string) {
        this._logContents += `${msg}\n`;
    }

    /**
     * Write all current log contents to the log file.
     *
     */
    flush() {
        fs.writeFileSync(path.join(LOG_DIRECTORY, `${this.filename}.log`), this._logContents);
        this._writeToConsole(`Log File: ${this.filename}`);
    }

    private _stringify(e: Error | object | string) {
        let errString = '';
        if (e instanceof Error) {
            errString = e.toString();
        } else if (typeof e === 'object') {
            errString = JSON.stringify(e, null, 4);
        }
        return errString;
    }

    /**
     * Write logs. If overrideMode is defined, write to the override destination.
     * Otherwise, will write to the destination defined on initialization.
     *
     */
    private _write(
        msg: Error | object | string,
        { overrideMode, level }: { overrideMode?: string, level?: string }
    ) {
        if (typeof msg !== 'string') {
            msg = this._stringify(msg);
        }
        let mode = this._logMode;
        if (overrideMode) {
            mode = overrideMode;
        }
        if (mode === LOG_MODE.CONSOLE) {
            this._writeToConsole(msg, level);
        } else if (mode === LOG_MODE.FILE) {
            this._writeToFile(msg);
        } else {
            this._writeToConsole(msg, level);
            this._writeToFile(msg);
        }
    }

    private _writeToConsole(msg: string, level: string = LOG_LEVEL.INFO) {
        console[level](msg);
    }

    private _writeToFile(msg: string) {
        this._addToLog(msg);
    }

    /**
     * Log error message in console.
     *
     */
    error(msg: Error | object | string) {
        this._error(msg, LOG_MODE.CONSOLE);
    }

    private _error(msg: Error | object | string, overrideMode?: string) {
        msg = this._stringify(msg);
        this._write(`ERROR - ${Date.now().toString()}: ${msg}`, {
            overrideMode,
            level: LOG_LEVEL.ERROR
        });
    }

    /**
     * Log info message in console.
     *
     */
    info(msg: object | string) {
        this._info(msg, LOG_MODE.CONSOLE);
    }

    private _info(msg: Error | object | string, overrideMode?: string) {
        msg = this._stringify(msg);
        this._write(`INFO - ${Date.now().toString()}: ${msg}`, {
            overrideMode,
            level: LOG_LEVEL.INFO
        });
    }

    /**
     * Log warn message in console.
     *
     */
    warn(msg: Error | object | string) {
        this._warn(msg, LOG_MODE.CONSOLE);
    }

    private _warn(msg: Error | object | string, overrideMode?: string) {
        msg = this._stringify(msg);
        this._write(`WARN - ${Date.now().toString()}: ${msg}`, {
            overrideMode,
            level: LOG_LEVEL.WARN
        });
    }
}

const log = new Log();

export { log };
