import React from 'react';
import { useController, useLogin, useSocket } from '.';

type Notification = {
    _id?: any
    userId: string,
    payload: { title: string, message: string, meta?: any },
    timeInUtc: number,
    channels: string[]
    hasRead: boolean
}

export function useNotification() {
    const { controller } = useController();
    const [notifications, setNotifications] = React.useState<Notification[]>([]);
    const { subscribe, joinRoom } = useSocket();
    const { current } = useLogin();

    const fetchLatest = React.useCallback(async (limit: number = 50, reset: boolean = false) => {
        let fromNotificationId = '';
        if (notifications.length > 0) {
            fromNotificationId = String(notifications[0]._id);
        }

        const res = await controller.client.get(`/__backend/__services/notifications/latest?limit=${limit}&fromNotificationId=${fromNotificationId}`);
        if (reset === false) {
            setNotifications((n) => [...(res.data.notifications || []), ...n]);
        } else {
            setNotifications((n) => [...(res.data.notifications || [])]);
        }
    }, [notifications]);

    const loadMore = React.useCallback(async (limit: number = 50) => {
        let fromNotificationId = '';
        if (notifications.length > 0) {
            fromNotificationId = String(notifications[notifications.length - 1]._id);
        }

        const res = await controller.client.get(`/__backend/__services/notifications/more?limit=${limit}&fromNotificationId=${fromNotificationId}`);
        setNotifications((n) => [...n, ...(res.data.notifications || [])]);
    }, [notifications]);

    React.useEffect(() => {
        if (current?.currentUser?._id) {
            fetchLatest(undefined, true);
        }
    }, [current?.currentUser?._id]);

    React.useEffect(() => {
        const unsub = subscribe('notification-received', () => fetchLatest());
        return unsub;
    }, [fetchLatest]);

    React.useEffect(() => {
        if (current?.currentUser?._id) {
            const leave = joinRoom(`user-room-${current?.currentUser?._id}`);
            return leave;
        }
    }, [current?.currentUser?._id]);

    const unreadCount = React.useMemo(() => {
        return notifications.filter((n) => n.hasRead === false).length
    }, [notifications]);

    const markAsRead = React.useCallback(async (notificationIds: string[]) => {
        const res = await controller.client.put(`/__backend/__services/notifications/mark-as-read`, {
            ids: notificationIds
        });

        const { readOnUtc } = res.data;

        setNotifications((n) => {
            return n.map((n) => {
                if (notificationIds.indexOf(n._id) > -1) {
                    return {
                        ...n,
                        hasRead: true,
                        readOnUtc
                    }
                }

                return n;
            })
        })
    }, []);

    return {
        notifications,
        fetchLatest,
        loadMore,
        unreadCount,
        markAsRead
    }
}