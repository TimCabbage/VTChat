import { Socket } from "socket.io";
import { VTChatRoom } from "./VTChatRoom.js";
import { Transport } from "mediasoup/node/lib/Transport";
import { DtlsParameters } from "mediasoup/node/lib/WebRtcTransport";
import { RtpCapabilities, RtpParameters } from "mediasoup/node/lib/RtpParameters";
import { VTChatUser } from "./VTChatUser.js";
import { Consumer } from "mediasoup/node/lib/Consumer";
import { IAVStream } from "./Interfaces/IAVStream.js";
import { MediaType } from "./Enums/MediaType.js";

export class VTChatPeer {
    id: string;
    chatUser: VTChatUser;
    room: VTChatRoom | undefined;
    socket: Socket;

    streamsProduced: IAVStream = {
        transportId: "",

        video: undefined,
        videoProducerId: "",

        audio: undefined,
        audioProducerId: "",

        screen: undefined,
        screenProducerId: "",

        stream: undefined,
        screenStream: undefined,
    }

    transports = new Map();
    consumers = new Map();

    constructor(socket: Socket, id: string, name: string) {
        this.id = id;
        this.socket = socket;
        this.chatUser = new VTChatUser(id, name);
    }

    addTransport(transport: Transport) {
        this.transports.set(transport.id, transport)
    }

    async connectTransport(transport_id: string, dtlsParameters: DtlsParameters) {
        if (!this.transports.has(transport_id)) return
        try{
            await this.transports.get(transport_id).connect({
                dtlsParameters: dtlsParameters
            });
        } catch(e) {
            console.log('error: ', transport_id);
        }
    }

    async createProducer(producerTransportId: string, rtpParameters: RtpParameters, kind: string) {
        //TODO handle null errors
        let producer = await this.transports.get(producerTransportId).produce({
            kind,
            rtpParameters
        })

        if(kind === MediaType.audio) {
            this.streamsProduced.audioProducerId = producer.id;
            this.streamsProduced.audio = producer;
        }
        if(kind === MediaType.video) {
            this.streamsProduced.videoProducerId = producer.id;
            this.streamsProduced.video = producer;
        }
        if(kind === MediaType.screen) {
            this.streamsProduced.screenProducerId = producer.id;
            this.streamsProduced.screen = producer;
        }

        producer.on('transportclose', () => {
            console.log(`---producer transport close--- name: ${this.chatUser.credentials.name} consumer_id: ${producer.id}`)
            producer.close()

            if(kind === MediaType.audio) {
                this.streamsProduced.audioProducerId = "";
                this.streamsProduced.audio = undefined;
            }
            if(kind === MediaType.video) {
                this.streamsProduced.videoProducerId = "";
                this.streamsProduced.video = undefined;
            }
            if(kind === MediaType.screen) {
                this.streamsProduced.screenProducerId = "";
                this.streamsProduced.screen = undefined;
            }
        })

        return producer
    }

    async createConsumer(consumer_transport_id: string, producer_id: string, rtpCapabilities: RtpCapabilities): Promise<{consumer: Consumer, params: any} | undefined> {
        //console.log(this.transports, consumer_transport_id)
        let consumerTransport = this.transports.get(consumer_transport_id)

        let consumer : Consumer | undefined = undefined
        try {
            consumer = await consumerTransport.consume({
                producerId: producer_id,
                rtpCapabilities,
                paused: false //producer.kind === 'video',
            });
        } catch (error) {
            console.error('consume failed', error);
            return;
        }

        if(consumer === undefined) return;

        if (consumer.type === 'simulcast') {
            await consumer.setPreferredLayers({
                spatialLayer: 2,
                temporalLayer: 2
            });
        }

        this.consumers.set(consumer.id, consumer)

        consumer.on('transportclose', () => {
            console.log(`---consumer transport close--- name: ${this.chatUser.credentials.name} consumer_id: ${consumer?.id}`)
            this.consumers.delete(consumer?.id)
        })

        return {
            consumer,
            params: {
                producerId: producer_id,
                id: consumer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                type: consumer.type,
                producerPaused: consumer.producerPaused
            }
        }
    }

    close() {
        this.transports.forEach(transport => transport.close())
    }

    removeConsumer(consumer_id: string) {
        this.consumers.delete(consumer_id)
    }
}