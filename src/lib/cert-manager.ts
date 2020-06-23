import { log } from '../util/log';
import * as fs from 'fs';
import * as grpc from 'grpc';

const DEFAULT_CA_CERT = '../certs/ca.crt',
    DEFAULT_PRIVATE_KEY = '../certs/server.key',
    DEFAULT_CERT_CHAIN = '../certs/server.crt';
const CHECK_CLIENT_CERTIFICATE = false;

export class CertificateManager {
    private _caCert: string;
    private _serverPrivateKey: string;
    private _serverCertChain: string;
    private _checkClientCertificate: boolean;

    private _certs: Array<string>;

    constructor(
        caCert?: string,
        serverPrivateKey?: string,
        serverCertChain?: string,
        checkClientCertificate?: boolean
    ) {
        this._caCert = caCert || DEFAULT_CA_CERT;
        this._serverPrivateKey = serverPrivateKey || DEFAULT_PRIVATE_KEY;
        this._serverCertChain = serverCertChain || DEFAULT_CERT_CHAIN;
        this._checkClientCertificate = checkClientCertificate || CHECK_CLIENT_CERTIFICATE;

        this._certs = [this._caCert, this._serverPrivateKey, this._serverCertChain];
    }

    public createServerCredentials() {
        if (this._hasSecuredCredentials()) {
            log.info('Secured credentials are created.');
            return grpc.ServerCredentials.createSsl(
                fs.readFileSync(this._caCert),
                [
                    {
                        private_key: fs.readFileSync(this._serverPrivateKey),
                        cert_chain: fs.readFileSync(this._serverCertChain)
                    }
                ],
                this._checkClientCertificate
            );
        } else {
            log.info('Insecured credentials are created.');
            return grpc.ServerCredentials.createInsecure();
        }
    }

    private _hasSecuredCredentials() {
        try {
            const unavailable = [];
            for (const cert of this._certs) {
                if (!fs.existsSync(cert)) {
                    unavailable.push(cert);
                }
            }
            if (!unavailable.length) {
                return true;
            } else {
                log.warn('The following certificates are not available:');
                log.warn(unavailable);
                return false;
            }
        } catch (err) {
            log.error(err);
            return false;
        }
    }
}
