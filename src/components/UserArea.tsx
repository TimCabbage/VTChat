import React, { Component } from 'react';
import './UserArea.scss';
import { AVConnectionState, ConnectionState, UserState, mainStore } from '../mainStore';
import { VTChatClient } from '../VTChat/VTChatClient';
import { view } from '@risingstack/react-easy-state';
import { MediaAllowed } from '../VTChat/Enums/MediaAllowedEnum';

function plugIcon(state: ConnectionState, statusText: string) {
    let socketStatusIconColor = 'red';
    let socketStatusInfo = <span>Socket connection is down. <hr /> You will not be able to operate the website. Either your connection is faulty or the server is down.</span>;
    let status = statusText ? <span><hr />{statusText}</span> : null;

    if (state === ConnectionState.connecting) {
        socketStatusIconColor = 'yellow';
        socketStatusInfo = <span>Connecting to the server. <hr /> If this takes forever, connection may be faulty or server may be down.</span>;
    }
    if (state === ConnectionState.connected) {
        socketStatusIconColor = 'green';
        socketStatusInfo = <span>Connected. <br /> Looks like it works.</span>;
        status = <span className="brand">
            <hr />
            ~{(mainStore.statistics.websocket.recvps / 1000 / 60).toFixed(1)}kB/s, total {(mainStore.statistics.websocket.recv / 1000).toFixed(1)}kB received <br />
            ~{(mainStore.statistics.websocket.sentps / 1000 / 60).toFixed(1)}kB/s, total {(mainStore.statistics.websocket.sent / 1000).toFixed(1)}kB received
        </span>
    }


    return <div className="status-button-with-info" tabIndex={0}>
        <i className={"fat fa-fw fa-plug " + socketStatusIconColor} />
        <div className="status-info panel">
            {socketStatusInfo}
            {status}
        </div>
    </div>

}

function userIcon(state: UserState, statusText: string) {
    let userStatusIcon = 'ghost';
    let userStatusIconColor = 'gray';
    let userStatusInfo = <span>You're currently a guest. <hr /> You will only be able to join public streams and if they have that option turned on, write in chat.</span>;

    if (state === UserState.user) {
        userStatusIcon = 'user';
        userStatusIconColor = 'green'
        userStatusInfo = <span>You are logged in. <hr /> You can join streams You have keys to as well as public ones. In some streams You will be able to send Your video and audio. Where enabled, You can write in chat.</span>;
    }



    return <div className="status-button-with-info" tabIndex={0}>
        <i className={"fat fa-fw fa-" + userStatusIcon + " " + userStatusIconColor} />
        <div className="status-info panel">
            {userStatusInfo}
            {statusText ? <span><hr />{statusText}</span> : null}
        </div>
    </div>

}

function videoIcon(state: AVConnectionState, statusText: string) {
    let videoConnectionIconColor = 'gray';
    let videoConnectionStatusInfo = <span>You're not currently receiving a video stream. <hr /> Once You join a room with a video stream, this will change.</span>;

    if (state === AVConnectionState.ok) {
        videoConnectionIconColor = 'green'
        videoConnectionStatusInfo = <span>Video stream seems to be working ok. <hr /> Statistics are below.</span>;
    }
    if (state === AVConnectionState.problem) {
        videoConnectionIconColor = 'yellow'
        videoConnectionStatusInfo = <span>Video stream seems to be having issues but still working. <hr /> More information below.</span>;
    }
    if (state === AVConnectionState.error) {
        videoConnectionStatusInfo = <span>Video stream seems to be broken. <hr /> Reason should be below.</span>;
    }

    return <div className="status-button-with-info" tabIndex={0}>
        <i className={"fat fa-fw fa-camera-movie " + videoConnectionIconColor} />
        <div className="status-info panel">
            {videoConnectionStatusInfo}
            {statusText ? <span><hr />{statusText}</span> : null}
        </div>
    </div>
}

