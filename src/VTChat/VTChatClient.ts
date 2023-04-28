import { RoomMessages } from './Enums/RoomMessages';
import { AVConnectionState, ConnectionState, mainStore } from '../mainStore';
import { io, Socket } from 'socket.io-client';
import { IPeerData } from './Interfaces/IPeerData';
import { lobbyRoomName } from './VTChatConfig';
import { IRoomState } from './Interfaces/IRoomState';
import { RtpCapabilities, RtpParameters } from 'mediasoup-client/lib/RtpParameters';
import { MediaAllowed } from './Enums/MediaAllowedEnum';
import { TimedAccumulator } from '../TimedAccumulator';
import { Device } from "mediasoup-client";
import { DtlsParameters, Transport, TransportOptions } from 'mediasoup-client/lib/Transport';
import { Producer, ProducerOptions } from 'mediasoup-client/lib/Producer';
import { IMessage } from './Interfaces/IMessage.js';
import { IAVStream } from './Interfaces/IAVStream';
import { MediaType } from './Enums/MediaType';
import { IAVStreamBase } from './Interfaces/IAVStreamBase';

const RPCTimeout: number = 10000;

export class VTChatClient {
    static client = new VTChatClient();
    credentials: IPeerData = {id: '-1', name: 'undefined'};

    socket: Socket | undefined;
    consumerTransport: Transport | undefined;
    producerTransport: Transport | undefined;
    device: Device | undefined;

    socketSentStats: TimedAccumulator = new TimedAccumulator(10);
    socketRecvStats: TimedAccumulator = new TimedAccumulator(10);

    constructor() {
        mainStore.connectionState = ConnectionState.none;
        setTimeout(async () => {
            await this.initializeSocket();
            await this.startReceiving();
        }, 100)
    }

    processStatistics() {
        this.socketSentStats.passTime();
        this.socketRecvStats.passTime();

        mainStore.statistics = {
            ...mainStore.statistics,
            websocket: {
                sent: this.socketSentStats.acc,
                sentps: this.socketSentStats.value,

                recv: this.socketRecvStats.acc,
                recvps: this.socketRecvStats.value,
            }
        }

    }

    async consume(offer: IAVStream) {
        await this.getConsumeStream(offer);
    }

    async getConsumeStream(offer: IAVStream) {
        const rtpCapabilities = this.device?.rtpCapabilities;

        const offerData: IAVStreamBase = {
            transportId: offer.transportId,

            videoProducerId: offer.videoProducerId,
            audioProducerId: offer.audioProducerId,
            screenProducerId: offer.screenProducerId
        }
        const data = await this.socket?.emitWithAck(RoomMessages.askRouterToSendMeAStream, {
            rtpCapabilities,
            offer: offerData,
            consumerTransportId: this.consumerTransport?.id
        });
        console.log(data);

        if(data.video){
            offer.video = await this.consumerTransport?.consume({
                id: data.video.id,
                producerId: data.video.producerId,
                kind: MediaType.video,
                rtpParameters: data.video.rtpParameters
            })
            if(offer.video !== undefined){
                offer.video.on('trackended', () => { offer.video = undefined; })
                offer.video.on('transportclose', () => { offer.video = undefined; })

                if(offer.stream === undefined) offer.stream = new MediaStream();
                const videoTracks = offer.stream.getVideoTracks();
                if(videoTracks.length > 0) {
                    if(videoTracks[0].id !== data.video.id){
                        videoTracks[0].stop();
                    }
                }
                offer.stream.addTrack(offer.video.track);
            }
        }

        if(data.audio){
            offer.audio = await this.consumerTransport?.consume({
                id: data.audio.id,
                producerId: data.audio.producerId,
                kind: MediaType.audio,
                rtpParameters: data.audio.rtpParameters
            })
            if(offer.audio !== undefined){
                offer.audio.on('trackended', () => { offer.audio = undefined; })
                offer.audio.on('transportclose', () => { offer.audio = undefined; })

                if(offer.stream === undefined) offer.stream = new MediaStream();
                const audioTracks = offer.stream.getAudioTracks();
                if(audioTracks.length > 0) {
                    if(audioTracks[0].id !== data.audio.id){
                        audioTracks[0].stop();
                    }
                }
                offer.stream.addTrack(offer.audio.track);
            }
        }

        if(data.screen){
            offer.screen = await this.consumerTransport?.consume({
                id: data.screen.id,
                producerId: data.screen.producerId,
                kind: MediaType.video,
                rtpParameters: data.screen.rtpParameters
            })
            if(offer.screen !== undefined){
                offer.screen.on('trackended', () => { offer.screen = undefined; })
                offer.screen.on('transportclose', () => { offer.screen = undefined; })

                if(offer.screenStream === undefined) offer.screenStream = new MediaStream();
                const videoTracks = offer.screenStream.getVideoTracks();
                if(videoTracks.length > 0) {
                    if(videoTracks[0].id !== data.screen.id){
                        videoTracks[0].stop();
                    }
                }
                offer.screenStream.addTrack(offer.screen.track);
            }
        }

        return offer;
    }

