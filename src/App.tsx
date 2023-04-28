import React, { useEffect, useState } from 'react';
import './App.scss';
import UserArea from './components/UserArea';
import ChatArea from './components/ChatArea';
import VideoViewArea from './components/VideoViewArea';
import { VTChatClient } from './VTChat/VTChatClient';
import { view } from '@risingstack/react-easy-state';

function App() {
    useEffect(() => {
        const timer = setInterval(() => {
            VTChatClient.client.processStatistics();
        }, 1000)
        return () => {
            clearInterval(timer);
        }
    })
    return (
        <div className="layout">
            <UserArea />
            <ChatArea />
            <VideoViewArea />
        </div>
    );
}

export default view(App);