function audioIcon(state: AVConnectionState, statusText: string) {
    let audioConnectionIconColor = 'gray';
    let audioConnectionStatusInfo = <span>You're not currently receiving an audio stream. <hr /> Once You join a room with an audio stream, this will change.</span>;

    if (state === AVConnectionState.ok) {
        audioConnectionIconColor = 'green'
        audioConnectionStatusInfo = <span>Audio stream seems to be working ok. <hr /> Statistics are below.</span>;
    }
    if (state === AVConnectionState.problem) {
        audioConnectionIconColor = 'yellow'
        audioConnectionStatusInfo = <span>Audio stream seems to be having issues but still working. <hr /> More information below.</span>;
    }
    if (state === AVConnectionState.error) {
        audioConnectionStatusInfo = <span>Audio stream seems to be broken. <hr /> Reason should be below.</span>;
    }

    return <div className="status-button-with-info" tabIndex={0}>
        <i className={"fat fa-fw fa-volume " + audioConnectionIconColor} />
        <div className="status-info panel">
            {audioConnectionStatusInfo}
            {statusText ? <span><hr />{statusText}</span> : null}
        </div>
    </div>
}

function webcamIcon(mediaAllowed: MediaAllowed, webcamState: AVConnectionState, webcamStatusText: string, micState: AVConnectionState, micStatusText: string) {
    let mediaStatusInfo = null;

    let webcamConnectionStatusInfo = null;

    let webcamStatusIconColor = 'gray';
    let webcamStatusSlash = true;
    let webcamDotStatusIconColor = 'hidden';
    let webcamPlugStatusIconColor = 'hidden';

    let micConnectionStatusInfo = null;

    let micStatusIconColor = 'gray';
    let micStatusSlash = true;
    let micDotStatusIconColor = 'hidden';
    let micPlugStatusIconColor = 'hidden';

    let mediaQueryButton: JSX.Element | null = <button className="block" onClick={async () => {
        await VTChatClient.client.requestMediaRights();
    }}>Ask for permission</button>
    let streamQueryButton: JSX.Element | null = <button className="block" onClick={async () => {
        await VTChatClient.client.startStreaming();
    }}>Stream</button>

    if (mediaAllowed === MediaAllowed.allowedBoth) {
        webcamStatusIconColor = 'green'
        webcamStatusSlash = false;

        micStatusIconColor = 'green'
        micStatusSlash = false;

        mediaQueryButton = null;
        mediaStatusInfo = <span>Webcam/mic is currently enabled but not transmitting.</span>;
    }
    if (mediaAllowed === MediaAllowed.allowedWebcam) {
        webcamStatusIconColor = 'green'
        webcamStatusSlash = false;

        micStatusIconColor = 'red'
        micStatusSlash = true;

        mediaStatusInfo = <span>Webcam is currently enabled but not transmitting.</span>;
    }
    if (mediaAllowed === MediaAllowed.allowedMic) {
        webcamStatusIconColor = 'red'
        webcamStatusSlash = true;

        micStatusIconColor = 'green'
        micStatusSlash = false;

        mediaStatusInfo = <span>Mic is currently enabled but not transmitting.</span>;
    }
    if (mediaAllowed === MediaAllowed.forbidden) {
        webcamStatusIconColor = 'red'
        webcamStatusSlash = true;
        micStatusIconColor = 'red'
        micStatusSlash = true;
        mediaStatusInfo = <span>Webcam/mic is blocked in the browser. <hr /> Please enable webcam/mic (page refresh may be neccessary, otherwise use the camera and mic icons in the address bar).</span>;
    }
    if (mediaAllowed === MediaAllowed.dontKnow) {
        webcamStatusIconColor = 'gray'
        webcamStatusSlash = true;
        mediaStatusInfo = <span>Webcam is currently not enabled. <hr /> Please allow webcam on this page for it to work.</span>;
    }

    if (webcamState === AVConnectionState.ok) {
        webcamDotStatusIconColor = 'red'
        webcamPlugStatusIconColor = 'green';
        webcamConnectionStatusInfo = <span>Webcam seems to be recording ok.</span>;
        mediaQueryButton = null;
    }
    if (webcamState === AVConnectionState.problem) {
        webcamDotStatusIconColor = 'red'
        webcamPlugStatusIconColor = 'yellow';
        webcamConnectionStatusInfo = <span>Webcam seems to be having issues but still working and recording.</span>;
    }
    if (webcamState === AVConnectionState.error) {
        webcamDotStatusIconColor = 'red'
        webcamPlugStatusIconColor = 'red';
        webcamConnectionStatusInfo = <span>Webcam seems to be broken. Connected but not sending video.</span>;
    }

    if (micState === AVConnectionState.ok) {
        micDotStatusIconColor = 'red'
        micPlugStatusIconColor = 'green';
        micConnectionStatusInfo = <span>Mic seems to be recording ok.</span>;
    }
    if (micState === AVConnectionState.problem) {
        micDotStatusIconColor = 'red'
        micPlugStatusIconColor = 'yellow';
        micConnectionStatusInfo = <span>Webcam seems to be having issues but still working and recording.</span>;
    }
    if (micState === AVConnectionState.error) {
        micDotStatusIconColor = 'red'
        micPlugStatusIconColor = 'red';
        micConnectionStatusInfo = <span>Webcam seems to be broken. Connected but not sending video.</span>;
    }

    return <div className="status-button-with-info" tabIndex={0}>
        <div className="relative inline-block">
            <i className={"fat fa-fw fa-camera-web" + (webcamStatusSlash ? '-slash ' : ' ') + webcamStatusIconColor} />
            <i className={"fas fa-circle-dot fa-tiny-bottomright " + webcamDotStatusIconColor} />
            <i className={"fas fa-plug fa-tiny-bottomleft " + webcamPlugStatusIconColor} />
        </div>
        <div className="relative inline-block">
            <i className={"fat fa-fw fa-microphone" + (micStatusSlash ? '-slash ' : ' ') + micStatusIconColor} />
            <i className={"fas fa-circle-dot fa-tiny-bottomright " + micDotStatusIconColor} />
            <i className={"fas fa-plug fa-tiny-bottomleft " + micPlugStatusIconColor} />
        </div>
        <div className="status-info panel">
            {mediaStatusInfo}
            {webcamConnectionStatusInfo}
            {micConnectionStatusInfo}
            {webcamStatusText ? <span><hr />{webcamStatusText}</span> : null}
            {mediaQueryButton}
            {streamQueryButton}
            <hr />
            {mediaAllowed === MediaAllowed.allowedWebcam || mediaAllowed === MediaAllowed.allowedBoth ?
                <div>
                    Video: <br />
                    <select onChange={(e) => mainStore.selectedAvDevices.video = mainStore.avDevices.video.find((dev) => dev.deviceId === e.target.value)} value={mainStore.selectedAvDevices.video?.deviceId}>
                        {mainStore.avDevices.video.map((e) => <option key={e.deviceId} value={e.deviceId}>{e.label}</option>)}
                    </select>
                </div> : null}
            {mediaAllowed === MediaAllowed.allowedMic || mediaAllowed === MediaAllowed.allowedBoth ?
                <div>
                    Audio: <br />
                    <select onChange={(e) => mainStore.selectedAvDevices.audio = mainStore.avDevices.audio.find((dev) => dev.deviceId === e.target.value)} value={mainStore.selectedAvDevices.audio?.deviceId}>
                        {mainStore.avDevices.audio.map((e) => <option key={e.deviceId} value={e.deviceId}>{e.label}</option>)}
                    </select>
                </div> : null}
            {/*debug
            <button onClick={() => mainStore.mediaAllowed = MediaAllowed.dontKnow}>MA:DK</button>
            <button onClick={() => mainStore.mediaAllowed = MediaAllowed.allowed}>MA:A</button>
            <button onClick={() => mainStore.mediaAllowed = MediaAllowed.forbidden}>MA:F</button>

            <button onClick={() => mainStore.webcamConnectionState = AVConnectionState.unknown}>VCS:unk</button>
            <button onClick={() => mainStore.webcamConnectionState = AVConnectionState.ok}>VCS:ok</button>
            <button onClick={() => mainStore.webcamConnectionState = AVConnectionState.problem}>VCS:problem</button>
            <button onClick={() => mainStore.webcamConnectionState = AVConnectionState.error}>VCS:error</button>
            */}
        </div>
    </div>
}

function UserArea() {
    return (
        <div className="user-area">
            <div className="panel fill large">
                {plugIcon(mainStore.connectionState, mainStore.connectionStateStatusText)}

                {userIcon(mainStore.userState, mainStore.userStateStatusText)}

                {videoIcon(mainStore.videoConnectionState, mainStore.videoConnectionStateStatusText)}

                {audioIcon(mainStore.audioConnectionState, mainStore.audioConnectionStateStatusText)}

                <i className="fat fa-fw fa-ellipsis-vertical white"></i>

                {webcamIcon(mainStore.mediaAllowed, mainStore.webcamConnectionState, mainStore.webcamConnectionStateStatusText, mainStore.micConnectionState, mainStore.micConnectionStateStatusText)}
            </div>
        </div>
    );
}

export default view(UserArea);
