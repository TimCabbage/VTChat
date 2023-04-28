import { IAVStreamBase } from "./IAVStreamBase"
import { IMessage } from "./IMessage"
import { IPeerData } from "./IPeerData"

export interface IRoomState {
    you: IPeerData,
    peers: IPeerData[],
    messages: IMessage[],
    streams: IAVStreamBase[]
}