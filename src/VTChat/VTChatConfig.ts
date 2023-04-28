import { RtpCodecCapability, WorkerLogTag } from "mediasoup/node/lib/types";

export const lobbyRoomName = "lobby";

export const VTCodecs: RtpCodecCapability[] = [
    {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2
    },
    {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
            'x-google-start-bitrate': 1000
        }
    },
]

export const LOGLEVEL = 'warn';
export const logTags: WorkerLogTag[] = [
    'info',
    'ice',
    'dtls',
    'rtp',
    'srtp',
    'rtcp',
    // 'rtx',
    // 'bwe',
    // 'score',
    // 'simulcast',
    // 'svc'
]

export const VTChatConfig = {
    listenIp: '0.0.0.0',
    listenPort: 4000,
    
    domain: 'table.magelands.com',
    sslCrt: '../SSL/cert.pem',
    sslKey: '../SSL/key.pem',

    cert: '',
    pKey: '',

    mediasoup: {
        // Worker settings
        numWorkers: 1, //Object.keys(os.cpus()).length,
        worker: {
            rtcMinPort: 10101,
            rtcMaxPort: 10200,
        },
        // WebRtcTransport settings
        webRtcTransport: {
            listenIps: [
                {
                    ip: '0.0.0.0',
                    announcedIp: '192.168.0.141' // replace by public IP address
                }
            ],
            maxIncomingBitrate: 1500000,
            initialAvailableOutgoingBitrate: 1000000
        },
    }
};


/*
async askRouterToAcceptMyStream(socket: ISocketWithPeer, payload: any, callback: Function) {
    if (typeof (payload) === 'function') callback = payload;
    if (callback === undefined) return this.failSocket(socket);

    //need to be in a room to send a stream;
    if (socket.VTCPeer.room === undefined) {
        callback(false)
        return false;
    }

    //const { video, audio, screen, rtpParameters } = payload;
    const { producerTransportId, kind, rtpParameters } = payload;
    const result: {
        video: Producer | undefined,
        audio: Producer | undefined,
        screen: Producer | undefined,
    } = {
        video: undefined,
        audio: undefined,
        screen: undefined,
    }
    if (kind === MediaType.video) {
        result.video = await socket.VTCPeer.createProducer(producerTransportId, rtpParameters, MediaType.video);
    }
    if (kind === MediaType.audio) {
        result.audio = await socket.VTCPeer.createProducer(producerTransportId, rtpParameters, MediaType.audio);
    }
    if (kind === MediaType.screen) {
        result.screen = await socket.VTCPeer.createProducer(producerTransportId, rtpParameters, MediaType.screen);
    }
    callback({
        video: result.video?.id,
        audio: result.audio?.id,
        screen: result.screen?.id,
    })

    //to do later
    socket.to(socket.VTCPeer.room.id).emit(RoomMessages.tellClientStreamAvailable, {
        peer_id: socket.VTCPeer.id,
        video: result.video?.id,
        audio: result.audio?.id,
        screen: result.screen?.id,
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
    }* /
}*/