    async initializeSocket() {
        const isDevEnv = window.location.port === "4000";
        const port = (isDevEnv) ? ':4000' : '';
        const protocol = 'wss:';
        const url = protocol + '//' + window.location.hostname + port;

        mainStore.connectionState = ConnectionState.connecting;
        console.log('connecting to ' + url)
        const socket = io(url, {
            transports: ['websocket'],
            reconnectionDelayMax: 5000,
            auth: {
                token: "1234"
            },
            path: "/api"
        })
        this.socket = socket;

        let onConnectedResolve: Function;
        const connectPromise = new Promise((resolve, reject) => {
            onConnectedResolve = resolve;
        });

        socket.io.on("reconnect_attempt", (attempt) => {
            mainStore.connectionState = ConnectionState.connecting;
            mainStore.connectionStateStatusText = 'Attempt no.: ' + attempt;
        });

        socket.io.on("reconnect_error", (error) => {
            mainStore.connectionState = ConnectionState.disconnected;
            mainStore.connectionStateStatusText = error.toString();
        });

        socket.on("connect", () => {
            mainStore.connectionState = ConnectionState.connected;

            const engine = socket.io.engine;
            engine.on("packet", ({ type, data }) => {
                if (type === 'message') {
                    this.socketRecvStats.add(data.length);
                }
            });

            engine.on("packetCreate", ({ type, data }) => {
                if (type === 'message') {
                    this.socketSentStats.add(data.length);
                }
            });

            onConnectedResolve();
        })

        socket.on(RoomMessages.tellClientStreamAvailable, async (data: any) => {
            console.log('new producer', data)
            if(data.peerID === this.credentials.id) {
                console.log('got myself as offerer, drop it');
            }

            let incomingStream: IAVStream | undefined = mainStore.incomingStreams.get(data.peerID);
            if(incomingStream === undefined){
                incomingStream = {
                    transportId: data.streams.transportId,

                    audio: undefined,
                    audioProducerId: data.streams.audioProducerId,
                    video: undefined,
                    videoProducerId: data.streams.videoProducerId,
                    screen: undefined,
                    screenProducerId: data.streams.screenProducerId,

                    stream: undefined,
                    screenStream: undefined
                }
                mainStore.incomingStreams.set(data.peerID, incomingStream);
            } else {
                incomingStream.transportId = data.streams.transportId;
                incomingStream.audioProducerId = data.streams.audioProducerId;
                incomingStream.videoProducerId = data.streams.videoProducerId;
                incomingStream.screenProducerId = data.streams.screenProducerId;
                //incomingStream.audioOfferID = data.
                //clean up differing stream IDs
            }
            
            await this.consume(incomingStream)
        })

        socket.on("disconnect", () => {
            console.log('disconnected.')
            mainStore.connectionState = ConnectionState.disconnected;
        })

        socket.on(RoomMessages.chatMessage, (message) => {
            mainStore.messages.unshift(message)
        })

        socket.on(RoomMessages.tellClientSomeoneJoinedARoom, (peer: IPeerData) => {
            console.log('peer joined your room', peer)
            mainStore.peers.push(peer);
        })

        socket.on(RoomMessages.tellClientSomeoneLeftARoom, (data) => {
            const room = data.room;
            const peerID = data.peer;

            console.log('peer left your room', room, peerID)
            const stream = mainStore.incomingStreams.get(peerID);
            if(stream !== undefined){
                stream.stream?.getAudioTracks().forEach((e) => e.stop());
                stream.stream?.getVideoTracks().forEach((e) => e.stop());

                stream.screenStream?.getVideoTracks().forEach((e) => e.stop());
            }
            mainStore.incomingStreams.delete(peerID);
            console.log(mainStore.incomingStreams)
            mainStore.peers = mainStore.peers.filter((e: any) => peerID !== e.id);
        })

        socket.on(RoomMessages.roomData, (roomState: IRoomState) => {
            console.log('got room state', roomState)
            this.credentials = roomState.you;
            mainStore.you = roomState.you;
            mainStore.peers = roomState.peers;
            mainStore.incomingStreams.clear();
            for(const i in roomState.streams){
                const rs = roomState.streams[i];
                const avStream: IAVStream = {
                    transportId: rs.transportId,

                    audio: undefined,
                    audioProducerId: rs.audioProducerId,

                    video: undefined,
                    videoProducerId: rs.videoProducerId,

                    screen: undefined,
                    screenProducerId: rs.screenProducerId,

                    stream: undefined,
                    screenStream: undefined
                }
                mainStore.incomingStreams.set(i, avStream)
            }
            this.tryToConsumeAllStreams()
            mainStore.messages = roomState.messages;
        })

        return connectPromise;
    }

