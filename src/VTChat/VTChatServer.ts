import https from 'https';
import { Server, Socket } from 'socket.io';
import express from 'express';
import compression from 'compression';
import IDProvider from './IDProvider.js';
import { RoomMessages } from './Enums/RoomMessages.js';
import helmet from 'helmet';
import mediasoup from 'mediasoup';
import { VTChatRoom } from './VTChatRoom.js';
import { ISocketWithPeer } from './Interfaces/ISocketWithPeer.js';
import { IMessage } from './Interfaces/IMessage.js';
import { VTChatPeer } from './VTChatPeer.js';
import { LOGLEVEL, VTChatConfig, VTCodecs, lobbyRoomName, logTags } from './VTChatConfig.js';
import cors from 'cors';
import { Worker, Router, DtlsState, WebRtcTransport } from 'mediasoup/node/lib/types.js';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { MediaType } from './Enums/MediaType.js';
import { IAVStreamBase } from './Interfaces/IAVStreamBase.js';

function shouldCompress(req: express.Request, res: express.Response) {
    if (req.headers['x-no-compression']) {
        // don't compress responses with this request header
        return false
    }

    // fallback to standard filter function
    return compression.filter(req, res)
}

export class VTChatServer {
    httpServer: https.Server;
    app: express.Application;

    socketServer: Server;
    peers: Map<string, VTChatPeer> = new Map();
    rooms: Map<string, VTChatRoom> = new Map();

    workers: Worker[] = [];
    router: Router | undefined = undefined;
    nextMediasoupWorkerIdx: number = 0;

    constructor(port: number, standalone: boolean = false, config?: any) {
        const app = express()
        this.app = app;
        app.use(express.json());
        app.use(compression({ filter: shouldCompress }))

        app.use(helmet.dnsPrefetchControl());
        app.use(helmet.expectCt());
        app.use(helmet.frameguard());
        app.use(helmet.hidePoweredBy());
        app.use(helmet.hsts());
        app.use(helmet.ieNoOpen());
        app.use(helmet.noSniff());
        app.use(helmet.permittedCrossDomainPolicies());
        app.use(helmet.referrerPolicy());
        app.use(helmet.xssFilter());
        app.use(compression({ filter: shouldCompress }))

        if (standalone) {
            app.use(helmet.contentSecurityPolicy({
                directives: {
                    ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                    "default-src": ["'self'", "'ws://" + VTChatConfig.domain + "'"], //, 'nonce-d2VsbCB0aGF0IGVzY2FsYXRlZCBxdWlja2x5IDpP'
                    "script-src": ["'self'"],
                    "img-src": ["'self'"],
                    "frame-src": ["'self'"],
                },
            }));

            app.use('/static', express.static('./build/static', { maxAge: '30d' }));
            app.use('/img', express.static('./build/img', { maxAge: '30d' }));
            app.use('/icons', express.static('./build/icons', { maxAge: '30d' }));

            app.use('/', express.static('./build', { maxAge: 0 }));

            //catchall
            app.get('/*', (req, res) => {
                res.sendFile(process.env.PWD + '/build/index.html');
            })
        } else {
            app.use(cors());
            app.use(helmet.contentSecurityPolicy({
                directives: {
                    ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                    "default-src": ["*"], //, 'nonce-d2VsbCB0aGF0IGVzY2FsYXRlZCBxdWlja2x5IDpP'
                    "script-src": ["*", "'unsafe-inline'"],
                    "img-src": ["*"],
                    "frame-src": ["*"],
                },
            }));

            const CRAWSProxy = createProxyMiddleware(['/ws'], {
                target: 'http://localhost:3000',
                ws: true,
                logLevel: 'debug'
            });
            app.use(CRAWSProxy)

            const CRAProxyRoot = createProxyMiddleware('/', { target: 'http://localhost:3000' });
            app.use(CRAProxyRoot)
        }

        this.httpServer = https.createServer({
            key: VTChatConfig.pKey,
            cert: VTChatConfig.cert
        }, app);
        this.socketServer = new Server(this.httpServer, {
            ...config,
            transports: ['websocket'],
            path: '/api/'
        });
        this.setupSocketServer(this.socketServer);
        this.httpServer.listen(port)

        this.rooms.set(lobbyRoomName, new VTChatRoom(lobbyRoomName, lobbyRoomName));

        console.log('setting up Mediasoup.')
        this.setupMediaSoup();
        console.log('Done!')
    }

    async setupMediaSoup() {
        await this.createWorkers(VTChatConfig.mediasoup.numWorkers);

        const worker = this.getMediasoupWorker();

        const mediaCodecs = VTCodecs;

        this.router = await worker.createRouter({ mediaCodecs: mediaCodecs })
    }

