import axios from 'axios';
import https from 'https';

export class YangModel {
    public interface(path, getRequest?, monitorInterface?, getUptimeRequest?) {
        //lookup = {"interfaces/interface":
        // ["endpointa", "endpointb"],
        //"interfaces/interface/subinterfaces/subinterface/status": ["endpoint c"]}
        let readOnlyData = {
            interfaces: {
                interface: {
                    state: {
                        name: getRequest?.results[0].name,
                        type: 'IF_ETHERNET',
                        mtu: getRequest?.results[0].mtu,
                        'loopback-mode': false,
                        description: getRequest?.results[0]?.description,
                        enabled: getRequest?.results[0]?.status === 'up' ? true : false,
                        ifindex: getRequest?.results[0]?.status?.vindex,
                        'admin-status': getRequest?.results[0]?.status === 'up' ? 'UP' : 'DOWN',
                        'oper-status': getRequest?.results[0]?.status === 'up' ? 'UP' : 'DOWN',
                        //logical TODO:look into this.
                        counters: {
                            'in-octets': monitorInterface?.rx_bytes,
                            'in-pkts': monitorInterface?.rx_packets,
                            //"in-unicast-pkts":
                            //"in-broadcast-pkts":
                            //"in-multicast-pkts":
                            //"in-discards":
                            'in-errors': monitorInterface?.rx_errors,
                            //"in-unknown-protos":
                            //"in-fcs-errors":
                            'out-octets': monitorInterface?.tx_bytes,
                            'out-pkts': monitorInterface?.tx_packets,
                            //"out-unicast-pkts":
                            //"out-broadcast-pkts":
                            //"out-multicast-pkts":
                            //"out-discards":
                            'out-errors': monitorInterface?.tx_errors,
                            //"carrier-transitions":
                            'last-clear': getUptimeRequest?.results?.utc_last_reboot
                        }
                    }
                }
            }
        };
        // Get data based on array supplied by path[]
        let getObj = path.reduce((x, y) => x[y], readOnlyData);

        console.log('path object' + JSON.stringify(getObj));

        return getObj;
    }
}
