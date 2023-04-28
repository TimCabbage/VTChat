import { view } from '@risingstack/react-easy-state';
import React, { useCallback, useRef } from 'react';
import { mainStore } from '../mainStore';
import './VideoViewArea.scss';
import { IAVStream } from '../VTChat/Interfaces/IAVStream';

interface AVConsumerBlockProps {
    stream: IAVStream
}

function AVConsumerBlock(props: AVConsumerBlockProps) {
    const e = props.stream;
    const videoRef = useCallback((node: any) => {
        if(node === null) return;
        node.srcObject = e.stream;
        node.onloadedmetadata = function () {
            node.play();
        };
    }, []);
    const audioRef = useCallback((node: any) => {
        if(node === null) return;
        node.srcObject = e.stream;
        node.onloadedmetadata = function () {
            node.play();
        };
    }, []);

    return (
        <div className="stream">
            {e.video ?
                <video ref={videoRef} id={e.video.id} playsInline={false} autoPlay={true} className="video-view-class" />
                :
                null
            }
            {e.audio ?
                <audio ref={audioRef} id={e.audio.id} playsInline={false} autoPlay={true} className="video-view-class" />
                :
                null
            }
        </div>
    )
}

const AVConsumerBlockWrapped = view(AVConsumerBlock);

interface AVProducerBlockProps {
    stream: IAVStream
}

function AVProducerBlock(props: AVProducerBlockProps) {
    const e = props.stream;
    const videoRef = useCallback((node: any) => {
        if(node === null) return;
        node.srcObject = e.stream;
        node.onloadedmetadata = function () {
            node.play();
        };
    }, []);

    return (
        <div className="stream local">
            {e.video ?
                <video muted ref={videoRef} id={e.video.id} playsInline={false} autoPlay={true} className="video-view-class" />
                :
                null
            }
        </div>
    )
}

const AVProducerBlockWrapped = view(AVProducerBlock);

function VideoViewArea() {
    console.log('rerender VVA', mainStore.outgoingStream);
    const incomingStreams = [];
    for(const [peerID, incomingStream] of mainStore.incomingStreams){
        if(incomingStream.audio || incomingStream.video || incomingStream.screen)
            incomingStreams.push(<AVConsumerBlockWrapped key={peerID} stream={incomingStream} />)
    }
    return (
        <div className={"main-area "+mainStore.incomingStreams_r}>
            <div className="panel videogrid">
                {incomingStreams}
                {mainStore.outgoingStream.stream ? <AVProducerBlockWrapped stream={mainStore.outgoingStream} /> : null}
            </div>
        </div>
    );
}

export default view(VideoViewArea);