    getMediasoupWorker() {
        const worker = this.workers[this.nextMediasoupWorkerIdx];

        this.nextMediasoupWorkerIdx += 1;

        if (this.nextMediasoupWorkerIdx === this.workers.length) {
            this.nextMediasoupWorkerIdx = 0;
        }

        return worker;
    }

    async createWorkers(workerCount: number) {
        for (let i = 0; i < workerCount; i++) {
            let worker = await mediasoup.createWorker({
                logLevel: LOGLEVEL,
                logTags: logTags,
                rtcMinPort: VTChatConfig.mediasoup.worker.rtcMinPort,
                rtcMaxPort: VTChatConfig.mediasoup.worker.rtcMaxPort,
            })

            worker.on('died', () => {
                console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
                setTimeout(() => process.exit(1), 2000);
            })
            this.workers.push(worker)

            // log worker resource usage
            /*setInterval(async () => {
                const usage = await worker.getResourceUsage();
    
                console.info('mediasoup Worker resource usage [pid:%d]: %o', worker.pid, usage);
            }, 120000);*/
        }
    }

    getRoomState(room: string) {
        const chatRoom = this.rooms.get(room);
        if (chatRoom === undefined) {
            console.error('[VTChat :: VTChatServer.ts] Tried to get state of a room that doesn\'t exist: "' + room + '"');
            return;
        }

        return chatRoom.getRoomState();
    }

    makePeerJoinRoom(peer: VTChatPeer, room: string) {
        const chatRoom = this.rooms.get(room);
        if (chatRoom === undefined) {
            console.error('[VTChat :: VTChatServer.ts] Tried to join a room that doesn\'t exist: "' + room + '"');
            return;
        }

        return chatRoom.addPeer(peer);

    }

    makePeerLeaveRoom(peer: VTChatPeer, room: string) {
        const chatRoom = this.rooms.get(room);
        if (chatRoom === undefined) {
            console.error('[VTChat :: VTChatServer.ts] Tried to leave a room that doesn\'t exist: "' + room + '"');
            return;
        }

        return chatRoom.removePeer(peer);
    }

    setupEventHandlers(socket: ISocketWithPeer) {
        socket.on(RoomMessages.chatMessage, (payload, callback) => this.chatMessageHandler(socket, payload, callback));
        socket.on(RoomMessages.fetchRouterRtpCapabilities, (payload, callback) => this.fetchRouterRtpCapabilities(socket, payload, callback));

        socket.on(RoomMessages.askRouterToAcceptMyStream, (payload, callback) => this.askRouterToAcceptMyStream(socket, payload, callback));
        socket.on(RoomMessages.askRouterToConnectMyTransport, (payload, callback) => this.askRouterToConnectMyTransport(socket, payload, callback));
        socket.on(RoomMessages.askRouterToCreateTransport, (payload, callback) => this.askRouterToCreateTransport(socket, payload, callback));
        socket.on(RoomMessages.askRouterToJoinRoom, (payload, callback) => this.askRouterToJoinRoom(socket, payload, callback));
        socket.on(RoomMessages.askRouterToLeaveRoom, (payload, callback) => this.askRouterToLeaveRoom(socket, payload, callback));

        socket.on(RoomMessages.askRouterToSendMeAStream, (payload, callback) => this.askRouterToSendMeAStream(socket, payload, callback));
    }

    failSocket(socket: ISocketWithPeer) {
        console.error('[VTChat :: VTChatServer.ts] User used an invalid rfc. Disconnecting.')
        socket.disconnect();
        return false;
    }

    async chatMessageHandler(socket: ISocketWithPeer, payload: any, callback: Function) {
        if (typeof (payload) === 'function') callback = payload;
        if (callback === undefined) return this.failSocket(socket);

        const roomName = payload.room;
        const message = payload.message;

        console.log('[VTChat :: VTChatServer.ts] Chat message received')
        const peer = socket.VTCPeer;
        const room = this.rooms.get(roomName);
        if (room?.peers.get(peer.id) === undefined) {
            console.error('[VTChat :: VTChatServer.ts] Peer tried to send a message to a channel he\'s not a part of: "' + roomName + '", id:' + socket.VTCPeer.id);
            callback(false);
            return;
        }

        const messageObject: IMessage = {
            id: IDProvider.get(),
            credentials: peer.chatUser.credentials,
            message: message
        }

        room.messages.unshift(messageObject);
        socket.to(roomName).emit(RoomMessages.chatMessage, messageObject)

        callback(messageObject.id);
    }

