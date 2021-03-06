'use strict';
let net = require('net');
let debug = require('debug')('mpv-ipc');

class BasicMPVClient {

        constructor(socketPath) {
                this.handlers = {};
                this.commands = {};
                this.request_id = 1;
                if (socketPath instanceof net.Socket) {
                        this.socket = socketPath;
                } else {
                        this.socket = net.connect(socketPath);
                }
                this.socket.on('connect', () => this.emit('connect'));
                this.socket.on('data', data => this.handleData(data));
                this.socket.on('close', (e) => this.emit('close', e))
        }

        on(event, handler) {
                this.handlers[event] = this.handlers[event] || [];
                this.handlers[event].push(handler);
                return handler;
        }

        off(event, handler) {
                this.handlers[event] = this.handlers[event].filter(h => h !== handler);
        }

        emit(event, ...args) {
                if (!(event in this.handlers))
                        return;
                for (var h of this.handlers[event]) {
                        h(...args);
                }
        }

        handleData(data) {
                let events = data.toString().trim().split('\n');
                for (var e of events) {
                        debug('<- ' + e);

                        let evt = JSON.parse(e);
                        this.handleEvent(evt);
                }
        }

        handleEvent(evt) {
                if (evt.request_id) {
                        let [resolve, reject] = this.commands[evt.request_id];
                        delete this.commands[evt.request_id];
                        (evt.error === 'success') ? resolve(evt.data) : reject(evt.error);
                } else {
                        this.emit('event', evt);
                        this.emit(evt.event, evt);
                }
        }

        command(...args) {
                let p = new Promise((resolv, reject) => {
                        this.commands[this.request_id] = [resolv, reject];
                });
                let command = JSON.stringify({command: args, request_id: this.request_id});
                this.socket.write(command + '\n');
                this.request_id++;

                debug('-> ' + command);
                return p;
        }

}


module.exports = { BasicMPVClient };
