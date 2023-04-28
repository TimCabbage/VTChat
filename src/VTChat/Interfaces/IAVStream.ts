import { Producer } from "mediasoup-client/lib/Producer";
import { Consumer } from "mediasoup-client/lib/types";
import { IAVStreamBase } from "./IAVStreamBase";

export interface IAVStream extends IAVStreamBase {
    audio: Producer | Consumer | undefined,
    video: Producer | Consumer | undefined,
    screen: Producer | Consumer | undefined,
    stream: MediaStream | undefined,
    screenStream: MediaStream | undefined,
}