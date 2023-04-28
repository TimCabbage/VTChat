import { IPeerData } from "./Interfaces/IPeerData.js";

export class VTChatUser {
    credentials: IPeerData;

    constructor(id: string, name: string) {
        this.credentials = {
            id: id,
            name: name
        }
    }
}