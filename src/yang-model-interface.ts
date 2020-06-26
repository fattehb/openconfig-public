import axios from 'axios';
import https from 'https';

export class YangModel {
    public interface(path, getRequest?, monitorInterface?, getUptimeRequest?, proxyArpData?) {
        //lookup = {"interfaces/interface":
        // ["endpointa", "endpointb"],
        //"interfaces/interface/subinterfaces/subinterface/status": ["endpoint c"]}
        let readOnlyData = {
            interfaces: {
                interface: {
                    state: {
                        name: getRequest?.results[0]?.name,
                        type: 'IF_ETHERNET',
                        mtu: getRequest?.results[0]?.mtu,
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
                            //"in-broadcast-pkts":rw oc-ip:ip        -> ../config/ip
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
                    },
                    subinterfaces: {
                        subinterface: {
                            index: 0, //assume 0 for now
                            config: {
                                index: 0,
                                description: getRequest?.results[0]?.description,
                                enabled: getRequest?.results[0]?.status === 'up' ? true : false
                            },
                            state: {
                                name: getRequest?.results[0]?.name,
                                type: 'IF_ETHERNET',
                                mtu: getRequest?.results[0]?.mtu,
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
                            },
                            ipv4: {
                                addresses: {
                                    address: {
                                        ip: monitorInterface?.ip, //TODO: grab from getrequest instead?
                                        config: {
                                            ip: monitorInterface?.ip,
                                            'prefix-length': monitorInterface?.mask
                                        },
                                        state: {
                                            ip: monitorInterface?.ip,
                                            'prefix-length': monitorInterface?.mask,
                                            origin: getRequest?.results[0]?.mode
                                        },
                                        //TODO: vrrp: this.assembleVrrpData(getRequest)
                                        vrrp: {
                                            'vrrp-group': {
                                                'virtual-router-id': getRequest?.results[0]?.vrrp[0]?.vrid,
                                                config: {
                                                    'virtual-router-id': getRequest?.results[0]?.vrrp[0]?.vrid,
                                                    'virtual-address': getRequest?.results[0]?.vrrp[0]?.vrip,
                                                    priority: getRequest?.results[0]?.vrrp[0]?.priority,
                                                    preempt: getRequest?.results[0]?.vrrp[0]?.preempt,
                                                    //preempt-delay:
                                                    'accept-mode': getRequest?.results[0]?.vrrp[0],
                                                    'advertisement-interval': getRequest?.results[0]?.vrrp[0]
                                                },
                                                state: {
                                                    'virtual-router-id': getRequest?.results[0]?.vrrp[0]?.vrid,
                                                    'virtual-address': getRequest?.results[0]?.vrrp[0]?.vrip,
                                                    priority: getRequest?.results[0]?.vrrp[0]?.priority,
                                                    preempt: getRequest?.results[0]?.vrrp[0]?.preempt,
                                                    //preempt-delay:
                                                    //TODO: add logic for vrrp
                                                    'accept-mode': getRequest?.results[0]?.vrrp?.[0], // .['accept-mode'],
                                                    'advertisement-interval': getRequest?.results[0]?.vrrp[0], //['adv-interval'],
                                                    'current-priority': getRequest?.results[0]?.vrrp[0], //['vrdst-priority'],
                                                    'interface-tracking': {
                                                        config: {
                                                            'track-interface': getRequest?.results[0]?.name
                                                            //'priority-decrement':
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }, //'proxy-arp': {
                                //TODO
                                //},
                                neighbors: {
                                    neighbor: [
                                        {
                                            ip: monitorInterface?.ip,
                                            config: {
                                                ip: monitorInterface?.ip
                                            }
                                        }
                                    ]
                                },
                                //unnumbered:{},
                                config: {
                                    enabled: getRequest?.results[0]?.status === 'up' ? 'UP' : 'DOWN', // assume interface status
                                    mtu: getRequest?.results[0]?.mtu,
                                    'dhcp-client': getRequest?.results[0]?.mode === 'dhcp' ? true : false
                                },
                                state: {
                                    enabled: getRequest?.results[0]?.status === 'up' ? 'UP' : 'DOWN', // assume interface status
                                    mtu: getRequest?.results[0]?.mtu,
                                    'dhcp-client': getRequest?.results[0]?.mode === 'dhcp' ? true : false,
                                    counters: {
                                        'in-octets': monitorInterface?.rx_bytes,
                                        'in-pkts': monitorInterface?.rx_packets,
                                        //in-forwarded-pkts?
                                        //in-forwarded-octets?
                                        'in-error-pkts': monitorInterface?.rx_errors,

                                        'out-octets': monitorInterface?.tx_bytes,
                                        'out-pkts': monitorInterface?.tx_packets,
                                        //out-forwarded-pkts?
                                        //out-forwarded-octets?
                                        'out-errors-pkts': monitorInterface?.tx_errors
                                    }
                                }
                            },

                            ipv6: {
                                addresses: {
                                    //TODO: should be a list
                                    address: {
                                        ip: getRequest?.results[0]?.ipv6?.['ip6-address'],
                                        config: {
                                            ip: getRequest?.results[0]?.ipv6?.['ip6-address'],
                                            'prefix-length': monitorInterface?.mask
                                        },
                                        state: {
                                            ip: getRequest?.results[0]?.ipv6?.['ip6-address'],
                                            'prefix-length': monitorInterface?.mask,
                                            origin: getRequest?.results[0]?.ipv6?.['ip6-mode'],
                                            status: getRequest?.results[0]?.status === 'up' ? 'UP' : 'DOWN'
                                        },
                                        vrrp: {
                                            'vrrp-group': [{}]
                                        }
                                    }
                                },
                                'router-advertisement': {
                                    config: {}
                                },
                                //ipv6 config
                                config: {
                                    enabled: getRequest?.results[0]?.status === 'up' ? 'UP' : 'DOWN',
                                    mtu: getRequest?.results[0]?.ipv6?.['ip6-link-mtu'],
                                    //'dup-addr-detect-transmits'
                                    'dchp-client': getRequest?.results[0]?.ipv6?.['ip6-mode'] === 'dhcp' ? true : false
                                },
                                counters: {
                                    //TODO: verify ipv6 counters. Or any other possible sources.
                                    'in-octets': monitorInterface?.rx_bytes,
                                    'in-pkts': monitorInterface?.rx_packets,
                                    //in-forwarded-pkts?
                                    //in-forwarded-octets?
                                    'in-error-pkts': monitorInterface?.rx_errors,
                                    'out-octets': monitorInterface?.tx_bytes,
                                    'out-pkts': monitorInterface?.tx_packets,
                                    //out-forwarded-pkts?
                                    //out-forwarded-octets?
                                    'out-errors-pkts': monitorInterface?.tx_errors
                                },
                                //TODO: cehck how to enable this on fortigate
                                autoconf: {
                                    config: {
                                        //'create-global-addresses'
                                        //'create-temporary-addresses?',
                                        // 'temporary-valid-lifetime'
                                        // 'temporary-preferred-lifetime'
                                    },
                                    state: {
                                        //'create-global-addresses'
                                        //'create-temporary-addresses?',
                                        // 'temporary-valid-lifetime'
                                        // 'temporary-preferred-lifetime'
                                    }
                                }
                            }
                        }
                    },
                    aggregation: this.assembleAggregationData(getRequest),

                    ethernet: {
                        config: {
                            'mac-address': getRequest?.results[0]?.macaddr,
                            //'auto-negotiate': TODO:
                            'duplex-mode': monitorInterface?.duplex === 1 ? 'FULL' : 'HALF',
                            'port-speed': monitorInterface?.speed
                            //'enable-flow-control?',
                            //oc-lag:aggregate-id?
                        },
                        state: {
                            'mac-address': getRequest?.results[0]?.macaddr,
                            //'auto-negotiate': TODO:
                            'duplex-mode': monitorInterface?.duplex === 1 ? 'FULL' : 'HALF',
                            'port-speed': monitorInterface?.speed
                            //'enable-flow-control?',
                            //oc-lag:aggregate-id?
                        },
                        dot1x: {
                            config: {}
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
    public localRoutes(path, getRequest?) {
        let localRoutesReturn = {
            'local-routes': {
                config: {},
                state: {},
                'static-routes': {
                    static: {
                        config: {
                            prefix: getRequest?.results[0]?.dst,
                            //'set-tag':
                            description: getRequest?.results[0]?.comment
                        },
                        state: {
                            prefix: getRequest?.results[0]?.dst,
                            //'set-tag':
                            description: getRequest?.results[0]?.comment
                        },
                        'next-hops': {
                            'next-hop': {
                                index: getRequest?.results[0]?.['seq-num'],
                                config: {
                                    index: getRequest?.results[0]?.['seq-num'],
                                    'next-hop': getRequest?.results[0]?.gateway,
                                    metric: getRequest?.results[0]?.distance,
                                    rescurse: (getRequest?.results[0]?.device).length > 0 ? false : true
                                },
                                state: {
                                    index: getRequest?.results[0]?.['seq-num'],
                                    'next-hop': getRequest?.results[0]?.gateway,
                                    metric: getRequest?.results[0]?.distance,
                                    rescurse: (getRequest?.results[0]?.device).length > 0 ? false : true
                                }
                            }
                        }
                    }
                },
                'local-aggregates': {
                    aggregate: {
                        prefix: getRequest?.results[0]?.dst
                    },
                    config: {
                        prefix: getRequest?.results[0]?.dst,
                        discard: getRequest?.results[0]?.blackhole === 'disable' ? false : true,
                        //set-tag,
                        description: getRequest?.results[0]?.comment
                    },
                    state: {
                        prefix: getRequest?.results[0]?.dst,
                        discard: getRequest?.results[0]?.blackhole === 'disable' ? false : true,
                        //set-tag,
                        description: getRequest?.results[0]?.comment
                    }
                }
            }
        };
        let getObj = path.reduce((x, y) => x[y], localRoutesReturn);

        console.log('path object' + JSON.stringify(getObj));

        return getObj;
    }
    public assembleProxyArpData(proxyData) {
        //TODO:
    }
    public assembleAggregationData(getRequest): void | Object {
        if (
            getRequest &&
            getRequest.results[0] &&
            getRequest.results[0].type &&
            getRequest.results[0].type === 'aggregate'
        ) {
            let dataReturn = {
                config: {
                    'lag-type': getRequest?.results[0]['lacp-mode'],
                    'min-links': getRequest?.results[0]['min-links']
                },
                state: {
                    'lag-type': getRequest?.results[0]['lacp-mode'],
                    'min-links': getRequest?.results[0]['min-links'],
                    member: getRequest?.results[0]['member']
                    //'lag-speed':getRequest?.results[0]['lacp-speed'],
                }
            };
            return dataReturn;
            //
        } else return;
    }
    public assembleVrrpData(getRequest) {
        if (getRequest?.results[0]?.vrrp[0]?.vrid && (getRequest?.results[0]?.vrrp[0]?.vrid).length > 0) {
            let vrrpModelData = {
                vrrp: {
                    'vrrp-group': {
                        'virtual-router-id': getRequest?.results[0]?.vrrp[0]?.vrid,
                        config: {
                            'virtual-router-id': getRequest?.results[0]?.vrrp[0]?.vrid,
                            'virtual-address': getRequest?.results[0]?.vrrp[0]?.vrip,
                            priority: getRequest?.results[0]?.vrrp[0]?.priority,
                            preempt: getRequest?.results[0]?.vrrp[0]?.preempt,
                            //preempt-delay:
                            'accept-mode': getRequest?.results[0]?.vrrp[0],
                            'advertisement-interval': getRequest?.results[0]?.vrrp[0]
                        },
                        state: {
                            'virtual-router-id': getRequest?.results[0]?.vrrp[0]?.vrid,
                            'virtual-address': getRequest?.results[0]?.vrrp[0]?.vrip,
                            priority: getRequest?.results[0]?.vrrp[0]?.priority,
                            preempt: getRequest?.results[0]?.vrrp[0]?.preempt,
                            //preempt-delay:
                            //TODO: add logic for vrrp
                            'accept-mode': getRequest?.results[0]?.vrrp?.[0], // .['accept-mode'],
                            'advertisement-interval': getRequest?.results[0]?.vrrp[0], //['adv-interval'],
                            'current-priority': getRequest?.results[0]?.vrrp[0], //['vrdst-priority'],
                            'interface-tracking': {
                                config: {
                                    // 'track-interface': getRequest?.results[0]?.name
                                    //'priority-decrement':
                                }
                            }
                        }
                    }
                }
            };
            return vrrpModelData;
        } else {
            return '';
        }
    }
}
