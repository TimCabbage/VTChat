import React from 'react';
import { mainStore } from '../mainStore';
import { VTChatClient } from '../VTChat/VTChatClient';
import { view } from '@risingstack/react-easy-state';
import './ChatArea.scss';

function ChatArea() {

    return (
        <div className="chat-area">
            <div className="panel width-20rem">
                {mainStore.you.id}:{mainStore.you.name}
                <hr />
                {mainStore.peers.filter((e: any) => e.id !== mainStore.you.id).map((e: any) => <div key={e.id}>{e.name}</div>)}
                <hr />
                <input value={mainStore.input} onChange={(e) => {
                    mainStore.input = e.target.value;
                }} onKeyDown={async (e) => {
                    if(e.key === 'Enter'){
                        await VTChatClient.client.sendChatToLobby(mainStore.input);
                        mainStore.input = '';
                    }
                }}/>
                <button onClick={async () => {
                    await VTChatClient.client.sendChatToLobby(mainStore.input);
                    mainStore.input = '';
                }}>SEND</button>
                <div className="scrollable-chatbox">
                    {mainStore.messages.map((m: any) => <div key={m.id} className="chat-indent"><span className="brand small">{m.credentials.name}</span><br />{m.message}</div>)}
                </div>
            </div>
        </div>
    );
}

export default view(ChatArea);
