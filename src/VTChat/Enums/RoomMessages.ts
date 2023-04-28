export enum RoomMessages {
    askRouterToLeaveRoom = "leaveRoom",
    askRouterToJoinRoom = "joinRoom",
    tellClientSomeoneLeftARoom = "tellClientSomeoneLeftARoom",
    tellClientSomeoneJoinedARoom = "tellClientSomeoneJoinedARoom",
    tellClientStreamAvailable = "tellClientStreamAvailable",

    roomData = "roomData",
    chatMessage = "chatMessage",

    fetchRouterRtpCapabilities = "fetchRouterRtpCapabilities",
    askRouterToCreateTransport = 'askRouterToCreateTransport',
    askRouterToConnectMyTransport = 'askRouterToConnectMyTransport',
    askRouterToAcceptMyStream = 'askRouterToAcceptMyStream',
    askRouterToSendMeAStream = 'askRouterToSendMeAStream',
    askRouterToResumeAStream = 'askRouterToResumeAStream',
    giveClientAvailableStreamList = 'giveClientAvailableStreamList',

    tellRouterImClosingMyStream = 'tellRouterImClosingMyStream',
}