    async fetchRouterRtpCapabilities(socket: ISocketWithPeer, payload: any, callback: Function) {
        if (typeof (payload) === 'function') callback = payload;
        if (callback === undefined) return this.failSocket(socket);

        callback(this.router?.rtpCapabilities);
    }

    async askRouterToCreateTransport(socket: ISocketWithPeer, payload: any, callback: Function) {
        if (typeof (payload) === 'function') callback = payload;
        if (callback === undefined) return this.failSocket(socket);

        let transport: WebRtcTransport | undefined;
        try {
            transport = await this.createWebRtcTransport(socket);
        } catch (e) {
            if (e instanceof Error) {
                console.error('[VTChat :: VTChatServer.ts] Error during WebRTCTransport cretaion: "' + e.toString() + '"');
            } else {
                console.error('[VTChat :: VTChatServer.ts] Unrecognized error return value "' + e + '"');
            }
            callback({ error: e });
            return false;
        }

        if (transport === undefined) {
            callback({ error: 'transport undefined' });
            console.error('[VTChat :: VTChatServer.ts] Transport undefined');
            return false;
        }

        console.log('---adding transport---', transport.id)
        socket.VTCPeer.addTransport(transport)
        callback({
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters
        });
    }

    askRouterToJoinRoom(socket: ISocketWithPeer, payload: any, callback: Function) {
        if (typeof (payload) === 'function') callback = payload;
        if (callback === undefined) return this.failSocket(socket);

        const result = this.makePeerJoinRoom(socket.VTCPeer, payload);
        callback({ success: result })
    }

    askRouterToLeaveRoom(socket: ISocketWithPeer, payload: any, callback: Function) {
        if (typeof (payload) === 'function') callback = payload;
        if (callback === undefined) return this.failSocket(socket);

        const result = this.makePeerLeaveRoom(socket.VTCPeer, payload);
        callback({ success: result })
    }

    async askRouterToAcceptMyStream(socket: ISocketWithPeer, payload: any, callback: Function) {
        if (typeof (payload) === 'function') callback = payload;
        if (callback === undefined) return this.failSocket(socket);

        //need to be in a room to send a stream;
        if (socket.VTCPeer.room === undefined) {
            callback(false)
            return false;
        }

        const { producerTransportId, rtpParameters, kind } = payload;
        let producer = await socket.VTCPeer.createProducer(producerTransportId, rtpParameters, kind)
        socket.VTCPeer.streamsProduced.transportId = producerTransportId;

        if(kind === MediaType.audio) {
            socket.VTCPeer.streamsProduced.audio = producer;
            socket.VTCPeer.streamsProduced.audioProducerId = producer.id;
        }
        if(kind === MediaType.video) {
            socket.VTCPeer.streamsProduced.video = producer;
            socket.VTCPeer.streamsProduced.videoProducerId = producer.id;
        }
        if(kind === MediaType.screen) {
            socket.VTCPeer.streamsProduced.screen = producer;
            socket.VTCPeer.streamsProduced.screenProducerId = producer.id;
        }
        callback(producer.id)

        const streamInfo: IAVStreamBase = {
            transportId: producerTransportId,
            audioProducerId: socket.VTCPeer.streamsProduced.audioProducerId,
            videoProducerId: socket.VTCPeer.streamsProduced.videoProducerId,
            screenProducerId: socket.VTCPeer.streamsProduced.screenProducerId,
        };

        socket.to(socket.VTCPeer.room.id).emit(RoomMessages.tellClientStreamAvailable, {
            peerID: socket.VTCPeer.id,
            streams: streamInfo
        })

        //if accepted, add it to the list of streams available from clients to the room.

        /*    async produce(socket_id, producerTransportId, rtpParameters, kind) {
            // handle undefined errors
            return new Promise(async function (resolve, reject) {
                let producer = await this.peers.get(socket_id).createProducer(producerTransportId, rtpParameters, kind)
                resolve(producer.id)
                this.broadCast(socket_id, 'newProducers', [{
                    producer_id: producer.id,
                    producer_socket_id: socket_id
                }])
            }.bind(this))
        }*/
    }

    askRouterToConnectMyTransport(socket: ISocketWithPeer, payload: any, callback: Function) {
        if (typeof (payload) === 'function') callback = payload;
        if (callback === undefined) return this.failSocket(socket);

        //unsure.
        const { transport_id, dtlsParameters } = payload;
        socket.VTCPeer.connectTransport(transport_id, dtlsParameters)

        callback('success')
        /*    async connectPeerTransport(socket_id, transport_id, dtlsParameters) {
            if (!this.peers.has(socket_id)) return
            await this.peers.get(socket_id).connectTransport(transport_id, dtlsParameters)
     
        }*/
    }

