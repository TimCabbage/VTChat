# VTChat

## Summary

A video chat solution that does not require a powerful server for transcoding the streams, with very low latency.

It's in early stages, You can see the planned features in the project. However, it's functional enough as it is.

Written in TypeScript, 

Uses Mediasoup as the SFU

## Installation

### Requirements:
> Linux or WSL, windows does NOT seem to work well with it.
>
> Node.js (tested on v18.11.0)
>
> SSL certificate

```
git clone https://github.com/TimCabbage/VTChat.git
cd VTChat
npm install
```

Now You will need to put in a certificate to `/SSL/cert.pem` and `/SSL/key.pem`.
You need to set the `domain` and `announcedIp` fields to Your setup in `src/VTChat/VTChatConfig.ts`.
Also, listenPort should be changed to 443 to listen on the HTTPS port.

```
npm run buildserver
npm run standalonejs
```

After this You should have a functional video chat.

## Local development

Localhost and webRTC don't mix very well.

A simple solution is to edit the `hosts` file (windows and linux) and point a domain you have a certificate for (say mydevsubdomain.mydomain.com) to 127.0.0.1

Once You install the certificates:

!Windows: You need to install it in WSL!
!execute devProxyPort.bat - this will forward windows port 4000 to WSL.

Then:

execute `npm start`
in another tab execute `npm run server`

connect to https://mydevsubdomain.mydomain.com:4000 and You should see the application show up.
