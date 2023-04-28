import { IMessage } from "./Interfaces/IMessage.js"
import { IPeerData } from "./Interfaces/IPeerData.js";
import { IRoomState } from "./Interfaces/IRoomState.js";
import { ISocketWithPeer } from "./Interfaces/ISocketWithPeer.js";
import { RoomMessages } from "./Enums/RoomMessages.js";
import { VTChatPeer } from "./VTChatPeer.js";
import { IAVStreamBase } from "./Interfaces/IAVStreamBase.js";
import { Consumer } from "mediasoup/node/lib/Consumer.js";

export class VTChatRoom {
    id: string;
    name: string;
    messages: IMessage[] = [];
    peers: Map<string, VTChatPeer> = new Map();

    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }

    getRoomState() {
        const peers: IPeerData[] = []
        const peerStreams: IAVStreamBase[] = [];
        for (const [, peer] of this.peers) {
            peers.push(peer.chatUser.credentials);
            const streamInfo: IAVStreamBase = {
                transportId: peer.streamsProduced.transportId,
                videoProducerId: peer.streamsProduced.videoProducerId,
                audioProducerId: peer.streamsProduced.audioProducerId,
                screenProducerId: peer.streamsProduced.screenProducerId,
            };
            peerStreams.push(streamInfo);
        }

        const result: IRoomState = {
            you: { id: 'none', name: 'none' },
            peers: peers,
            streams: peerStreams,
            messages: this.messages
        }

        return result;
    }

    removePeer(peer: VTChatPeer) {
        if (peer.room === undefined) {
            console.error('[VTChat :: VTChatRoom.ts] Tried to leave a room but I dont have a reference to it: RoomID:"' + this.id + '", PeerID:"' + peer.id + '"');
            return false;
        }

        if (this.peers.get(peer.id) === undefined) {
            console.error('[VTChat :: VTChatServer.ts] Tried to leave a room that I\'m not in: RoomID:"' + this.id + '", PeerID:"' + peer.id + '"');
            return false;
        }

        this.peers.delete(peer.id);
        peer.room = undefined;

        peer.socket.to(this.id).emit(RoomMessages.tellClientSomeoneLeftARoom, { room: this.id, peer: peer.id })
        peer.socket.leave(this.id);

        return true;
    }

    addPeer(peer: VTChatPeer) {
        if (this.peers.get(peer.id) !== undefined) {
            console.error('[VTChat :: VTChatRoom.ts] Tried to join a room that I\'m already in: RoomID:"' + this.id + '", PeerID:"' + peer.id + '"');
            return false;
        }

        if (peer.room !== undefined) {
            if (!peer.room.removePeer(peer)) {
                return false;
            }
        }

        this.peers.set(peer.id, peer);
        peer.room = this;

        peer.socket.join(this.id);

        const roomState = this.getRoomState();
        roomState.you = peer.chatUser.credentials;

        peer.socket.emit(RoomMessages.roomData, roomState)
        peer.socket.to(this.id).emit(RoomMessages.tellClientSomeoneJoinedARoom, { room: this.id, peer: peer.chatUser.credentials })

        return true;
    }

    async letPeerConsume(socket: ISocketWithPeer, consumer_transport_id: string, producer_id: string, rtpCapabilities: any) {
        // handle nulls
        const res = await socket.VTCPeer.createConsumer(consumer_transport_id, producer_id, rtpCapabilities)
        if (res === undefined) {
            console.error('[VTChat :: VTChatRoom.ts] Consumer creation failed for PeerID"' + socket.VTCPeer.id + '", ConsumerTransportID: "' + consumer_transport_id + '", Producer video_transport_id: "' + producer_id + '"');
            return false;
        }
        //console.log(res);

        const result = res.params;

        res.consumer.on('producerclose', function () {
            console.log(`---consumer closed--- due to producerclose event  name:${socket.VTCPeer.id} consumer_id: ${res.consumer.id}`)
            socket.VTCPeer.removeConsumer(res.consumer.id)
            // tell client consumer is dead
            socket.emit('consumerClosed', {
                consumer_id: res.consumer.id
            })
        })

        return result;
    }
}