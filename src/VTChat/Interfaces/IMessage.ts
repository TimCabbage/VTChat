import { IPeerData } from "./IPeerData";

export interface IMessage {
    id: number, 
    credentials: IPeerData,
    message: string
}