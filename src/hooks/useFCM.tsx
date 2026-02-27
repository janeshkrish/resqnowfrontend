import { useEffect, useState } from 'react';
import { requestForToken, onMessageListener } from '../lib/firebase';
import { apiFetch } from '../lib/api';
import toast from 'react-hot-toast';

export const useFCM = (isLoggedIn: boolean) => {
    const [fcmToken, setFcmToken] = useState<string | null>(null);

    useEffect(() => {
        if (!isLoggedIn) return;

        const initFCM = async () => {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const token = await requestForToken();
                if (token) {
                    setFcmToken(token);
                    // Send to backend
                    try {
                        await apiFetch('/api/notifications/register-token', {
                            method: 'POST',
                            body: JSON.stringify({ token })
                        });
                        console.log("FCM token successfully registered on server.");
                    } catch (err) {
                        console.error("Failed to register FCM token with server", err);
                    }
                }
            }
        };
        initFCM();
    }, [isLoggedIn]);

    useEffect(() => {
        // Listen for foreground notifications
        const listen = () => {
            onMessageListener().then((payload: any) => {
                const { title, body } = payload.notification;

                // Custom hot-toast implementation
                toast(
                    (t) => (
                        <div className="flex gap-3" >
                            <div className="flex-1" >
                                <p className="font-bold text-sm text-gray-900" > {title} </p>
                                < p className="text-sm text-gray-500 mt-1" > {body} </p>
                            </div>
                            < button
                                className="opacity-50 hover:opacity-100"
                                onClick={() => toast.dismiss(t.id)}
                            >
                                ✕
                            </button>
                        </div>
                    ),
                    {
                        duration: 5000,
                        position: 'top-center',
                    }
                );

                // Standard browser notification if supported and allowed
                if (Notification.permission === 'granted') {
                    try {
                        new Notification(title, {
                            body,
                            icon: '/icons/icon-192x192.png',
                            badge: '/icons/icon-192x192.png'
                        });
                        // Try playing a sound
                        const audio = new Audio('/notification.mp3');
                        audio.play().catch(e => console.log('Audio play failed', e)); // Might fail on some browsers if not user initiated
                    } catch (e) { }
                }

                listen(); // Resubscribe
            }).catch(err => console.log('failed: ', err));
        };

        listen();
    }, []);

    return { fcmToken };
};