    async tryToConsumeAllStreams() {
        if(!mainStore.canReceive) return;
        for(const [, stream] of mainStore.incomingStreams){
            if(stream.transportId !== undefined && stream.stream === undefined) await this.consume(stream);
        }
    }

    async fetchRouterRtpCapabilities() {
        return this.socket?.emitWithAck(RoomMessages.fetchRouterRtpCapabilities, 1);
    }

    async requestMediaRights() {
        try {
            mainStore.mediaAllowed = MediaAllowed.dontKnow;
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true
            });

            //close once you get this
            stream.getTracks().forEach(function (track) {
                track.stop();
            });

            await this.getMicsAndCams();
            this.updateSelectedDevicesFromLocalStorage();

            if (!this.ensureDevicesAreSelected()) {
                mainStore.webcamConnectionStateStatusText = "Cannot ensure even one device for both audio and video."
                if (mainStore.selectedAvDevices.audio === undefined) mainStore.webcamConnectionState = AVConnectionState.error;
                if (mainStore.selectedAvDevices.video === undefined) mainStore.micConnectionState = AVConnectionState.error;
            } else {
                mainStore.mediaAllowed = MediaAllowed.allowedBoth;
            }

            return true;
        } catch (e) {
            if (e instanceof DOMException) {
                mainStore.mediaAllowed = MediaAllowed.forbidden;
            }
            console.log(e);
            return false;
        }
    }

    updateSelectedDevicesFromLocalStorage() {
        const lastUsedDevices = localStorage.getItem('lastUsedDevices');
        if (lastUsedDevices) {
            try {
                const data = JSON.parse(lastUsedDevices);
                mainStore.selectedAvDevices.audio = mainStore.avDevices.audio.find((dev) => dev.deviceId === data.audio)
                mainStore.selectedAvDevices.video = mainStore.avDevices.video.find((dev) => dev.deviceId === data.video)
            } catch (e) {
                //this apparently isn't a valid JSON, skip.
            }
        }
    }

    updateLocalStorage() {
        localStorage.setItem('lastUsedDevices', JSON.stringify({
            audio: mainStore.selectedAvDevices.audio?.deviceId,
            video: mainStore.selectedAvDevices.video?.deviceId,
        }))
    }

    ensureDevicesAreSelected(): MediaAllowed {
        if (mainStore.avDevices.audio.length === 0 && mainStore.avDevices.video.length === 0) return MediaAllowed.forbidden;

        if (mainStore.avDevices.audio.length > 0 && mainStore.selectedAvDevices.audio === undefined) {
            mainStore.selectedAvDevices.audio = mainStore.avDevices.audio[0];
        }

        if (mainStore.avDevices.video.length > 0 && mainStore.selectedAvDevices.video === undefined) {
            mainStore.selectedAvDevices.video = mainStore.avDevices.video[0];
        }

        if (mainStore.selectedAvDevices.video === undefined) return MediaAllowed.allowedMic;
        if (mainStore.selectedAvDevices.audio === undefined) return MediaAllowed.allowedWebcam;

        return MediaAllowed.allowedBoth;
    }

    async getMicsAndCams() {
        const devices = await navigator.mediaDevices.enumerateDevices()
        mainStore.avDevices = {
            audio: [],
            video: []
        }
        devices.forEach(device => {
            if (device.kind === 'audioinput') {
                mainStore.avDevices.audio.push(device);
            } else if ('videoinput' === device.kind) {
                mainStore.avDevices.video.push(device);
            }
        })

        this.updateSelectedDevicesFromLocalStorage();
    }

    async setupConsumerTransport(device: Device) {
        if (this.consumerTransport) return this.consumerTransport;

        const data = await this.socket?.emitWithAck(RoomMessages.askRouterToCreateTransport, {
            forceTcp: false,
            rtpCapabilities: device.rtpCapabilities,
        })
        if (data === undefined || data.error) {
            console.error(data?.error);
            return;
        }

        const consumerTransport = this.device?.createRecvTransport(data);
        this.consumerTransport = consumerTransport;
        if (consumerTransport === undefined) return false;

        this.consumerTransport?.on('connect', async ({ dtlsParameters }: { dtlsParameters: DtlsParameters }, callback: Function, errback: Function) => {
            try {
                const result: any = await this.socket?.emitWithAck(RoomMessages.askRouterToConnectMyTransport, {
                    transport_id: consumerTransport.id,
                    dtlsParameters,
                });
                callback(result);
            } catch (e) {
                errback(e);
            }
        });

        consumerTransport.on('connectionstatechange', async (state: string) => {
            switch (state) {
                case 'connecting':
                    break;

                case 'connected':
                    //remoteVideo.srcObject = await stream;
                    //await socket.request('resume');
                    break;

                case 'failed':
                    consumerTransport.close();
                    break;

                default:
                    break;
            }
        });
    }

    async setupProducerTransport(device: Device) {
        if (this.producerTransport) return this.producerTransport;

        const data = await this.socket?.emitWithAck(RoomMessages.askRouterToCreateTransport, {
            forceTcp: false,
            rtpCapabilities: device.rtpCapabilities,
        })
        if (data === undefined || data.error) {
            console.error(data?.error);
            return;
        }
        
        const producerTransport = await this.device?.createSendTransport(data);
        this.producerTransport = producerTransport;
        if (producerTransport === undefined) {
            console.error('ProducerTransport undefined')
            return false;
        }

        producerTransport.on('connect', async ({ dtlsParameters }: { dtlsParameters: DtlsParameters }, callback: Function, errback: Function) => {
            try {
                const result: any = await this.socket?.emitWithAck(RoomMessages.askRouterToConnectMyTransport, {
                    dtlsParameters,
                    transport_id: data.id
                });
                callback(result);
            } catch (e) {
                errback(e);
            }
        })

        producerTransport.on('produce', async ({ kind, rtpParameters }: { kind: string, rtpParameters: RtpParameters }, callback: Function, errback: Function) => {
            try {
                const result = await this.socket?.emitWithAck(RoomMessages.askRouterToAcceptMyStream, {
                    producerTransportId: producerTransport.id,
                    kind,
                    rtpParameters,
                });

                if(kind === MediaType.video) {
                    callback({id: result});
                }
                if(kind === MediaType.audio) {
                    callback({id: result});
                }
                if(kind === MediaType.screen) {
                    callback({id: result});
                }                
            } catch (err) {
                errback(err);
            }
        });

        producerTransport.on('connectionstatechange', (state) => {
            switch (state) {
                case 'connecting':

                    break;

                case 'connected':
                    //localVideo.srcObject = stream
                    break;

                case 'failed':
                    producerTransport.close();
                    break;

                default:
                    break;
            }
        });

    }

    async startReceiving() {
        const device = await this.initDevice();
        if(!device) {
            console.error('No device');
            return false;
        }
        await this.setupConsumerTransport(device);
        mainStore.canReceive = true;
        this.tryToConsumeAllStreams()
    }

    async initDevice() {
        if (this.device) return this.device;
        const device = new Device();
        try {
            const routerRtpCapabilities: RtpCapabilities = await this.fetchRouterRtpCapabilities();
            await device.load({ routerRtpCapabilities });
        } catch (e) {
            return;
        }
        this.device = device;
        return device;
    }

    async startStreaming() {
        const mediaAllowed = this.ensureDevicesAreSelected();
        mainStore.mediaAllowed = mediaAllowed;

        if (mediaAllowed === MediaAllowed.forbidden) return false;

        this.updateLocalStorage();

        const device = await this.initDevice();
        if (!device) {
            mainStore.webcamConnectionState = AVConnectionState.error;
            mainStore.micConnectionState = AVConnectionState.error;
            return false;
        }

        await this.setupProducerTransport(device);

        const mediaConstraints: any = {}
        if (mainStore.selectedAvDevices.audio) {
            if (!device.canProduce('audio')) {
                mainStore.webcamConnectionState = AVConnectionState.error;
                mainStore.webcamConnectionStateStatusText = "Device cannot produce audio that the server can accept."
            } else {
                mediaConstraints.audio = {
                    deviceId: mainStore.selectedAvDevices.audio.deviceId
                };
            }
        }
        if (mainStore.selectedAvDevices.video) {
            if (!device.canProduce('video')) {
                mainStore.webcamConnectionState = AVConnectionState.error;
                mainStore.webcamConnectionStateStatusText = "Device cannot produce video that the server can accept."
            } else {
                mediaConstraints.video = {
                    width: {
                        min: 320,
                        ideal: 1280
                    },
                    height: {
                        min: 240,
                        ideal: 720
                    },
                    aspectRatio: {
                        ideal: 1.7777777778
                    },
                    deviceId: mainStore.selectedAvDevices.video.deviceId
                }
            }
        }

        let stream = undefined;
        try {
            stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        } catch (e) {
            if (e instanceof DOMException) {
                mainStore.mediaAllowed = MediaAllowed.forbidden;
            }
        }
        if (!stream) {
            mainStore.mediaAllowed = MediaAllowed.forbidden;
            return;
        }

        const audioTracks = stream.getAudioTracks();
        const videoTracks = stream.getVideoTracks();

        const audioTrack = audioTracks.length > 0 ? audioTracks[0] : undefined;
        const videoTrack = videoTracks.length > 0 ? videoTracks[0] : undefined;
        
        const newOutgoingStream = {...mainStore.outgoingStream}
        newOutgoingStream.stream = stream;

        if (videoTrack) {
            const params: ProducerOptions = {
                track: videoTrack
            };
            params.encodings = [{
                rid: 'r0',
                maxBitrate: 300000,
                //scaleResolutionDownBy: 10.0,
                scalabilityMode: 'L1T3'
            },
            ];
            params.codecOptions = {
                videoGoogleStartBitrate: 1000
            };
            const videoProducer = await this.producerTransport?.produce(params)
            if (videoProducer) {
                newOutgoingStream.video = videoProducer;

                this.setupVideoProducerEvents(videoProducer)
            }
        }

        if (audioTrack) {
            //audioTrack.enabled = false;
            const params: ProducerOptions = {
                track: audioTrack
            };
            const audioProducer = await this.producerTransport?.produce(params)
            if (audioProducer) {
                newOutgoingStream.audio = audioProducer;

                this.setupAudioProducerEvents(audioProducer)
            }
        }

        mainStore.outgoingStream = newOutgoingStream;

        return true;
    }

    setupAudioProducerEvents(audioProducer: Producer) {
        audioProducer.on('trackended', () => {
            audioProducer.close();
            const newOutgoingStream = {...mainStore.outgoingStream}

            newOutgoingStream.audio = undefined;

            mainStore.outgoingStream = newOutgoingStream;
            mainStore.micConnectionState = AVConnectionState.unknown;
        })

        audioProducer.on('transportclose', () => {
            console.log('producer transport close')
            const newOutgoingStream = {...mainStore.outgoingStream}

            newOutgoingStream.audio = undefined;

            mainStore.outgoingStream = newOutgoingStream;
            mainStore.micConnectionState = AVConnectionState.unknown;
        })

        audioProducer.on('@close', () => {
            const newOutgoingStream = {...mainStore.outgoingStream}

            newOutgoingStream.audio = undefined;

            mainStore.outgoingStream = newOutgoingStream;
            mainStore.micConnectionState = AVConnectionState.unknown;
        })
    }

    setupVideoProducerEvents(videoProducer: Producer) {
        videoProducer.on('trackended', () => {
            videoProducer.close();
            const newOutgoingStream = {...mainStore.outgoingStream}

            newOutgoingStream.video = undefined;
            
            mainStore.outgoingStream = newOutgoingStream;
            mainStore.webcamConnectionState = AVConnectionState.unknown;
        })

        videoProducer.on('transportclose', () => {
            console.log('producer transport close')
            const newOutgoingStream = {...mainStore.outgoingStream}

            newOutgoingStream.video = undefined;
            
            mainStore.outgoingStream = newOutgoingStream;
            mainStore.webcamConnectionState = AVConnectionState.unknown;
        })

        videoProducer.on('@close', () => {
            const newOutgoingStream = {...mainStore.outgoingStream}

            newOutgoingStream.video = undefined;
            
            mainStore.outgoingStream = newOutgoingStream;
            mainStore.webcamConnectionState = AVConnectionState.unknown;
        })
    }

    disconnect() {
        this.socket?.disconnect();
    }

    async sendChat(room: string, message: string) {
        const mObject: any = { room: room, message: message };
        const result = await this.socket?.emitWithAck(RoomMessages.chatMessage, mObject);
        if(result === false){
            //we have had issues sending the message
        } else {
            const newMessage: IMessage = { 
                id: result,
                credentials: this.credentials,
                message: message 
            };
            mainStore.messages.unshift(newMessage)
        }
    }

    async sendChatToLobby(message: string) {
        await this.sendChat(lobbyRoomName, message);
    }
}