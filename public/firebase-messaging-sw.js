// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.
// We'll pass the config via URL params if needed, or define it locally here if env vars aren't injected safely.
// Note: It's common practice to string replace these during build, or define them explicitly for public push notifications.
const firebaseConfig = {
    apiKey: "REPLACE_WITH_YOUR_FIREBASE_API_KEY",
    projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
    messagingSenderId: "REPLACE_WITH_YOUR_SENDER_ID",
    appId: "REPLACE_WITH_YOUR_APP_ID",
};

try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);
        const notificationTitle = payload.notification.title;
        const notificationOptions = {
            body: payload.notification.body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png', // smaller badge ideal
            data: payload.data, // Contains requestId, click_action etc.
            vibrate: [200, 100, 200]
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });
} catch (e) {
    console.log("Firebase SW init error: ", e);
}

self.addEventListener('notificationclick', function (event) {
    console.log('[firebase-messaging-sw.js] Notification click Received.', event);

    event.notification.close();

    const data = event.notification.data;
    let targetUrl = '/';

    if (data) {
        if (data.requestId) {
            // Basic routing logic: could check token/context, but usually handled by app router.
            // E.g., if user clicks, they go to request tracker; if tech, to job details.
            // We will navigate to root which manages internal redirects, or specific tracking page
            targetUrl = `/?requestId=${data.requestId}`;
        }
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                    }
                }
                return client.focus().then(() => client.navigate(targetUrl));
            }
            return clients.openWindow(targetUrl);
        })
    );
});
