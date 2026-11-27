package com.hazeljane.chatterbox;

import android.util.Log;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;

public class CallMessagingService extends FirebaseMessagingService {

    private static final String TAG = "ChatterboxFCM";

    @Override
    public void onMessageReceived(RemoteMessage message) {
        super.onMessageReceived(message);

        String type = message.getData().get("type");

        try {
            if ("incoming_call".equals(type)
                    || "group_call".equals(type)
                    || "call_ended".equals(type)) {

                IncomingCallNotifications.show(this, message);
                return;
            }

            if (ChatBubbleNotifications.isChatMessage(message)) {

                ChatBubbleNotifications.show(this, message);
                return;
            }

            PushNotificationsPlugin.sendRemoteMessage(message);

        } catch (Exception error) {
            Log.e(
                TAG,
                "Failed to handle Firebase message",
                error
            );
        }
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        PushNotificationsPlugin.onNewToken(token);
    }
}