    async askRouterToSendMeAStream(socket: ISocketWithPeer, payload: any, callback: Function) {
        if (typeof (payload) === 'function') callback = payload;
        if (callback === undefined) return this.failSocket(socket);

        const { consumerTransportId, rtpCapabilities } = payload;
        const offer: IAVStreamBase = payload.offer;

        //console.log('askRouterToSendMeAStream', payload, consumerTransportId, offer.transportId, offer.videoProducerId, offer.audioProducerId, offer.screenProducerId)

        //need to be in a room to send a stream;
        if (socket.VTCPeer.room === undefined) {
            callback(false)
            return false;
        }

        if (!this.router?.canConsume({ producerId: offer.videoProducerId, rtpCapabilities })) {
            console.error('Router cannot consume that stream');
            callback({ error: 'Router cannot consume that stream' })
            return;
        }

        const result: any = {}
        if(offer.videoProducerId) result.video = await socket.VTCPeer.room.letPeerConsume(socket, consumerTransportId, offer.videoProducerId, rtpCapabilities);
        if(offer.audioProducerId) result.audio = await socket.VTCPeer.room.letPeerConsume(socket, consumerTransportId, offer.audioProducerId, rtpCapabilities);
        if(offer.screenProducerId) result.screen = await socket.VTCPeer.room.letPeerConsume(socket, consumerTransportId, offer.screenProducerId, rtpCapabilities);

        console.log(`---consuming--- name: ${socket.VTCPeer.id} prod_id:${offer.transportId} consumer_id:${consumerTransportId}`)
        callback(result);

        //this basically starts sending osmeone a stream they have the id of.

        /*async consume(socket_id, consumer_transport_id, producer_id,  rtpCapabilities) {
            // handle nulls
            if (!this.router.canConsume({
                    producerId: producer_id,
                    rtpCapabilities,
                })) {
                console.error('can not consume');
                return;
            }
     
            let {consumer, params} = await this.peers.get(socket_id).createConsumer(consumer_transport_id, producer_id, rtpCapabilities)
            
            consumer.on('producerclose', function(){
                console.log(`---consumer closed--- due to producerclose event  name:${this.peers.get(socket_id).name} consumer_id: ${consumer.id}`)
                this.peers.get(socket_id).removeConsumer(consumer.id)
                // tell client consumer is dead
                this.io.to(socket_id).emit('consumerClosed', {
                    consumer_id: consumer.id
                })
            }.bind(this))
     
            return params
     
        }*/
    }


    async createWebRtcTransport(socket: ISocketWithPeer) {
        const {
            maxIncomingBitrate,
            initialAvailableOutgoingBitrate
        } = VTChatConfig.mediasoup.webRtcTransport;

        const transport = await this.router?.createWebRtcTransport({
            listenIps: VTChatConfig.mediasoup.webRtcTransport.listenIps,
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
            initialAvailableOutgoingBitrate,
        });
        if (maxIncomingBitrate) {
            try {
                await transport?.setMaxIncomingBitrate(maxIncomingBitrate);
            } catch (error) { }
        }

        if (!transport) return;

        transport.on('dtlsstatechange', (dtlsState: DtlsState) => {

            if (dtlsState === 'closed') {
                console.log('---transport close--- ' + socket.VTCPeer.id + ' closed')
                transport.close()
            }
        })

        transport.on('@close', () => {
            console.log('---transport close--- ' + socket.VTCPeer.id + ' closed')
        })

        return transport;
    }

    setupSocketServer(io: Server) {
        io.on('connection', (socket) => {
            const vtcID = '' + IDProvider.get();
            const peer = new VTChatPeer(socket, vtcID, 'Ghost#' + vtcID);
            const socketWithPeer = (socket as ISocketWithPeer);

            socketWithPeer.VTCPeer = peer;

            socketWithPeer.onAny((e, args) => {
                console.log(`[${vtcID}] => `, e, args)
            })
            socketWithPeer.onAnyOutgoing((e, args) => {
                console.log(`[${vtcID}] <= `, e, args)
            })

            this.setupEventHandlers(socketWithPeer);

            this.peers.set(vtcID, peer);

            console.log(`[VTChat :: VTChatServer.ts] [${vtcID}] peer connected [${this.peers.size}]`);

            this.makePeerJoinRoom(peer, lobbyRoomName)

            socketWithPeer.on('disconnect', () => {
                if (peer.room) {
                    this.makePeerLeaveRoom(peer, peer.room.id);
                }
                this.peers.delete(vtcID);
                console.log(`[VTChat :: VTChatServer.ts] [${vtcID}] peer disconnected [${this.peers.size}]`);
            })
        })
    }
}