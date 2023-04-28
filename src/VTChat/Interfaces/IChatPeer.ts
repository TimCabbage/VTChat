import { IAVStreamBase } from "./IAVStreamBase";
import { IPeerData } from "./IPeerData";

export interface IChatPeer {
    credentials: IPeerData,
    stream: IAVStreamBase
}