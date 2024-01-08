import React from "react"
import { FrontendController } from "."
import { Socket, io } from 'socket.io-client';

export class SocketController {
    
}

type Options = {
    controller: FrontendController
}

export type SocketApi = {
    connect: () => void,
    socket: React.MutableRefObject<Socket<any, any>>,
    subscribe: (ev: string, listener: (...args: any[]) => any) => () => void
    joinRoom: (rooms?: string[] | string) => () => void
    leaveRoom: (roomIds: string | string[]) => void
}

export function createSocket(opts: Options): SocketApi {
    const socket = React.useRef<Socket>(io({
        path: '/app-socket',
        autoConnect: false,
        auth(cb) {
            cb({});
        },
    }));

    const roomsRef = React.useRef<any>({});

    React.useEffect(() => {
        const handler = () => {
            console.log('Connected to server');
            joinRoom();
        }

        socket.current.on('connect', handler);

        return () => {
            socket.current.off('connect', handler);
        }
    }, []);

    const connect = React.useCallback(() => {
        socket.current.connect();

        return () => {
            socket.current.disconnect();
        }
    }, []);

    const leaveRoom = React.useCallback((roomIds: string | string[]) => {
        if (roomIds) {
            if (typeof roomIds === 'string') {
                roomIds = [roomIds];
            }

            for (const room of roomIds) {
                roomsRef.current[room] = undefined;
            }

            socket.current.emit('/__magicjs/rooms/leave', roomIds);
        }
    }, []);

    const joinRoom = React.useCallback((rooms?: string[] | string) => {
        if (rooms) {
            if (typeof rooms === 'string') {
                rooms = [rooms];
            }
            for (const room of rooms) {
                roomsRef.current[room] = true;
            }
        }

        const roomIds = Object.keys(roomsRef.current).filter((k) => roomsRef.current[k] === true);
        if (roomIds.length > 0) {
            socket.current.emit('/__magicjs/rooms/join', roomIds);
        }

        return () => {
            return leaveRoom(roomIds);
        }
    }, []);

    /**
     * @returns Unsubscribe function (removes event listener)
     */
    const subscribe = React.useCallback((ev: string, listener: (...args: any[]) => any) => {
        socket.current.on(ev, listener);
        return () => socket.current.off(ev, listener);
    }, []);

    React.useEffect(() => {
        connect();
    }, [connect]);

    return {
        connect,
        socket,
        subscribe,
        joinRoom,
        leaveRoom
    }
}

export function useSocket() {

}