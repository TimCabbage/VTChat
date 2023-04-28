import { Socket } from "socket.io";
import { VTChatPeer } from "../VTChatPeer";

export interface ISocketWithPeer extends Socket {
    VTCPeer: VTChatPeer
}