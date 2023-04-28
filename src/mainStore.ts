import { store } from '@risingstack/react-easy-state';
import { IRoomState } from './VTChat/Interfaces/IRoomState';
import { MediaAllowed } from './VTChat/Enums/MediaAllowedEnum';
import { IAVStream } from './VTChat/Interfaces/IAVStream';

export enum ConnectionState {
    none,
    connecting,
    connected,
    disconnected
}

export enum UserState {
    guest,
    user,
    operator,
    admin
}

export enum AVConnectionState {
    unknown,
    ok,
    problem,
    error
}

interface AVDevices {
    audio: MediaDeviceInfo[],
    video: MediaDeviceInfo[]
}

interface AVDevicePair {
    audio: MediaDeviceInfo | undefined,
    video: MediaDeviceInfo | undefined
}



interface IStoreData extends IRoomState {
    input: string, 
    time: number, 

    mediaAllowed: MediaAllowed,
    avDevices: AVDevices,
    selectedAvDevices: AVDevicePair,

    incomingStreams: Map<string, IAVStream>,
    incomingStreams_r: number,
    outgoingStream: IAVStream,

    statistics: any,

    userState: UserState,
    userStateStatusText: string,

    connectionState: ConnectionState,
    connectionStateStatusText: string,

    videoConnectionState: AVConnectionState,
    videoConnectionStateStatusText: string,

    audioConnectionState: AVConnectionState, 
    audioConnectionStateStatusText: string,

    webcamConnectionState: AVConnectionState, 
    webcamConnectionStateStatusText: string,

    micConnectionState: AVConnectionState, 
    micConnectionStateStatusText: string,

    canReceive: boolean
}

const storeData: IStoreData = {
    you: { id: 'none', name: 'nobody'},
    peers: [],
    messages: [],
    streams: [],

    input: '',
    time: 0,

    mediaAllowed: MediaAllowed.dontKnow,
    avDevices: {
        audio: [],
        video: []
    },
    selectedAvDevices: {
        audio: undefined,
        video: undefined
    },    

    statistics: {
        websocket: {
            sent: 0,
            recv: 0
        },
        streams: {

        }
    },

    incomingStreams: new Map(),
    incomingStreams_r: 1,
    outgoingStream: {
        transportId: "",

        audio: undefined,
        audioProducerId: "",
        video: undefined,
        videoProducerId: "",
        screen: undefined,
        screenProducerId: "",

        stream: undefined,
        screenStream: undefined
    },

    userState: UserState.guest,
    userStateStatusText: '',

    connectionState: ConnectionState.none,
    connectionStateStatusText: '',

    videoConnectionState: AVConnectionState.unknown,
    videoConnectionStateStatusText: '',

    audioConnectionState: AVConnectionState.unknown,
    audioConnectionStateStatusText: '',

    webcamConnectionState: AVConnectionState.unknown,
    webcamConnectionStateStatusText: '',

    micConnectionState: AVConnectionState.unknown,
    micConnectionStateStatusText: '',

    canReceive: false
};

export const mainStore = store(storeData);


